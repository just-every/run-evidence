import assert from 'node:assert/strict'
import { runtime } from './runtime.mjs'
import { tailoringFixture } from './tailoring-journey.mjs'
import { fakeModel } from './model-fixture.mjs'
// AGENT-006 interpretation through the public doors. Only the model provider is
// faked, at the network edge: it answers from the exact payload it receives, and
// the journey checks what it was and was not sent.
const KEY = 'synthetic-evidence-model-key-0101', NEXT = 'synthetic-evidence-model-key-0102'
export async function interpretationJourney() {
 const model = fakeModel(), calls = model.calls, outbound = model.outbound
 const setMode = model.mode
 const app = await runtime({ outbound })
 try {
  const owner = await app.signin(), f = await tailoringFixture(app, 'interpret'), post = f.post
  const raw = (path, body, cookie = owner) => app.fetch(path, { method: 'POST', headers: { cookie, origin: app.origin, 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const counts = async () => ({ mappings: (await app.db.prepare('SELECT count(*) AS n FROM custom_framework_mappings').first()).n, risks: (await app.db.prepare('SELECT count(*) AS n FROM risks').first()).n, obligations: (await app.db.prepare('SELECT count(*) AS n FROM tailored_obligations').first()).n, proposals: (await app.db.prepare('SELECT count(*) AS n FROM tailoring_proposals').first()).n })
  const input = (q, extra = {}) => { const { likelihood, impact, assumptions, ...rest } = f.input; return { ...rest, requirement_id: q.id, likelihood: '', impact: '', assumptions: '', ...extra } }
  const interpret = (q, extra, cookie) => raw('/api/tailoring/interpret', input(q, extra), cookie)
  const base = await counts()
  // 1. No declared flow, no call.
  let refused = await interpret(f.requirements[0]); assert.equal(refused.status, 409); assert.match((await refused.json()).error, /No enabled model flow/); assert.equal(calls.length, 0)
  // 2. A flow declared for fewer data classes than the interpretation needs sends nothing and is a suspected disclosure.
  const declaration = { provider: 'anthropic', model: 'synthetic-model', purpose: 'policy-tailoring', retention: 'No retention', region: 'us', account: 'org-synthetic-1', api_key: KEY }
  const narrow = await (await raw('/api/connections/flows', { ...declaration, data_classes: ['policy text'] })).json()
  assert.equal((await raw(`/api/connections/flows/${narrow.id}/enable`, { declaration_sha256: narrow.declaration_sha256 })).status, 200)
  refused = await interpret(f.requirements[0]); assert.equal(refused.status, 409); assert.match((await refused.json()).error, /not in the declared data classes/); assert.equal(calls.length, 0)
  assert.ok((await (await app.fetch('/api/connections/flows')).json()).disclosures.some(e => e.kind === 'undeclared-data-class'))
  assert.equal((await raw(`/api/connections/flows/${narrow.id}/disable`, {})).status, 200)
  const full = await (await raw('/api/connections/flows', { ...declaration, data_classes: ['customer contract text', 'framework text', 'policy text', 'asset inventory', 'risk method'] })).json()
  assert.equal((await raw(`/api/connections/flows/${full.id}/enable`, { declaration_sha256: full.declaration_sha256 })).status, 200)
  assert.deepEqual(await counts(), base, 'nothing was recorded so far')
  // 3. The interpretation: cited, with proposed control, policy and risk diffs, and an ambiguous obligation; no downstream effect.
  const first = await (await interpret(f.requirements[0])).json(), ambiguous = await (await interpret(f.requirements[1])).json()
  assert.equal(calls.length, 2); assert.equal(calls[0].key, KEY)
  const sent = calls[0].raw
  for (const secret of [KEY, f.token.token, 'SESSION_SECRET']) assert.ok(!sent.includes(secret), 'no secret leaves in the payload')
  assert.ok(!sent.includes(f.requirements[1].description ?? 'Encrypt production data'), 'only the selected promise is sent')
  assert.deepEqual(Object.keys(calls[0].payload).sort(), ['approved_policy', 'candidate_control', 'customer_promise', 'framework_requirement', 'in_scope_assets', 'risk_method'])
  const s = (await f.get('/api/tailoring/' + first.id)).snapshot
  assert.equal(s.interpretation.origin, 'model'); assert.equal(s.interpretation.flow, full.id); assert.equal(s.deadline, '2026-12-31'); assert.equal(s.mapping.control_id, f.control)
  assert.ok(s.policy_diff.after.includes('Draft 1')); assert.ok(s.policy_diff.before !== s.policy_diff.after); assert.ok(s.conflicts.length)
  const quotes = s.citations.filter(c => c.kind === 'model-quote'); assert.equal(quotes.length, 2)
  for (const c of s.citations.filter(c => c.href)) assert.equal((await app.fetch(c.href)).status, 200, 'the source citation resolves to the original clause')
  for (const q of quotes) assert.ok(s.citations.find(c => c.kind !== 'model-quote' && (c.ref && (q.source === 'contract-promise' ? c.kind === 'contract-promise' : c.kind === 'framework-requirement'))).passage.replace(/\s+/g, ' ').toLowerCase().includes(q.quote.replace(/\s+/g, ' ').toLowerCase()), 'the quote is verbatim')
  const amb = (await f.get('/api/tailoring/' + ambiguous.id)).snapshot; assert.equal(amb.ambiguous, true); assert.equal(amb.deadline, null); assert.ok(amb.assumptions.includes('No deadline is stated'))
  assert.deepEqual({ ...await counts(), proposals: 0 }, { ...base, proposals: 0 }, 'interpretation changes no program record')
  // 4. Source text and model output grant no authority; bad output is refused whole.
  setMode('injected'); const before = await counts(); const inj = await interpret(f.requirements[2]); assert.equal(inj.status, 201)
  const injected = (await f.get('/api/tailoring/' + (await inj.json()).id)).snapshot; assert.ok(!('approve' in injected) && !JSON.stringify(injected).includes('attacker@example.test'))
  assert.deepEqual({ ...await counts(), proposals: 0 }, { ...before, proposals: 0 }); assert.equal((await app.db.prepare('SELECT count(*) AS n FROM tailoring_decisions').first()).n, 0)
  setMode('bad-citation'); const bad = await interpret(f.requirements[2]); assert.equal(bad.status, 422); assert.match((await bad.json()).error, /does not quote its source/)
  setMode('error'); const failed = await interpret(f.requirements[2]); assert.equal(failed.status, 502); assert.match((await failed.json()).error, /Nothing was recorded/)
  setMode('good')
  // 5. A payload that carries a credential is never sent.
  await post(`/api/frameworks/${f.framework.id}/requirements`, { ref: 'US-9', title: 'Credential in source', description: 'Rotate the key; password: synthetic-evidence-credential-0001 must change.' }).then(async q => { const n = calls.length; const r = await interpret(q); assert.equal(r.status, 409); assert.match((await r.json()).error, /carries a credential/); assert.equal(calls.length, n) })
  assert.ok((await (await app.fetch('/api/connections/flows')).json()).disclosures.some(e => e.kind === 'secret-in-payload'))
  // 6. Rotate the provider key: the next call uses it. Custody unavailable: the call fails explicitly and sends nothing.
  assert.equal((await raw(`/api/connections/flows/${full.id}/key`, { api_key: NEXT })).status, 200)
  const second = await (await interpret(f.requirements[0])).json(); assert.equal(calls.at(-1).key, NEXT)
  await app.setSettings({ CUSTODY_SESSION_KEY_RETIRED: 'yes' })
  const n = calls.length, lost = await interpret(f.requirements[0]); assert.equal(lost.status, 503); assert.match((await lost.json()).error, /Key custody unavailable: nothing was sent/); assert.equal(calls.length, n)
  assert.ok((await app.db.prepare("SELECT 1 FROM flow_calls WHERE outcome='failed' AND detail LIKE 'Key custody unavailable%'").first()))
  await app.setSettings({ CUSTODY_SESSION_KEY_RETIRED: undefined })
  // 7. Reject one interpretation and approve another: only the approved exact revision enters the program.
  const reviewer = f.owner, decide = (p, extra = {}, cookie = owner) => raw(`/api/tailoring/${p.id}/decision`, { snapshot_hash: p.snapshot_hash, decision: 'approved', approver_person_id: reviewer.id, reason: 'Reviewed exact citations, inventory, policy diff and risk', ...extra }, cookie)
  assert.equal((await decide(first, { decision: 'rejected' })).status, 200); assert.deepEqual({ ...await counts(), proposals: 0 }, { ...base, proposals: 0 }, 'rejection changes nothing')
  const approved = await (await decide(second)).json(); assert.equal(approved.decision, 'approved')
  const draft = await f.get(`/api/policies/${f.policy.policy}/revisions/${approved.policy_revision_id}`); assert.equal(draft.body, (await f.get('/api/tailoring/' + second.id)).snapshot.policy_diff.after, 'the approved draft text is the approved proposal')
  assert.equal(draft.status, 'draft'); assert.equal(draft.published_at, null)
  assert.ok(!draft.body.includes((await f.get('/api/tailoring/' + first.id)).snapshot.policy_diff.after.split('\n\n').at(-1)), 'the rejected interpretation did not enter the program')
  assert.equal((await app.db.prepare('SELECT count(*) AS n FROM tailored_obligations').first()).n, 1)
  // 8. The reviewer role check: a name in People holds no reviewing role; a granted compliance manager does; nobody approves what they prepared.
  const nobody = await post('/api/people', { name: 'Nina NoRole', email: 'nina@example.test', kind: 'employee' })
  const third = await (await interpret(f.requirements[1])).json()
  let r = await decide(third, { approver_person_id: nobody.id, acknowledge_ambiguity: 'yes' }); assert.equal(r.status, 403); assert.match((await r.json()).error, /no security or legal reviewing role/)
  const invite = async (email, name) => { assert.equal((await raw('/api/roles/invitations', { email, display_name: name })).status, 202); const link = new URL(app.messages.at(-1).html.match(/href="([^"]*\/auth\/confirm\?token=[^"]+)"/)[1].replaceAll('&amp;', '&'), app.origin); const c = await app.fetch('/auth/confirm', { method: 'POST', headers: { cookie: '', origin: app.origin, 'content-type': 'application/json' }, body: JSON.stringify({ token: link.searchParams.get('token') }) }); return c.headers.getSetCookie().map(x => x.split(';')[0]).join('; ') }
  const manager = await invite('manager@example.test', 'Maya Manager'), admin = await invite('admin@example.test', 'Alex Admin')
  const maya = await post('/api/people', { name: 'Maya Manager', email: 'manager@example.test', kind: 'employee' }), alex = await post('/api/people', { name: 'Alex Admin', email: 'admin@example.test', kind: 'employee' })
  for (const [email, role] of [['manager@example.test', 'compliance_manager'], ['admin@example.test', 'administrator']]) assert.equal((await raw('/api/roles/grants', { email, role, scope_kind: 'business', reason: 'Reviews tailoring' })).status, 201)
  const mine = await (await interpret(f.requirements[2], {}, manager)).json()
  r = await decide(mine, { approver_person_id: maya.id }, manager); assert.equal(r.status, 403, 'the preparer cannot approve their own proposal'); assert.match((await r.json()).error, /own work/)
  r = await decide(mine, { approver_person_id: alex.id, acknowledge_ambiguity: 'yes' }, admin); assert.equal(r.status, 200, await r.clone().text())
  assert.ok((await (await app.fetch('/api/audit')).text()).includes('named reviewer Alex Admin (administrator)'))
  console.log('PASS AGENT-006 interpretation: declared flow gate, verbatim citations, ambiguity, no authority from source text, rotated key, unavailable custody, reject one and approve another, reviewer role check')
 } finally { await app.close() }
}
