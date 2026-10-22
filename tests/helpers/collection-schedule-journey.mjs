import assert from 'node:assert/strict'
import { runtime } from './runtime.mjs'
import { collectionScheduleBrowser } from './collection-schedule-browser.mjs'
// COLLECTION-001: reuse each suite's official-schema network edge. All writes,
// dispatch, history and custody assertions cross the production HTTP/Cron doors.
export async function collectionScheduleJourney(app, at = time => app.clock(time)) {
 const get = async path => { const r = await app.fetch(path); assert.equal(r.status, 200, path); return r.json() }
 const send = async (id, minutes, status = 200, headers = {}) => {
  const r = await app.fetch(`/api/connections/${id}/schedule`, { method: 'POST', headers: { origin: app.origin, 'content-type': 'application/json', ...headers }, body: JSON.stringify({ minutes }) })
  assert.equal(r.status, status, await r.clone().text())
 }
 const connections = (await get('/api/connections')).connections
 assert.ok(connections.length > 0)
 const original = new Map(connections.map(c => [c.id, JSON.parse(c.config_json)]))
 for (const c of connections) {
  assert.equal(c.status, 'active', c.provider)
  const before = JSON.stringify(await get('/api/connections/' + c.id))
  for (const minutes of [0, 4, 7, 61, 1.5, '15junk', null, true]) await send(c.id, minutes, 400)
  await send(c.id, 15, 403, { origin: 'https://foreign.test' })
  await send(c.id, 15, 401, { cookie: '' })
  assert.equal(JSON.stringify(await get('/api/connections/' + c.id)), before, 'refused schedules leave configuration and history unchanged')
  await send(c.id, '15')
  assert.deepEqual(JSON.parse((await get('/api/connections/' + c.id)).connection.config_json), { ...original.get(c.id), collection_minutes: 15 }, 'provider configuration preserved')
 }
 const baseline = Date.parse('2026-11-01T12:00:00Z')
 const step = async minutes => { await at(new Date(baseline + minutes * 60000).toISOString()); await app.tick() }
 const history = async c => (await get('/api/connections/' + c.id)).runs
 await step(0)
 const first = new Map()
 for (const c of connections) {
  const run = (await history(c))[0]; first.set(c.id, run)
  assert.ok(['complete', 'partial'].includes(run.outcome), c.provider + ' ' + run.error_code)
  assert.equal(run.trigger, 'schedule'); assert.equal(run.started_at, new Date(baseline).toISOString())
  assert.equal(JSON.parse(run.coverage_json).interval_minutes, 15)
  const context = JSON.parse(run.coverage_json)
  assert.equal(context.context.account, c.account); assert.equal(context.context.provider, c.provider)
  assert.ok(Array.isArray(context.context.controls) && Array.isArray(context.context.tests) && Array.isArray(context.context.audit_periods))
  assert.equal(context.source_read_started_at, run.started_at); assert.equal(context.received_at, run.finished_at)
  assert.equal(context.source_event_at, null)

 }
 await step(10)
 for (const c of connections) assert.equal((await history(c))[0].id, first.get(c.id).id, 'no early read: ' + c.provider)
 await step(15)
 const second = new Map()
 for (const c of connections) {
  const runs = await history(c); second.set(c.id, runs[0])
  assert.notEqual(runs[0].id, first.get(c.id).id, 'exact inclusive due boundary: ' + c.provider)
  assert.equal(runs[0].started_at, new Date(baseline + 15 * 60000).toISOString())
  assert.deepEqual(runs.find(r => r.id === first.get(c.id).id), first.get(c.id))
  await send(c.id, 60)
 }
 await step(70)
 for (const c of connections) assert.equal((await history(c))[0].id, second.get(c.id).id, 'lengthened schedule is not due at 55 minutes: ' + c.provider)
 // Skip several due intervals: only the actual resumed read may be recorded.
 const beforeResume = new Map(await Promise.all(connections.map(async c => [c.id, (await history(c)).length])))
 await step(240); await step(240)
 for (const c of connections) {
  const runs = await history(c)
  assert.equal(runs.length, beforeResume.get(c.id) + 1, 'one resumed read, no catch-up or duplicate: ' + c.provider)
  assert.equal(JSON.parse(runs[0].coverage_json).interval_minutes, 60)
  assert.equal(JSON.parse(runs.find(r => r.id === first.get(c.id).id).coverage_json).interval_minutes, 15, 'historical interval is immutable')
  assert.ok((await get('/api/audit')).entries.some(e => e.action === 'connection.schedule' && e.subject === 'connection:' + c.id && /60 minutes; previous 15 minutes/.test(e.detail)))
 }
 // Every current hosted source accepts events only after an audited owner
 // grant to an expiring token. Event bodies never become source observations.
 const issue = async scopes => { const r=await app.fetch('/api/api-tokens',{method:'POST',headers:{origin:app.origin,'content-type':'application/json'},body:JSON.stringify({name:'Source-event forwarder',scopes,expires_at:'2027-04-01'})}); assert.equal(r.status,201,await r.clone().text()); return r.json() }
 const grant = await issue(['resource-push']), readOnly = await issue(['read'])
 const event = async (c,id,status=202,token=grant.token) => {const r=await app.fetch(`/v1/connections/${c.id}/events`,{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({event_id:id,reported_at:'2026-11-01T16:00:00Z',attributes:{mfa_enrolled:true,private:true}})});assert.equal(r.status,status,await r.clone().text());return r.json()}
 const permit = async (c,tokens,headers={},status=200) => {const r=await app.fetch(`/api/connections/${c.id}/events/permissions`,{method:'POST',headers:{origin:app.origin,'content-type':'application/json',...headers},body:JSON.stringify({event_tokens:tokens,reason:'Allow only our explicitly reviewed event forwarder'})});assert.equal(r.status,status,await r.clone().text())}
 const sourceFacts = async () => (await get('/api/inventory')).records.filter(r=>connections.some(c=>r.source_ref.endsWith(':'+c.id))).map(r=>({key:r.source_key,attributes:r.attributes})).sort((a,b)=>a.key.localeCompare(b.key))
 const actualFacts=await sourceFacts()
 const beforeEvents = new Map(await Promise.all(connections.map(async c=>[c.id,(await history(c)).length])))
 const receipts=new Map()
 for (const [index,c] of connections.entries()) {
  await event(c,'synthetic-evidence-'+index,403)
  await permit(c,[readOnly.grant.id],{},400)
  await permit(c,[grant.grant.id],{origin:'https://foreign.test'},403)
  await permit(c,[grant.grant.id],{cookie:''},401)
  await permit(c,[grant.grant.id])
  const received=await event(c,'synthetic-evidence-'+index)
  assert.equal((await event(c,'synthetic-evidence-'+index)).receipt,received.receipt,'duplicate signals share one durable receipt')
  receipts.set(c.id,received.receipt)
  assert.equal((await history(c)).length,beforeEvents.get(c.id),'queue acceptance performs no source read')
 }
 await step(245)
 for(const c of connections) {
  const run=(await history(c))[0],cov=JSON.parse(run.coverage_json)
  assert.equal((await history(c)).length,beforeEvents.get(c.id)+1,'one actual read on the next tick, before the elapsed schedule is due')
  assert.equal(cov.source_event.id,receipts.get(c.id));assert.equal(cov.source_event.reported_at,'2026-11-01T16:00:00.000Z');assert.equal(cov.source_event_at,null,'a reported event time never becomes a verified source time')
  assert.equal((await get('/api/connections/'+c.id)).source_events.find(e=>e.id===receipts.get(c.id)).outcome,run.outcome)
 }
 assert.deepEqual(await sourceFacts(),actualFacts,'event payloads cannot supply or change source facts')
 await step(245)
 for(const [index,c] of connections.entries()) {
  await event(c,'synthetic-evidence-'+index)
  assert.equal((await history(c)).length,beforeEvents.get(c.id)+1,'worker restart or replay never repeats a completed event read')
 }
 const audit=await get('/api/audit')
 assert.ok(audit.entries.some(e=>e.action==='connection.event-permissions' && e.reason==='Allow only our explicitly reviewed event forwarder'))
 assert.ok(!JSON.stringify(audit).includes(grant.token));assert.ok(!JSON.stringify(audit).includes('synthetic-evidence-0'),'event ids are fingerprints, not retained payloads')
 await collectionScheduleBrowser(app, connections)
 for(const [index,c] of connections.entries()) await event(c,'synthetic-evidence-pending-'+index)
 const target = await runtime()
 try {
  await target.signin()
  const restored = await target.fetch('/api/archive/restore', { method: 'POST', headers: { origin: target.origin, 'content-type': 'application/octet-stream', 'x-evidence-confirm': 'restore', 'x-evidence-erasure-history': 'unverified acknowledged' }, body: await (await app.fetch('/api/archive/export')).arrayBuffer() })
  assert.equal(restored.status, 200, await restored.clone().text())
  for (const c of connections) {
   const copy = await (await target.fetch('/api/connections/' + c.id)).json(), source = await get('/api/connections/' + c.id)
   assert.equal(copy.connection.status, 'inactive after restore'); assert.equal(copy.connection.config_json, source.connection.config_json)
   assert.deepEqual(copy.runs, source.runs); assert.deepEqual(copy.source_events,source.source_events)
  }
  await target.clock('2026-11-02T16:00:00Z'); await target.tick()
  for (const c of connections) assert.deepEqual((await (await target.fetch('/api/connections/' + c.id)).json()).runs, await history(c), 'restore never resumes provider authority')
 } finally { await target.close() }
 console.log('PASS COLLECTION-001: schedule, exact timing, no catch-up, permissions, config, audit, 1440/390 and inactive restore for ' + connections.map(c => c.provider).join(', '))
}
