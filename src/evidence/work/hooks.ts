import { asanaHandshake } from './asana-webhook'
import { runtimeBindings, type Bindings } from '../../auth.server'
import { boundedBody, Refusal } from '../upload'
import { hookSecretOf, type DestinationRow, type TicketRow } from './storage'
import { syncTicket } from './sync'
import { hookEncoder as encoder, hookHmac as hmac, hookPayload, sameHookValue as same, type VerifiedHook as Verified } from './hook-security'
import { mondayChallenge } from './monday-webhook'
import { nativeHookProviders, verifyNativeHook } from './native-webhooks'
// Inbound tracker webhooks. Each uses the provider's authenticated delivery
// mechanism, is admitted once per delivery identity, and only
// prompts a fresh read of the ticket: the payload itself changes nothing.
const plain = (status: number, body: Record<string, unknown>) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } })
type Payload = Record<string, any>
// Returns the delivery identity and the ticket the event concerns, or null when unverified.
async function verify(d: DestinationRow, secret: string, request: Request, bytes: Uint8Array<ArrayBuffer>, now: Date, callback: string): Promise<Verified | null> {
 if (nativeHookProviders.includes(d.provider)) return verifyNativeHook(d,secret,request,bytes,now,callback)
 const h = (name: string) => request.headers.get(name) ?? ''
 const parse = () => { try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as Payload } catch { return null } }
 if (d.provider === 'github' || d.provider === 'jira') {
  const signature = h(d.provider === 'github' ? 'x-hub-signature-256' : 'x-hub-signature')
  if (!signature.startsWith('sha256=') || !same(signature.slice(7), await hmac(encoder.encode(secret), bytes))) return null
  const payload = parse(), delivery = h(d.provider === 'github' ? 'x-github-delivery' : 'x-atlassian-webhook-identifier')
  if (!payload || !delivery) return null
  if (d.provider === 'github') return { delivery, ref: payload.repository?.full_name?.toLowerCase() === d.project.toLowerCase() && payload.issue?.number ? String(payload.issue.number) : null }
  return { delivery, ref: typeof payload.issue?.key === 'string' ? payload.issue.key : null }
 }
 if (d.provider === 'gitlab') {
  if (!same(h('x-gitlab-token'), secret)) return null
  const p=parse(), delivery=h('x-gitlab-event-uuid')
  if (!p || !delivery || String(p.project?.id) !== d.project && p.project?.path_with_namespace !== d.project) return null
  return { delivery, ref: p.object_kind === 'issue' ? String(p.object_attributes?.iid ?? '') : p.object_kind === 'note' ? String(p.issue?.iid ?? '') : null }
 }
 // https://developer.shortcut.com/api/webhook/v1 — a batch need not have primary_id.
 if (d.provider === 'shortcut') {
  if (!same(h('payload-signature'), await hmac(encoder.encode(secret), bytes))) return null
  const p=parse()
  if (!p || typeof p.id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(p.id) || !Array.isArray(p.actions)) return null
  const refs=[...new Set<string>(p.actions.filter((a:Payload)=>a.entity_type==='story' && Number.isSafeInteger(a.id) && a.id>0).map((a:Payload)=>String(a.id)))]
  return {delivery:p.id,ref:refs[0]??null,refs}
 }
 if (d.provider === 'clickup') {
  if (!same(h('x-signature'), await hmac(encoder.encode(secret), bytes))) return null
  const p=parse()
  if (!p || !p.webhook_id) return null
  return { delivery: await hmac(encoder.encode(secret), bytes), ref: p.task_id ? String(p.task_id) : null }
 }
 if (d.provider === 'asana') {
  if (!same(h('x-hook-signature'), await hmac(encoder.encode(secret), bytes))) return null
  const p=parse()
  if (!p || !Array.isArray(p.events)) return null
  const refs=[...new Set<string>(p.events.flatMap((e:Payload)=>e.resource?.resource_type==='task'?[String(e.resource.gid)]:e.parent?.resource_type==='task'?[String(e.parent.gid)]:[]))]
  return { delivery: await hmac(encoder.encode(secret),bytes),ref:refs[0]??null,refs }
 }
 if (d.provider === 'linear') {
  if (!same(h('linear-signature'), await hmac(encoder.encode(secret), bytes))) return null
  const payload = parse(), delivery = h('linear-delivery')
  // Linear signs a timestamp inside the body; stale deliveries are refused.
  if (!payload || !delivery || typeof payload.webhookTimestamp !== 'number' || Math.abs(now.getTime() - payload.webhookTimestamp) > 60000) return null
  return { delivery, ref: payload.type === 'Issue' ? String(payload.data?.id ?? '') || null : payload.type === 'Comment' ? String(payload.data?.issueId ?? '') || null : null }
 }
 if (d.provider === 'vector') {
  // Base signed webhook format: HMAC over the versioned envelope and exact body.
  const [tenant, destination] = d.hook_audience.split(' '), id = h('webhook-id'), event = h('webhook-event'), timestamp = h('webhook-timestamp'), signature = h('webhook-signature')
  if (h('webhook-tenant') !== tenant || h('webhook-destination') !== destination || !id || !event || !/^\d{1,12}$/.test(timestamp) || Math.abs(now.getTime() - Number(timestamp) * 1000) > 300000 || !signature.startsWith('v1=')) return null
  let body: string
  try { body = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes) } catch { return null }
  const key = new Uint8Array(secret.match(/../g)!.map(p => parseInt(p, 16)))
  if (!same(signature.slice(3), await hmac(key, encoder.encode(JSON.stringify(['integrations.webhook.v1', tenant, destination, event, id, timestamp, body]))))) return null
  const payload = parse()
  return { delivery: id, ref: typeof payload?.identifier === 'string' ? payload.identifier : null }
 }
 return null
}
export function hookHandler(clock: () => Date) {
 return async (request: Request, original: Bindings): Promise<Response | null> => {
  const match = /^\/hooks\/trackers\/([a-f0-9-]{36})$/.exec(new URL(request.url).pathname)
  if (!match) return null
  if (request.method !== 'POST') return plain(405, { error: 'Method not allowed.' })
  const env = runtimeBindings(original), now = clock()
  const d = await env.DB.prepare("SELECT * FROM tracker_destinations WHERE id=? AND status='active'").bind(match[1]).first<DestinationRow>()
  if (d?.provider==='asana' && request.headers.has('x-hook-secret')) return await asanaHandshake(env,d,request) ?? plain(401,{error:'Handshake not authorized.'})
  const secret = d ? await hookSecretOf(env, d).catch(() => null) : null
  if (!d || !secret) return plain(404, { error: 'Not found.' })
  let bytes: Uint8Array<ArrayBuffer>
  try { bytes = await boundedBody(request, 1048576) } catch (error) { if (error instanceof Refusal) return plain(error.status, { error: error.message }); throw error }
  if(d.provider==='monday') {
   const challenge=mondayChallenge(hookPayload(bytes))
   if(challenge!==null)return plain(200,{challenge})
  }
  const verified = await verify(d, secret, request, bytes, now, `${env.AUTH_ORIGIN}/hooks/trackers/${d.id}`)
  if (!verified) return plain(401, { error: 'Signature not verified.' })
  const admitted = await env.DB.prepare("INSERT INTO tracker_deliveries(destination_id,delivery_id,ticket_ref,outcome,received_at) VALUES(?,?,?,'admitted',?) ON CONFLICT DO NOTHING").bind(d.id, verified.delivery.slice(0, 200), verified.ref ?? '', now.toISOString()).run()
  if (!admitted.meta.changes) return plain(200, { duplicate: true })
  const states:string[]=[]
  for (const ref of verified.refs ?? (verified.ref ? [verified.ref] : [])) {
   const ticket=await env.DB.prepare('SELECT * FROM tickets WHERE destination_id=? AND (remote_id=? OR remote_key=?)').bind(d.id,ref,ref).first<TicketRow>()
   if(ticket) states.push(await syncTicket(env,ticket,'webhook',now))
  }
  if (!states.length) { await env.DB.prepare("UPDATE tracker_deliveries SET outcome='no linked ticket' WHERE destination_id=? AND delivery_id=?").bind(d.id, verified.delivery.slice(0, 200)).run(); return plain(202, { linked: false }) }
  const state=states.join(', ')
  await env.DB.prepare('UPDATE tracker_deliveries SET outcome=? WHERE destination_id=? AND delivery_id=?').bind('synced: ' + state, d.id, verified.delivery.slice(0, 200)).run()
  return plain(202, { linked: true, state })
 }
}
