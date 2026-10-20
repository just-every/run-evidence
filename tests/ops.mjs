// OPS-001 through the production owner, Cron, D1 and R2 doors. SQL triggers
// inject real storage refusals; only GitHub and paid mail are network fakes.
import assert from 'node:assert/strict'
import { fork } from 'node:child_process'
import { runtime } from './helpers/runtime.mjs'
import { githubFixture } from './helpers/github-fixture.mjs'
const { github, outbound:provider } = githubFixture()
let hold
const outbound=async request=>{if(hold&&new URL(request.url).host==='api.github.com'){const gate=hold;gate.enter();await gate.wait}return provider(request)}
let app = await runtime({ outbound })
const scenario = async (name, fn) => { await fn(); console.log('PASS OPS-001: ' + name) }
const owner = async (path, body, status = 201) => {
 const r = await app.fetch(path,{method:'POST',headers:{origin:app.origin,'content-type':'application/json'},body:JSON.stringify(body)})
 const text = await r.text(); assert.equal(r.status,status,text); return text ? JSON.parse(text) : null
}
const get = async path => { const r = await app.fetch(path); assert.equal(r.status,200); return r.json() }
const at = async time => { github.clock=time; await app.clock(time) }
const allSteps = async () => (await app.db.prepare('SELECT * FROM operation_steps ORDER BY rowid').all()).results
let connection
try {
 await scenario('required-setting errors name only the setting and refuse HTTP and Cron before effects', async () => {
  for (const setting of ['DB','EXHIBITS']) {
   await app.omitBindings([setting])
   const r=await app.fetch('/api/operations');assert.equal(r.status,503)
   assert.deepEqual((await r.json()).settings,[setting])
   assert.equal((await app.tick()).outcome,'exception')
   await app.omitBindings([])
   assert.equal((await app.db.prepare('SELECT COUNT(*) AS n FROM operation_steps').first()).n,0)
  }
  for (const [setting,value] of [['AUTH_ORIGIN',''],['AUTH_ORIGIN','https://secret-value.example.test/path'],['OWNER_EMAIL',''],['OWNER_EMAIL','private-invalid-value'],['SESSION_SECRET',''],['SESSION_SECRET','short-secret-value'],['SETUP_TOKEN','short-setup-value'],['MAIL_PROVIDER','invalid'],['MAIL_FROM','invalid'],['MAIL_API_KEY',''],['MAIL_API_KEY','invalid key']]) {
   const broken=await runtime({settings:{[setting]:value}})
   try {
    for(const path of ['/app','/api/operations','/auth/bootstrap','/v1/resources','/collectors/example','/hooks/asana']) {
     const r=await broken.fetch(path,{method:'POST',headers:{origin:broken.origin,'content-type':'application/json'},body:'{}'})
     assert.equal(r.status,503,path)
     assert.deepEqual(await r.json(),{error:'Required configuration is missing or invalid.',settings:[setting]})
     assert.equal(r.headers.get('cache-control'),'no-store')
    }
    assert.equal((await broken.tick()).outcome,'exception',setting)
    for (const table of ['oa_operators','product_audit','operation_steps','collection_runs','followups']) assert.equal((await broken.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first()).n,0,table)
    assert.equal(broken.messages.length,0)
   } finally {await broken.close()}
  }
 })
 await app.signin();github.clock='2026-10-11T12:00:00Z'
 await scenario('outcomes keep the existing owner, host, origin and token boundaries',async()=>{
  assert.equal((await app.fetch('/api/operations',{headers:{cookie:''}})).status,401)
  for(const headers of [{host:'evil.test'},{origin:'https://evil.test'},{'sec-fetch-site':'cross-site'},{authorization:'Bearer fake-agent-token'}]) assert.equal((await app.fetch('/api/operations',{headers})).status,403)
  assert.equal((await app.fetch('/api/operations',{method:'POST',headers:{origin:app.origin}})).status,405)
  assert.deepEqual((await get('/api/operations')).steps,[])
 })
 await scenario('every existing scheduled step durably records its result across a Worker restart',async()=>{
  connection=await owner('/api/connections',{account:'northstar',token:'github_pat_good',label:'OPS source'})
  await app.tick()
  const before=await allSteps()
  const expected=['delivery reconciliation','collections','tickets','policies','tests','access reviews','training','retests','ticket automation','escalations','renewals','risk acceptances','weekly digest','attestation reminders','review reminders','handovers','readiness snapshots']
  assert.deepEqual(before.map(r=>r.step),expected)
  for(const row of before) {assert.equal(row.outcome,'succeeded',row.step);assert.ok(Number.isInteger(row.processed_count));assert.ok(row.finished_at)}
  assert.equal(before.find(r=>r.step==='collections').processed_count,1)
  await at('2026-10-11T12:05:00Z')
  assert.deepEqual(await allSteps(),before)
  const report=await get('/api/operations');assert.equal(report.lease_minutes,15);assert.equal(report.more,false)
  assert.equal(report.steps.length,expected.length);assert.match(report.custody,/archive/i)
  assert.ok(!JSON.stringify(report).includes('github_pat_good'))
  await assert.rejects(app.db.prepare("UPDATE operation_steps SET outcome='failed' WHERE id=?").bind(before[0].id).run(),/terminal_operation_outcome/)
  await assert.rejects(app.db.prepare('DELETE FROM operation_steps WHERE id=?').bind(before[0].id).run(),/retained_operation_outcome/)
 })
 await scenario('a failed claim storage write refuses dispatch before collection or notification',async()=>{
  const before=await allSteps(),requests=github.requests.length,mails=app.messages.length
  await app.db.prepare("CREATE TRIGGER ops_claim_outage BEFORE INSERT ON operation_steps BEGIN SELECT RAISE(ABORT,'ops storage unavailable'); END").run()
  assert.equal((await app.tick()).outcome,'exception')
  assert.deepEqual(await allSteps(),before);assert.equal(github.requests.length,requests);assert.equal(app.messages.length,mails)
  await app.db.prepare('DROP TRIGGER ops_claim_outage').run()
 })
 await scenario('a product storage failure stays failed, hides raw exception text and does not suppress later steps',async()=>{
  await at('2026-10-11T13:00:00Z')
  await app.db.prepare("CREATE TRIGGER ops_product_outage BEFORE UPDATE ON resources BEGIN SELECT RAISE(ABORT,'planted-secret-in-storage-error'); END").run()
  await app.tick()
  await app.db.prepare('DROP TRIGGER ops_product_outage').run()
  const rows=(await allSteps()).filter(r=>r.scheduled_at==='2026-10-11T13:00:00.000Z')
  assert.equal(rows.find(r=>r.step==='collections').outcome,'failed')
  assert.equal(rows.find(r=>r.step==='collections').processed_count,null)
  assert.equal(rows.find(r=>r.step==='readiness snapshots').outcome,'succeeded')
  assert.ok(!JSON.stringify(await get('/api/operations')).includes('planted-secret-in-storage-error'))
 })
 await scenario('a lost collection completion is retained running, prevents overlap, then reconciles Unknown without fabricating a successful attempt',async()=>{
  await at('2026-10-11T14:00:00Z')
  await app.db.prepare("CREATE TRIGGER ops_completion_outage BEFORE UPDATE ON operation_steps WHEN NEW.step='collections' AND NEW.outcome='succeeded' BEGIN SELECT RAISE(ABORT,'ops completion unavailable'); END").run()
  assert.equal((await app.tick()).outcome,'exception')
  const interrupted=(await allSteps()).find(r=>r.step==='collections'&&r.outcome==='running')
  assert.ok(interrupted);assert.equal(interrupted.finished_at,null)
  const source=await get('/api/connections/'+connection.id),requests=github.requests.length
  assert.ok(source.runs.some(r=>r.outcome==='complete'))
  await at('2026-10-11T14:05:00Z');await app.tick()
  assert.equal(github.requests.length,requests,'unexpired claim must not invoke collector again')
  assert.equal((await allSteps()).find(r=>r.id===interrupted.id).outcome,'running')
  await app.db.prepare('DROP TRIGGER ops_completion_outage').run()
  await at('2026-10-11T14:15:00Z');await app.tick()
  const recovered=(await allSteps()).find(r=>r.id===interrupted.id)
  assert.equal(recovered.outcome,'unknown');assert.equal(recovered.processed_count,null);assert.match(recovered.detail,/interrupted|expired/)
  assert.equal(github.requests.length,requests,'recovery must not fabricate a source observation')
  assert.deepEqual((await get('/api/connections/'+connection.id)).runs,source.runs)
 })
 await scenario('a provider-accepted notification whose storage acknowledgement is lost becomes uncertain after restart and is never resent',async()=>{
  // A real due test creates a real obligation; the mail provider is the only
  // fake. A D1 refusal interrupts final acknowledgement after mail acceptance.
  await at('2026-10-12T16:00:00Z')
  await owner('/api/remediation/sla',{category:'code',severity:'high',days:1})
  await app.db.prepare("CREATE TRIGGER ops_delivery_outage BEFORE UPDATE ON followups WHEN OLD.state='pending' BEGIN SELECT RAISE(ABORT,'delivery outcome unavailable'); END").run()
  await app.tick()
  const pending=(await get('/api/followups')).deliveries.filter(r=>r.state==='pending')
  assert.ok(pending.length>0,'the storage refusal must leave a claimed delivery')
  const mails=app.messages.length
  assert.ok(mails>1,'provider accepted a real notification')
  await app.db.prepare('DROP TRIGGER ops_delivery_outage').run()
  await at('2026-10-12T16:14:00Z');await app.tick()
  let deliveries=(await get('/api/followups')).deliveries
  assert.ok(pending.every(p=>deliveries.find(r=>r.id===p.id).state==='pending'))
  await at('2026-10-12T16:15:00Z');await app.tick()
  deliveries=(await get('/api/followups')).deliveries
  for(const p of pending) {const row=deliveries.find(r=>r.id===p.id);assert.equal(row.state,'uncertain');assert.match(row.detail,/No automatic resend/)}
  assert.equal(app.messages.length,mails)
  const audit=(await get('/api/audit')).entries
  for(const p of pending) assert.equal(audit.filter(a=>a.subject==='followup:'+p.id&&a.action==='followup.sent'&&a.outcome==='uncertain').length,1)
  await at('2026-10-12T16:20:00Z');await app.tick()
  assert.equal(app.messages.length,mails)
  const later=(await get('/api/audit')).entries
  for(const p of pending) assert.equal(later.filter(a=>a.subject==='followup:'+p.id&&a.action==='followup.sent'&&a.outcome==='uncertain').length,1)
 })
 await scenario('owner cancellation and the execution deadline stop delayed collectors and fence late writes',async()=>{
  for(const mode of ['cancel','deadline']) {
   await at(mode==='cancel'?'2026-10-13T12:00:00Z':'2026-10-14T12:00:00Z')
   let entered,release
   const arrived=new Promise(done=>entered=done),wait=new Promise(done=>release=done)
   hold={enter:entered,wait}
   const tick=app.tick();await arrived
   const row=(await allSteps()).find(r=>r.step==='collections'&&r.outcome==='running');assert.ok(row)
   if(mode==='cancel') {
    const refused=await app.fetch('/api/operations/'+row.id+'/cancel',{method:'POST',headers:{origin:'https://evil.test'}});assert.equal(refused.status,403)
    await owner('/api/operations/'+row.id+'/cancel',{},200)
   }
   await tick
   const finished=(await allSteps()).find(r=>r.id===row.id);assert.equal(finished.outcome,'unknown');assert.equal(finished.processed_count,null)
   const before=(await app.db.prepare('SELECT * FROM observations ORDER BY id').all()).results
   hold=null;release();await new Promise(done=>setTimeout(done,100))
   assert.deepEqual((await app.db.prepare('SELECT * FROM observations ORDER BY id').all()).results,before,'a late provider answer cannot become a new observation')
   assert.deepEqual((await allSteps()).find(r=>r.id===row.id),finished)
  }
 })
 await scenario('independent process death during collection and notification preserves claims and reconciles without replay',async()=>{
  for(const [edge,time] of [['collection','2026-10-15T16:00:00Z'],['notification','2026-10-16T16:00:00Z']]) {
   await at(time)
   const state=app.harnessState(),cookie=await app.fetch('/api/operations')
   assert.equal(cookie.status,200)
   // Capture the existing owner session via a fresh sign-in request instead of
   // creating any product role or bypass in the Worker.
   const origin=app.origin
   await app.mf.dispose()
   app.close=async()=>{}
   const child=fork(new URL('./helpers/ops-crash-child.mjs',import.meta.url),[],{detached:true,stdio:['ignore','ignore','ignore','ipc']})
   try {
    const arrived=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('interruption edge was not reached')),30000);child.once('message',msg=>{clearTimeout(timer);resolve(msg)});child.once('error',reject)})
    child.send({state,edge});assert.deepEqual(await arrived,{interrupted:edge})
   } finally {
    process.kill(-child.pid,'SIGKILL')
    await new Promise(done=>child.once('exit',done))
   }
   app=await runtime({...state,outbound})
   // Existing auth is retained; use the same real sign-in flow to obtain a
   // fresh session (bootstrap is already complete).
   const link=await app.fetch('/auth/magic-link',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({email:'owner@example.test'})});assert.equal(link.status,202)
   const token=new URL(app.messages.at(-1).html.match(/href="([^"]*\/auth\/confirm\?token=[^"]+)"/)[1].replaceAll('&amp;','&'),origin).searchParams.get('token')
   const confirmed=await app.fetch('/auth/confirm',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({token})});assert.equal(confirmed.status,303)
   app.setCookie(confirmed.headers.getSetCookie().map(x=>x.split(';')[0]).join('; '))
   const running=(await allSteps()).filter(r=>r.outcome==='running');assert.ok(running.length)
   const requests=github.requests.length,mails=app.messages.length
   await at(new Date(Date.parse(time)+15*60000).toISOString());await app.tick()
   for(const row of running)assert.equal((await allSteps()).find(r=>r.id===row.id).outcome,'unknown')
   if(edge==='notification')assert.equal(app.messages.length,mails,'interrupted delivery never automatically resent')
   else assert.equal(github.requests.length,requests,'no invented catch-up observation')
  }
 })
 await scenario('health exposes measured queue and storage, connector last success, backup state, limits and USD costs',async()=>{
  const h=await get('/api/operations')
  assert.ok(h.connectors.some(c=>c.id===connection.id&&c.last_success_at))
  assert.ok(h.queue.uncertain_deliveries>0)
  assert.equal(h.storage.bucket_read,'available');assert.equal(h.storage.listing_truncated,false)
  assert.equal(h.backup.latest_restore,null);assert.match(h.backup.external_copy,/Not verified/)
  assert.ok(h.limits.exhibit_mib>0)
  const page=await app.fetch('/app/operations');assert.equal(page.status,200)
  assert.match(await page.text(),/USD 0/)
  const blocked=await app.fetch('/app/requirements/00000000-0000-0000-0000-000000000000/uploads',{method:'POST',headers:{origin:app.origin,'content-type':'multipart/form-data; boundary=x','content-length':String(11*1024*1024)},body:'x'})
  assert.equal(blocked.status,413)
 })
 await scenario('complete backup retains operational history beside product facts and restores without replay',async()=>{
  const interrupted=crypto.randomUUID();await app.db.prepare("INSERT INTO operation_steps(id,step,scheduled_at,lease_until,outcome,detail) VALUES(?,'collections','2026-10-17T12:00:00.000Z','2026-10-17T12:15:00.000Z','running','')").bind(interrupted).run()
  const source=await allSteps(),r=await app.fetch('/api/archive/export');assert.equal(r.status,200)
  const bytes=await r.arrayBuffer(),target=await runtime()
  try {
   await target.signin()
   const restored=await target.fetch('/api/archive/restore',{method:'POST',headers:{origin:target.origin,'content-type':'application/octet-stream','x-evidence-confirm':'restore','x-evidence-erasure-history':'unverified acknowledged'},body:bytes})
   assert.equal(restored.status,200,await restored.text())
   const rows=(await target.db.prepare('SELECT * FROM operation_steps ORDER BY rowid').all()).results
   assert.deepEqual(rows.filter(r=>r.id!==interrupted),source.filter(r=>r.id!==interrupted))
   const lost=rows.find(r=>r.id===interrupted);assert.equal(lost.outcome,'unknown');assert.match(lost.detail,/Interrupted at backup/)
   const report=await(await target.fetch('/api/operations')).json();assert.equal(report.backup.latest_restore.state,'complete')
   const before=target.messages.length;await target.tick();assert.equal(target.messages.length,before)
  } finally {await target.close()}
 })
} finally { await app.close() }
