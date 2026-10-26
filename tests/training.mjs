import { trainingBrowser } from './helpers/training-browser.mjs'
// Shipped training, campaigns, assessments and completion sources through
// public doors: owner JSON doors, Base invitations and member sign-in for
// learners, the employee door, the Connections door for KnowBe4 and the Cron
// Trigger. Mail and KnowBe4 are the only fakes, at the network edge.
process.env.RER_SERVER_JOURNEY = '1'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { randomBytes } from 'node:crypto'
import { runtime } from './helpers/runtime.mjs'
import { collectionScheduleBrowser } from './helpers/collection-schedule-browser.mjs'
import { collectionScheduleJourney } from './helpers/collection-schedule-journey.mjs'
const require = createRequire(import.meta.url)
const { build } = createRequire(require.resolve('wrangler/package.json'))('esbuild')
const bundled = await build({ entryPoints: ['src/evidence/training/courses.ts'], bundle: true, write: false, format: 'esm', platform: 'neutral' })
const { courses } = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'))
const key = randomBytes(20).toString('hex')
const knowbe4 = [
 { enrollment_id: 501, module_name: '2026 Security Awareness Training', user: { email: 'kim@northstar.test' }, completion_date: '2026-10-11T12:15:00Z', status: 'Passed' },
 { enrollment_id: 502, module_name: '2026 Security Awareness Training', user: { email: 'omar@northstar.test' }, completion_date: null, status: 'In Progress' },
]
let enrollmentResponse = null
async function fakeKnowBe4(request) {
 const url = new URL(request.url)
 if (url.hostname !== 'us.api.knowbe4.com') return null
 if (request.headers.get('authorization') !== 'Bearer ' + key) return Response.json({ message: 'Unauthorized' }, { status: 401 })
 if (url.pathname === '/v1/account') return Response.json({ name: 'Northstar' })
 if (url.pathname === '/v1/training/enrollments' && enrollmentResponse) return enrollmentResponse(Number(url.searchParams.get('page')))
 if (url.pathname === '/v1/training/enrollments') return Response.json(url.searchParams.get('page') === '1' ? knowbe4 : [])
 return null
}
const app = await runtime({ outbound: fakeKnowBe4 })
let passed = 0
const scenario = async (name, fn) => { await fn(); passed++; console.log('PASS ' + name) }
const post = async (path, body, status = 201) => { const r = await app.fetch(path, { method: 'POST', headers: { origin: app.origin, 'content-type': 'application/json' }, body: JSON.stringify(body) }); const text = await r.text(); assert.equal(r.status, status, path + ' ' + text); return text ? JSON.parse(text) : null }
const get = async path => { const r = await app.fetch(path); assert.equal(r.status, 200, path); return r.json() }
const course = id => courses.find(c => c.id === id)
async function acceptInvitation(email) {
 const mail = app.messages.filter(m => m.to?.includes(email)).at(-1)
 const token = new URL(mail.html.match(/href="([^"]*\/auth\/confirm\?token=[^"]+)"/)[1].replaceAll('&amp;', '&'), app.origin).searchParams.get('token')
 app.setCookie('')
 const confirmed = await app.fetch('/auth/confirm', { method: 'POST', headers: { origin: app.origin, 'content-type': 'application/json' }, body: JSON.stringify({ token }) })
 assert.equal(confirmed.status, 303)
 return confirmed.headers.getSetCookie().map(x => x.split(';')[0]).join('; ')
}
const people = {}
let ownerCookie, nina
const assignmentsOf = async email => (await get('/api/training')).assignments.filter(a => a.email === email)
try {
 await scenario('Courses unlock with their programs and roles and apply only once adopted; a new hire fails the assessment once, passes the retake, and both attempts are kept', async () => {
  ownerCookie = await app.signin()
  let avail = Object.fromEntries((await get('/api/training')).courses.map(c => [c.id, c.available]))
  assert.deepEqual(avail, { 'security-awareness': true, 'hipaa-workforce': false, 'secure-coding': false })
  await post('/api/programs', { framework: 'soc2', name: 'SOC 2', legal_entity: 'Northstar', report_type: 'Type II', audit_from: '2026-07-01', audit_to: '2027-06-30' })
  avail = Object.fromEntries((await get('/api/training')).courses.map(c => [c.id, c.available]))
  assert.deepEqual(avail, { 'security-awareness': true, 'hipaa-workforce': false, 'secure-coding': true })
  await post('/api/training/campaigns', { name: 'HIPAA', course_id: 'hipaa-workforce', kind: 'recurring', audience: 'everyone' }, 409)
  await post('/api/programs', { framework: 'hipaa', name: 'HIPAA', legal_entity: 'Northstar', audit_from: '2026-07-01', audit_to: '2027-06-30' })
  assert.equal((await get('/api/training')).courses.find(c => c.id === 'hipaa-workforce').available, true)
  await post('/api/training/campaigns', { name: 'Awareness onboarding', course_id: 'security-awareness', kind: 'onboarding', audience: 'everyone', due_days: '14' }, 409)
  for (const id of ['security-awareness', 'secure-coding']) await post(`/api/training/courses/${id}/adopt`, {}, 200)
  for (const [k, name, kind] of [['omar', 'Omar Haddad', 'employee'], ['pat', 'Pat Lee', 'employee'], ['kim', 'Kim Wu', 'contractor'], ['dee', 'Dee Lane', 'employee']]) people[k] = (await post('/api/people', { name, email: k + '@northstar.test', kind })).id
  await post('/api/training/campaigns', { name: 'Awareness onboarding', course_id: 'security-awareness', kind: 'onboarding', audience: 'everyone', due_days: '14' })
  await post('/api/training/campaigns', { name: 'Annual awareness', course_id: 'security-awareness', kind: 'recurring', audience: 'everyone', due_days: '14', interval_months: '12' })
  await post('/api/training/campaigns', { name: 'Secure coding', course_id: 'secure-coding', kind: 'recurring', audience: 'everyone' }, 400)
  await post('/api/training/campaigns', { name: 'Secure coding', course_id: 'secure-coding', kind: 'recurring', audience: 'engineering', due_days: '30' })
  await app.clock('2026-10-11T12:30:00Z')
  nina = (await post('/api/people', { name: 'Nina Park', email: 'nina@northstar.test', kind: 'employee', role: 'engineering' })).id
  await app.tick()
  assert.deepEqual((await assignmentsOf('nina@northstar.test')).map(a => `${a.campaign}:${a.course_id}`).sort(), ['Annual awareness:security-awareness', 'Awareness onboarding:security-awareness', 'Secure coding:secure-coding'])
  assert.deepEqual((await assignmentsOf('omar@northstar.test')).map(a => a.campaign), ['Annual awareness'])
  await post(`/api/people/${nina}/invite`, {}, 202)
  app.setCookie(await acceptInvitation('nina@northstar.test'))
  const shown = await get('/api/me/training/security-awareness')
  assert.equal(shown.lessons.length, 5); assert.ok(shown.quiz.every(q => !('answer' in q)))
  const right = course('security-awareness').quiz.map(q => q.answer), wrong = right.map((a, i) => i < 3 ? (a + 1) % 4 : a)
  for (const fields of [{}, Object.fromEntries(right.map((a, i) => [`answers[${i}]`, i === 4 ? '' : String(a)]))]) {
   const incomplete = await app.fetch('/me/training/security-awareness/attempts', { method: 'POST', headers: { origin: app.origin, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields) }); assert.equal(incomplete.status, 400)
  }
  const fail = await post('/api/me/training/security-awareness/attempts', { answers: wrong })
  assert.deepEqual([fail.score, fail.passed], [70, false])
  assert.ok((await get('/api/me')).training.some(t => t.course_id === 'security-awareness' && t.state === 'assigned'))
  const pass = await post('/api/me/training/security-awareness/attempts', { answers: right })
  assert.deepEqual([pass.score, pass.passed], [100, true])
  assert.ok((await get('/api/me')).training.filter(t => t.course_id === 'security-awareness').every(t => t.state === 'completed'))
  await post('/api/me/training/security-awareness/attempts', { answers: right }, 404)
  app.setCookie(ownerCookie)
  const record = await get('/api/training')
  assert.deepEqual(record.attempts.filter(a => a.email === 'nina@northstar.test').map(a => [a.score, a.passed]), [[70, 0], [100, 1]])
  assert.equal(record.completions.find(c => c.email === 'nina@northstar.test').provenance, 'assessment graded in Evidence')
 })
 await scenario('Approved internal training is manual, KnowBe4 completions are source-reported and never invented, overdue learners are reminded and escalated, and a schedule change is recorded', async () => {
  await post('/api/followups/settings', { timezone: 'America/New_York', business_days: ['1', '2', '3', '4', '5'], quiet_start: '18:00', quiet_end: '09:00', repeat_days: '0', escalate_after_days: '3', escalation_person_id: people.dee, digest_enabled: 'off', digest_day: '1', digest_time: '09:00' }, 200)
  const internal = await post('/api/training/internal', { title: 'Security town hall 2026', description: 'Live session covering the awareness curriculum, with attendance taken', counts_as: 'security-awareness' })
  await post(`/api/training/internal/${internal.id}/completions`, { person_id: people.pat, completed_on: '2026-10-11' })
  await post('/api/connections', { provider: 'knowbe4', region: 'us', secret: 'wrong-key' }, 400)
  await post('/api/connections', { provider: 'knowbe4', region: 'us', secret: key, module_map: '2026 Security Awareness Training = Security awareness' })
  await app.tick()
  const status = Object.fromEntries((await get('/api/training')).assignments.filter(a => a.campaign === 'Annual awareness').map(a => [a.email, [a.status, a.provenance]]))
  assert.deepEqual(status['pat@northstar.test'], ['completed', 'manual: approved internal course recorded by Evidence owner'])
  assert.deepEqual(status['kim@northstar.test'], ['completed', 'source-reported by KnowBe4 (Passed)'])
  assert.equal(status['omar@northstar.test'][0], 'assigned')
  assert.equal((await get('/api/training')).completions.filter(c => c.email === 'omar@northstar.test').length, 0)
  await app.clock('2026-10-29T15:00:00Z'); await app.tick()
  assert.equal(app.messages.filter(m => m.to.includes('omar@northstar.test') && /Overdue: Security awareness training/.test(m.subject)).length, 1)
  assert.equal(app.messages.filter(m => m.to.includes('dee@northstar.test') && /Escalation: Omar Haddad has not completed Security awareness/.test(m.subject)).length, 1)
  const t = (await get('/api/tests')).tests.find(x => x.catalogue_id === 'training.current')
  assert.equal((await get('/api/tests/' + t.id)).latest.find(o => o.display_name.startsWith('Omar')).result, 'fail')
  const campaign = (await get('/api/training')).campaigns.find(c => c.name === 'Annual awareness')
  await post(`/api/training/campaigns/${campaign.id}/schedule`, { due_days: '45', reason: 'Extended for the Q4 release freeze' }, 200)
  assert.equal((await assignmentsOf('omar@northstar.test')).find(a => a.campaign === 'Annual awareness').status, 'assigned')
  await app.tick()
  assert.equal((await get('/api/tests/' + t.id)).latest.find(o => o.display_name.startsWith('Omar')).result, 'pass')
  const csv = await (await app.fetch('/app/training/export.csv')).text()
  assert.match(csv, /source-reported by KnowBe4/); assert.match(csv, /manual: approved internal course/)
  const exported = await get('/api/training/export')
  assert.deepEqual([...new Set(exported.completions.map(c => c.source))].sort(), ['evidence', 'internal', 'knowbe4'])
  assert.deepEqual(exported.attempts.filter(a => a.email === 'nina@northstar.test').map(a => [a.revision, a.score, a.passed]), [[1, 70, 0], [1, 100, 1]])
  assert.equal(exported.completions.filter(c => c.email === 'omar@northstar.test').length, 0)
  await app.clock('2026-10-29T15:00:00Z')
  await trainingBrowser(app, ownerCookie, course('security-awareness').quiz.map(q => q.answer))
 })
 await scenario('COLLECTION-001: KnowBe4 malformed completion facts, repeated or exhausted pages and throttling never admit a partial completion set; recovery deduplicates originals', async () => {
  const connection = (await get('/api/connections')).connections.find(c => c.provider === 'knowbe4'), path = '/api/connections/' + connection.id
  let time = Date.parse((await get(path)).runs[0].started_at)
  const collect = async () => { time += 60000; await app.clock(new Date(time).toISOString()); return post(path + '/collect', {}) }
  const original = (await get('/api/training')).completions
  const counts={first:0,second:0};let throttle=true
  enrollmentResponse=page=>{if(page===1){counts.first++;return Response.json([knowbe4[0],...Array.from({length:499},(_,i)=>({...knowbe4[1],enrollment_id:10000+i}))])}counts.second++;return throttle?Response.json({},{status:429}):Response.json([])}
  time+=60000;await app.clock(new Date(time).toISOString());await post(path+'/collect',{})
  const interrupted=(await get(path)).runs[0]
  assert.equal(interrupted.outcome,'throttled');assert.deepEqual((await get('/api/training')).completions,original)
  throttle=false;time+=300000;await app.clock(new Date(time).toISOString());await post(path+'/collect',{})
  assert.equal((await get(path)).runs[0].outcome,'complete');assert.equal(counts.first,1);assert.equal(counts.second,2)
  assert.equal(JSON.parse((await get(path)).runs[0].coverage_json).source_read_started_at,interrupted.started_at)
  assert.deepEqual((await get(path)).runs.find(r=>r.id===interrupted.id),interrupted)
  assert.deepEqual((await get('/api/training')).completions,original)
  enrollmentResponse=null
  const failures = []
  for (const body of [null, {}, [null], [{ ...knowbe4[0], enrollment_id: '501' }], [{ ...knowbe4[0], user: {} }], [{ ...knowbe4[0], completion_date: 'not a timestamp' }], [{ ...knowbe4[0], completion_date: null }], [{ ...knowbe4[0], status: 'Not Completed' }]]) {
   enrollmentResponse = () => Response.json(body)
   assert.equal((await collect()).outcome,'partial')
   const run = (await get(path)).runs[0]; failures.push(run); assert.match(run.coverage_json,/schema drift/)
   assert.deepEqual((await get('/api/training')).completions,original)
  }
  enrollmentResponse = page => Response.json(Array.from({ length: 500 }, (_,i) => ({ ...knowbe4[0], enrollment_id: i + 1000 })))
  assert.equal((await collect()).outcome,'partial')
  failures.push((await get(path)).runs[0]); assert.match(failures.at(-1).coverage_json,/repeated enrollment/)
  assert.deepEqual((await get('/api/training')).completions,original)
  await post(path+'/rotate',{secret:key},200)
  enrollmentResponse = page => Response.json(Array.from({ length: 500 }, (_,i) => ({ ...knowbe4[0], enrollment_id: page * 500 + i + 1000 })))
  assert.equal((await collect()).outcome,'partial')
  failures.push((await get(path)).runs[0]); assert.match(failures.at(-1).coverage_json,/50 full pages/)
  assert.deepEqual((await get('/api/training')).completions,original)
  await post(path+'/rotate',{secret:key},200)
  enrollmentResponse = () => Response.json({}, { status:429 })
  assert.equal((await collect()).outcome,'throttled')
  failures.push((await get(path)).runs[0]); assert.ok((await get(path)).connection.next_attempt_at > new Date(time).toISOString())
  enrollmentResponse = null
  assert.equal((await collect()).outcome,'complete'); assert.deepEqual((await get('/api/training')).completions,original)
  const history = (await get(path)).runs
  for (const run of failures) assert.deepEqual(history.find(r=>r.id===run.id),run)
  await collectionScheduleBrowser(app, [(await get(path)).connection], { suffix:'-knowbe4-schema', reportExpected:['knowbe4:enrollments'] })
 })
 await scenario('COLLECTION-001: hosted collector schedules through owner doors, Cron, browser and restore', () => collectionScheduleJourney(app))
 console.log(`${passed} training public-door scenarios passed with Base invitations and member sign-in.`)
} finally { await app.close() }
