// Live sandbox proof for AGENT-006 and SECURE-001: the real model provider, reached only
// through a declared and reviewed flow, interprets a US customer security addendum
// beside the actual asset inventory. The server itself refuses any proposal whose
// citations are not verbatim quotes, so a created proposal is a verified one.
// Run: python3 -I briefs/_od08-env.py ANTHROPIC_API_KEY=ANTHROPIC_API_KEY ANTHROPIC_WORKSPACE_ID=ANTHROPIC_WORKSPACE_ID -- node tests/live/anthropic-tailoring.mjs
// Prints a receipt of statuses and counts only; no key, prompt or answer text is printed.
import assert from 'node:assert/strict'
import { runtime } from '../helpers/runtime.mjs'
import { tailoringFixture } from '../helpers/tailoring-journey.mjs'
const key = process.env.ANTHROPIC_API_KEY ?? ''
assert.ok(key.length > 20, 'ANTHROPIC_API_KEY is required')
const MODEL = process.env.TAILORING_MODEL ?? 'claude-sonnet-5-5'
const receipt = { provider: 'anthropic', model: MODEL, at: new Date().toISOString(), steps: [], provider_statuses: [] }
const step = (name, ok, detail = '') => { receipt.steps.push({ name, ok, detail }); assert.ok(ok, name + ' ' + detail) }
let sent = 0
const real = async request => {
 if (request.url !== 'https://api.anthropic.com/v1/messages') return null
 sent++
 const headers = Object.fromEntries([...request.headers].filter(([name]) => ['content-type', 'x-api-key', 'anthropic-version', 'anthropic-workspace-id'].includes(name)))
 const answer = await fetch(request.url, { method: 'POST', headers, body: await request.text() })
 receipt.provider_statuses.push(answer.status)
 return answer
}
const app = await runtime({ outbound: real })
try {
 await app.signin()
 const f = await tailoringFixture(app, 'live')
 const raw = (path, body) => app.fetch(path, { method: 'POST', headers: { origin: app.origin, 'content-type': 'application/json' }, body: JSON.stringify(body) })
 const input = q => { const { likelihood, impact, assumptions, ...rest } = f.input; return { ...rest, requirement_id: q.id } }
 const before = await raw('/api/tailoring/interpret', input(f.requirements[0])); step('with no declared flow the call is refused and nothing is sent', before.status === 409 && sent === 0, 'status ' + before.status)
 const declared = await (await raw('/api/connections/flows', { provider: 'anthropic', model: MODEL, purpose: 'policy-tailoring', data_classes: ['customer contract text', 'framework text', 'policy text', 'asset inventory', 'risk method'], retention: 'Provider retention per its API terms', region: 'us', account: 'RunEditRun sandbox', workspace: process.env.ANTHROPIC_WORKSPACE_ID ?? '', api_key: key })).json()
 step('the flow is declared with the key sealed', declared.status === 'declared')
 step('the exact declaration is reviewed and enabled', (await raw(`/api/connections/flows/${declared.id}/enable`, { declaration_sha256: declared.declaration_sha256 })).status === 200)
 const stored = await app.db.prepare('SELECT secret_ciphertext FROM flow_declarations WHERE id=?').bind(declared.id).first(); step('the key is stored only as ciphertext', !stored.secret_ciphertext.includes(key))
 for (const [i, label] of [[0, 'explicit deadline'], [1, 'ambiguous obligation']]) {
  const r = await raw('/api/tailoring/interpret', input(f.requirements[i])); const body = await r.json(); step(`the real model interprets the ${label}`, r.status === 201, 'status ' + r.status + (r.status === 201 ? '' : ' ' + String(body.error).slice(0, 160)))
  const s = (await f.get('/api/tailoring/' + body.id)).snapshot
  step(`${label}: verbatim citations, policy diff, risk and obligation are present`, s.citations.filter(c => c.kind === 'model-quote').length >= 1 && s.policy_diff.after.length > s.policy_diff.before.length && !!s.risk.title && !!s.obligation.body, `${s.citations.filter(c => c.kind === 'model-quote').length} model citations`)
  if (i === 0) step('the stated deadline is the source deadline', s.deadline === '2026-12-31', String(s.deadline))
  if (i === 1) step('the ambiguous obligation demands acknowledgement and invents no deadline', s.ambiguous === true && s.deadline === null)
 }
 const calls = (await app.db.prepare("SELECT outcome,bytes FROM flow_calls ORDER BY at").all()).results
 step('both calls are recorded by digest and size, with outcome sent', calls.filter(c => c.outcome === 'sent').length === 2 && calls.every(c => c.bytes > 0))
 const counts = { mappings: (await app.db.prepare('SELECT count(*) AS n FROM custom_framework_mappings').first()).n, risks: (await app.db.prepare('SELECT count(*) AS n FROM risks').first()).n, obligations: (await app.db.prepare('SELECT count(*) AS n FROM tailored_obligations').first()).n }
 step('interpretation changed no program record', counts.mappings === 0 && counts.risks === 0 && counts.obligations === 0)
 receipt.result = 'passed'
} catch (error) { receipt.result = 'failed: ' + (error instanceof Error ? error.message.split('\n')[0] : 'unknown'); process.exitCode = 1 }
finally { await app.close().catch(() => undefined); console.log(JSON.stringify(receipt, null, 1)) }
