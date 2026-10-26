import type { Bindings } from '../../auth.server'
import { auditStatement, list, oneOf, text, type Actor, type Input } from '../door'
import { Refusal } from '../upload'
import { CustodyUnavailable, seal, unseal } from '../connect/custody'
import { disclosure } from './records'
// SECURE-001 declared outbound flows (docs/KEY-CUSTODY.md). A model provider is
// reachable only through a flow the owner declared, reviewed and enabled: its
// purpose, the exact classes of data it may receive, retention, region and
// account. Each call is checked against that declaration, scanned for secrets,
// recorded by digest (never by content) and refused with a reason when it cannot
// be made. Source text never grants authority: a model answer is only a proposal.
export const purposes = ['policy-tailoring'] as const
export const dataClasses = ['policy text', 'customer contract text', 'framework text', 'asset inventory', 'risk method'] as const
const providers = { anthropic: 'https://api.anthropic.com/v1/messages', openai: 'https://api.openai.com/v1/chat/completions' } as const
export const MAX_PAYLOAD = 60000
export interface Flow { id: string; provider: keyof typeof providers; model: string; purpose: string; data_classes: string; retention: string; region: string; account: string; workspace: string; declaration_sha256: string; status: 'declared' | 'enabled' | 'disabled'; declared_name: string; declared_at: string; reviewed_name: string | null; reviewed_at: string | null; disabled_at: string | null; secret_ciphertext: string | null; secret_iv: string | null; key_rotated_at: string | null; last_used_at: string | null }
const sha = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))).map(n => n.toString(16).padStart(2, '0')).join('')
const canonical = (f: Pick<Flow, 'provider' | 'model' | 'purpose' | 'retention' | 'region' | 'account'> & { workspace?: string; classes: string[] }) => JSON.stringify({ provider: f.provider, model: f.model, purpose: f.purpose, data_classes: [...f.classes].sort(), retention: f.retention, region: f.region, account: f.account, workspace: f.workspace ?? '' })
export const declarationOf = (f: Flow) => canonical({ ...f, classes: JSON.parse(f.data_classes) })
// What must never leave in a payload: private keys, bearer or API credentials, and key=value credentials.
const secretShapes = [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, /\bBearer\s+[A-Za-z0-9._~+\/-]{20,}/, /\b(?:sk|rk)-[A-Za-z0-9_-]{20,}/, /\bAKIA[0-9A-Z]{16}\b/, /\bgh[pousr]_[A-Za-z0-9]{30,}/, /\bxox[baprs]-[A-Za-z0-9-]{10,}/, /\b(?:api[_-]?key|secret|password|passwd|token|authorization)\b["']?\s*[:=]\s*["']?[A-Za-z0-9._~+\/=-]{8,}/i]
export const carriesSecret = (payload: string, own = '') => (own.length >= 8 && payload.includes(own)) || secretShapes.some(p => p.test(payload))

export const flows = async (env: Bindings) => (await env.DB.prepare('SELECT id,provider,model,purpose,data_classes,retention,region,account,workspace,declaration_sha256,status,declared_name,declared_at,reviewed_name,reviewed_at,disabled_at,key_rotated_at,last_used_at FROM flow_declarations ORDER BY declared_at DESC,id').all<Flow>()).results
const get = async (env: Bindings, id: string) => { const row = await env.DB.prepare('SELECT * FROM flow_declarations WHERE id=?').bind(id).first<Flow>(); if (!row) throw new Refusal('Declaration not found.', 404); return row }
const key = (input: Input) => { const value = input.api_key; if (typeof value !== 'string' || value.trim().length < 16 || value.length > 400 || /\s/.test(value.trim())) throw new Refusal('Provide the provider API key.'); return value.trim() }

export async function declare(env: Bindings, actor: Actor, input: Input, now: Date) {
 const provider = oneOf(input, 'provider', ['anthropic', 'openai'] as const), purpose = oneOf(input, 'purpose', purposes), classes = list(input, 'data_classes', 10)
 if (!classes.length || classes.some(c => !(dataClasses as readonly string[]).includes(c))) throw new Refusal('Name the exact data classes from the list: ' + dataClasses.join(', ') + '.')
 const model = text(input, 'model', 80), retention = text(input, 'retention', 200), region = text(input, 'region', 40), account = text(input, 'account', 120), workspace = text(input, 'workspace', 80, true), secret = key(input)
 const id = crypto.randomUUID(), at = now.toISOString(), hash = await sha(canonical({ provider, model, purpose, retention, region, account, workspace, classes })), sealed = await seal(env, secret, 'flow-' + id)
 await env.DB.batch([
  env.DB.prepare("INSERT INTO flow_declarations(id,provider,model,purpose,data_classes,retention,region,account,workspace,declaration_sha256,status,declared_by,declared_name,declared_at,secret_ciphertext,secret_iv) VALUES(?,?,?,?,?,?,?,?,?,?,'declared',?,?,?,?,?)").bind(id, provider, model, purpose, JSON.stringify([...classes].sort()), retention, region, account, workspace, hash, actor.id, actor.name, at, sealed.ciphertext, sealed.iv),
  auditStatement(env, actor, 'flow.declared', 'flow:' + id, now, 'succeeded', `${provider} ${model} for ${purpose}; ${classes.join(', ')}`),
 ])
 return { id, status: 'declared', declaration_sha256: hash }
}
// Enabling is the owner's review of the exact declaration: the digest must match what was read.
export async function enable(env: Bindings, actor: Actor, id: string, input: Input, now: Date) {
 const row = await get(env, id)
 if (row.status === 'enabled') return { id, status: 'enabled' }
 if (input.declaration_sha256 !== row.declaration_sha256) throw new Refusal('Review the exact declaration: its fingerprint does not match what you approved.', 409)
 try { await unseal(env, row.secret_ciphertext ?? '', row.secret_iv ?? '', 'flow-' + id) } catch { throw new Refusal('Key custody is unavailable for this flow. Rotate its key before enabling.', 409) }
 await env.DB.batch([
  env.DB.prepare("UPDATE flow_declarations SET status='enabled',reviewed_by=?,reviewed_name=?,reviewed_at=?,disabled_at=NULL WHERE id=?").bind(actor.id, actor.name, now.toISOString(), id),
  auditStatement(env, actor, 'flow.enabled', 'flow:' + id, now, 'succeeded', row.declaration_sha256),
 ])
 return { id, status: 'enabled' }
}
export async function disable(env: Bindings, actor: Actor, id: string, now: Date) {
 await get(env, id)
 await env.DB.batch([env.DB.prepare("UPDATE flow_declarations SET status='disabled',disabled_at=? WHERE id=?").bind(now.toISOString(), id), auditStatement(env, actor, 'flow.disabled', 'flow:' + id, now)])
 return { id, status: 'disabled' }
}
// The new provider key replaces the old one, sealed under the current custody key. The flow stays as declared.
export async function rotateKey(env: Bindings, actor: Actor, id: string, input: Input, now: Date) {
 await get(env, id)
 const sealed = await seal(env, key(input), 'flow-' + id)
 await env.DB.batch([env.DB.prepare('UPDATE flow_declarations SET secret_ciphertext=?,secret_iv=?,key_rotated_at=? WHERE id=?').bind(sealed.ciphertext, sealed.iv, now.toISOString(), id), auditStatement(env, actor, 'flow.key-rotated', 'flow:' + id, now)])
 return { id, rotated: true }
}
export const callsFor = async (env: Bindings, limit = 50) => (await env.DB.prepare('SELECT id,flow_id,at,purpose,data_classes,bytes,payload_sha256,outcome,detail FROM flow_calls ORDER BY at DESC,id LIMIT ?').bind(limit).all<Record<string, string | number>>()).results
export const disclosures = async (env: Bindings, limit = 50) => (await env.DB.prepare('SELECT id,at,kind,subject,actor,detail FROM disclosure_events ORDER BY at DESC,id LIMIT ?').bind(limit).all<Record<string, string>>()).results

export class FlowRefused extends Refusal { constructor(message: string, status = 409) { super(message, status) } }
export interface ModelRequest { purpose: (typeof purposes)[number]; classes: readonly string[]; system: string; user: string; maxTokens?: number }
// The one door to a model provider. Returns the provider's answer text, or throws FlowRefused with the reason and nothing sent.
export async function callModel(env: Bindings, request: ModelRequest, now: Date, fetcher: typeof fetch = (input, init) => fetch(input, init)) {
 const flow = await env.DB.prepare("SELECT * FROM flow_declarations WHERE purpose=? AND status='enabled' ORDER BY reviewed_at DESC LIMIT 1").bind(request.purpose).first<Flow>()
 if (!flow) throw new FlowRefused('No enabled model flow is declared for this purpose. Declare and review one in Connections.', 409)
 const payload = request.system + '\n' + request.user, digest = await sha(payload), bytes = new TextEncoder().encode(payload).byteLength
 const note = (outcome: 'sent' | 'refused' | 'failed', detail: string) => env.DB.prepare('INSERT INTO flow_calls(id,flow_id,at,purpose,data_classes,bytes,payload_sha256,outcome,detail) VALUES(?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(), flow.id, now.toISOString(), request.purpose, JSON.stringify([...request.classes].sort()), bytes, digest, outcome, detail)
 const refuse = async (kind: string, detail: string) => { await env.DB.batch([note('refused', detail), disclosure(env, kind, 'flow:' + flow.id, 'agent', detail, now), auditStatement(env, { id: 'agent', name: 'Evidence agent', kind: 'system' }, 'flow.call-refused', 'flow:' + flow.id, now, 'refused', detail)]); throw new FlowRefused(detail) }
 const declared = JSON.parse(flow.data_classes) as string[], extra = request.classes.filter(c => !declared.includes(c))
 if (extra.length) await refuse('undeclared-data-class', `Not sent: ${extra.join(', ')} is not in the declared data classes.`)
 if (payload.length > MAX_PAYLOAD) await refuse('oversized-payload', 'Not sent: the payload exceeds the minimum-necessary bound.')
 let secret: string
 try { secret = await unseal(env, flow.secret_ciphertext ?? '', flow.secret_iv ?? '', 'flow-' + flow.id) }
 catch (error) { const detail = error instanceof CustodyUnavailable ? error.message : 'The provider key could not be opened.'; await env.DB.batch([note('failed', detail), auditStatement(env, { id: 'agent', name: 'Evidence agent', kind: 'system' }, 'flow.call-failed', 'flow:' + flow.id, now, 'failed', detail)]); throw new FlowRefused('Key custody unavailable: nothing was sent. Restore the custody key or rotate this flow\'s key.', 503) }
 if (carriesSecret(payload, secret)) await refuse('secret-in-payload', 'Not sent: the payload carries a credential.')
 const anthropic = flow.provider === 'anthropic'
 let response: Response
 try {
  response = await fetcher(providers[flow.provider], { method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(90000), headers: { 'content-type': 'application/json', ...(anthropic ? { 'x-api-key': secret, 'anthropic-version': '2023-06-01', ...(flow.workspace ? { 'anthropic-workspace-id': flow.workspace } : {}) } : { authorization: 'Bearer ' + secret }) },
   body: JSON.stringify(anthropic ? { model: flow.model, max_tokens: request.maxTokens ?? 4000, system: request.system, messages: [{ role: 'user', content: request.user }] } : { model: flow.model, max_completion_tokens: request.maxTokens ?? 4000, messages: [{ role: 'system', content: request.system }, { role: 'user', content: request.user }] }) })
 } catch { await env.DB.batch([note('failed', 'The provider was unreachable.'), env.DB.prepare('UPDATE flow_declarations SET last_used_at=? WHERE id=?').bind(now.toISOString(), flow.id)]); throw new FlowRefused('The model provider was unreachable. Nothing was recorded from it.', 503) }
 if (!response.ok) { await env.DB.batch([note('failed', `The provider answered ${response.status}.`), env.DB.prepare('UPDATE flow_declarations SET last_used_at=? WHERE id=?').bind(now.toISOString(), flow.id)]); throw new FlowRefused(`The model provider answered ${response.status}. Nothing was recorded from it.`, 502) }
 const body = await response.json().catch(() => null) as { content?: { type?: string; text?: string }[]; choices?: { message?: { content?: string } }[] } | null
 const answer = anthropic ? body?.content?.filter(c => c.type === 'text').map(c => c.text ?? '').join('') : body?.choices?.[0]?.message?.content
 if (typeof answer !== 'string' || !answer.trim()) { await env.DB.batch([note('failed', 'The provider answer was empty.')]); throw new FlowRefused('The model provider returned no text. Nothing was recorded from it.', 502) }
 await env.DB.batch([note('sent', `${flow.provider} ${flow.model}`), env.DB.prepare('UPDATE flow_declarations SET last_used_at=? WHERE id=?').bind(now.toISOString(), flow.id), auditStatement(env, { id: 'agent', name: 'Evidence agent', kind: 'system' }, 'flow.model-call', 'flow:' + flow.id, now, 'succeeded', `${bytes} bytes, ${request.classes.join(', ')}`)])
 return { text: answer, flow: flow.id, provider: flow.provider, model: flow.model }
}
