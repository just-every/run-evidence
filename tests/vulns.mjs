// VULN-002 penetration-test findings through public doors: the reviewed
// CSV import with its PDF report, manual provenance and fixed SLA due dates,
// retest-verified closure, readiness, the vulnerability-remediation population
// and custody restore, on real workerd, D1 and R2. Only mail is faked.
process.env.RER_SERVER_JOURNEY = '1'
import assert from 'node:assert/strict'
import { runtime } from './helpers/runtime.mjs'
const app = await runtime()
let passed = 0
const scenario = async (name, fn) => { await fn(); passed++; console.log('PASS ' + name) }
const post = async (path, body, status = 201) => { const r = await app.fetch(path, { method: 'POST', headers: { origin: app.origin, 'content-type': 'application/json' }, body: JSON.stringify(body) }); const text = await r.text(); assert.equal(r.status, status, path + ' ' + text); return text ? JSON.parse(text) : null }
const get = async path => { const r = await app.fetch(path); assert.equal(r.status, 200, path); return r.json() }
const pdf = Buffer.from('%PDF-1.7\n% Northstar external penetration test, Bishop Fox, 2026-10-01\n%%EOF\n')
const header = 'Finding,Severity,Affected host,Description,CVE,CWE,Recommended fix'
const rows = [
 ['SQL injection in search', 'Critical', 'api.northstar.test', 'Unparameterized query', 'CVE-2026-1001', 'CWE-89', 'Use bound parameters'],
 ['Stored XSS in comments', 'High', 'app.northstar.test', 'Unescaped markup', '', 'CWE-79', 'Escape output'],
 ['Weak TLS ciphers', 'medium', 'vpn.northstar.test', 'CBC suites offered', '', 'CWE-327', 'Disable CBC'],
 ['Missing rate limit on login', 'Medium', 'api.northstar.test', 'Unlimited attempts', '', 'CWE-307', 'Throttle'],
 ['Verbose errors', 'Low', 'api.northstar.test', 'Stack traces returned', '', 'CWE-209', 'Generic errors'],
 ['Outdated nginx', 'High', 'edge.northstar.test', 'Known CVE', 'CVE-2026-1002', '', 'Upgrade'],
 ['IDOR on invoices', 'Critical', 'api.northstar.test', 'Object ids not checked', '', 'CWE-639', 'Authorize each read'],
 ['Session not rotated', 'Medium', 'app.northstar.test', 'Fixation possible', '', 'CWE-384', 'Rotate on sign-in'],
 ['Open S3 listing', 'High', 'assets.northstar.test', 'Bucket lists keys', '', 'CWE-284', 'Block public access'],
 ['Default admin path', 'Low', 'app.northstar.test', 'Admin path guessable', '', '', 'Move or protect'],
 ['Clickjacking', 'Low', 'app.northstar.test', 'No frame-ancestors', '', 'CWE-1021', 'Set CSP frame-ancestors'],
 ['Unrated observation', '', 'app.northstar.test', 'No severity given', '', '', ''],
]
const csv = [header, ...rows.map(r => r.join(','))].join('\r\n') + '\r\n'
const base = { tester: 'Bishop Fox', report_date: '2026-10-01', map_title: 'Finding', map_asset: 'Affected host' }
async function importFindings(fields, status) {
 const form = new FormData()
 for (const [k, v] of Object.entries(fields)) form.append(k, v)
 form.append('file', new Blob([csv], { type: 'text/csv' }), 'bishop-fox-findings.csv')
 form.append('report', new Blob([pdf], { type: 'application/pdf' }), 'bishop-fox-2026.pdf')
 const r = await app.fetch('/api/vulnerabilities/import', { method: 'POST', headers: { origin: app.origin }, body: form })
 const text = await r.text(); assert.equal(r.status, status, text)
 return JSON.parse(text)
}
const pentestControl = ready => ready.requirements.flatMap(r => r.controls).find(c => c.library_id === 'OPS-05')
let program, sqli, imported
try {
 await scenario('VULN-002: a 12-row pentest CSV with its PDF is dry-run, the missing-severity row is refused and nothing is admitted until confirmed; 11 manual findings get tester, report date, asset links and SLA due dates from the policy in force on the report date', async () => {
  await app.signin()
  await app.clock('2026-09-20T12:00:00Z')
  program = (await post('/api/programs', { framework: 'soc2', name: 'SOC 2', legal_entity: 'Northstar', report_type: 'Type II', audit_from: '2026-10-01', audit_to: '2027-09-30' })).id
  const push = await post('/api/api-tokens', { name: 'Asset export', scopes: ['resource-push'], expires_at: '2027-04-01' })
  const v1 = (method, path, body) => app.fetch(path, { method, headers: { authorization: 'Bearer ' + push.token, 'content-type': 'application/json' }, body: JSON.stringify(body) })
  assert.equal((await v1('PUT', '/v1/resource-types/web_host', { schema: { fields: { tls: 'boolean' } } })).status, 200)
  const pushed = await app.fetch('/v1/resources/web_host', { method: 'PUT', headers: { authorization: 'Bearer ' + push.token, 'content-type': 'application/json' }, body: JSON.stringify({ resources: [{ uniqueId: 'api.northstar.test', displayName: 'Public API', attributes: { tls: true } }] }) })
  assert.equal(pushed.status, 200, await pushed.text())
  assert.notEqual(pentestControl((await get('/api/programs/' + program)).readiness).evidence[0].gap, 'covered')
  // The critical SLA becomes 7 days after the report date: the report's findings keep the 15 days in force then.
  await app.clock('2026-10-10T12:00:00Z')
  await post('/api/remediation/sla', { category: 'vulnerability', severity: 'critical', days: '7' })
  await app.clock('2026-10-12T12:00:00Z')

  const dry = await importFindings(base, 200)
  assert.equal(dry.dry_run, true); assert.equal(dry.total, 12); assert.equal(dry.admit, 11); assert.equal(dry.refuse, 1)
  assert.deepEqual(dry.rows.filter(r => r.reasons.length).map(r => [r.row, r.reasons]), [[13, ['severity is required']]])
  assert.equal(dry.mapping.title, 'Finding'); assert.equal(dry.mapping.asset, 'Affected host'); assert.equal(dry.mapping.cve, 'CVE')
  assert.deepEqual((await get('/api/vulnerabilities')).findings, [])
  await importFindings({ ...base, confirm: 'yes', sha256: dry.sha256, report_sha256: 'a'.repeat(64) }, 409)
  assert.deepEqual((await get('/api/vulnerabilities')).findings, [])

  imported = await importFindings({ ...base, confirm: 'yes', sha256: dry.sha256, report_sha256: dry.report_sha256 }, 201)
  assert.equal(imported.admitted, 11); assert.equal(imported.refused, 1)
  const { findings } = await get('/api/vulnerabilities')
  assert.equal(findings.length, 11)
  for (const f of findings) { assert.equal(f.provenance, 'manual'); assert.equal(f.tester, 'Bishop Fox'); assert.equal(f.report_date, '2026-10-01'); assert.equal(f.state, 'open'); assert.equal(f.report_filename, 'bishop-fox-2026.pdf') }
  assert.ok(!findings.some(f => f.title === 'Unrated observation'))
  sqli = findings.find(f => f.title === 'SQL injection in search')
  assert.deepEqual([sqli.severity, sqli.cve, sqli.cwe, sqli.sla_days, sqli.due_date, sqli.recommended_fix], ['critical', 'CVE-2026-1001', 'CWE-89', 15, '2026-10-16', 'Use bound parameters'])
  assert.deepEqual(Object.fromEntries(['High', 'medium', 'Low'].map(s => [s, findings.find(f => f.severity === s.toLowerCase()).due_date])), { High: '2026-10-31', medium: '2026-11-30', Low: '2026-12-30' })
  assert.ok(sqli.resource_id); assert.match(sqli.resource_label, /Public API/)
  assert.equal(findings.find(f => f.title === 'Weak TLS ciphers').resource_id, null)
  // A later policy change never moves an existing due date.
  await post('/api/remediation/sla', { category: 'vulnerability', severity: 'high', days: '5' })
  assert.equal((await get('/api/vulnerabilities/' + sqli.id)).finding.due_date, '2026-10-16')
  assert.equal((await get('/api/vulnerabilities')).findings.find(f => f.title === 'Outdated nginx').due_date, '2026-10-31')

  // The PDF is an immutable receipt on the penetration-test requirement, satisfying its annual cadence.
  const receipt = await app.fetch(`/app/receipts/${imported.receipt}/download`)
  assert.deepEqual(Buffer.from(await receipt.arrayBuffer()), pdf)
  assert.equal(pentestControl((await get('/api/programs/' + program)).readiness).evidence[0].gap, 'covered')
  const page = await (await app.fetch('/app/vulnerabilities')).text()
  assert.match(page, /SQL injection in search/); assert.match(page, /manual/); assert.match(page, /Bishop Fox/)
  const totals = (await get('/api/programs/' + program)).readiness.totals
  assert.deepEqual([totals.pentest_open, totals.pentest_awaiting_verification, totals.pentest_past_due], [11, 0, 0])
 })
 await scenario('VULN-002: marking a finding fixed leaves it awaiting verification; it closes only when a reviewer approves the attached retest letter, keeping the original finding and report; the population lists every finding with its provenance', async () => {
  const fixed = await post(`/api/vulnerabilities/${sqli.id}/fixed`, { note: 'Parameterized in release 4.2' }, 200)
  assert.equal(fixed.state, 'awaiting verification')
  assert.equal((await get('/api/vulnerabilities/' + sqli.id)).finding.state, 'awaiting verification')
  await post(`/api/vulnerabilities/${sqli.id}/fixed`, {}, 409)
  await post(`/api/vulnerabilities/${sqli.id}/retests/${sqli.id}/decision`, { decision: 'approved' }, 404)
  await app.clock('2026-10-20T12:00:00Z')
  let totals = (await get('/api/programs/' + program)).readiness.totals
  assert.deepEqual([totals.pentest_open, totals.pentest_awaiting_verification, totals.pentest_past_due], [11, 1, 2])

  const letter = Buffer.from('%PDF-1.7\n% Bishop Fox retest letter: SQL injection no longer reproducible\n%%EOF\n')
  const attach = async () => { const form = new FormData(); form.append('file', new Blob([letter], { type: 'application/pdf' }), 'retest-letter.pdf'); const r = await app.fetch(`/api/vulnerabilities/${sqli.id}/retests`, { method: 'POST', headers: { origin: app.origin }, body: form }); assert.equal(r.status, 201, await r.clone().text()); return r.json() }
  const first = await attach()
  assert.equal((await get('/api/vulnerabilities/' + sqli.id)).finding.state, 'awaiting verification')
  await post(`/api/vulnerabilities/${sqli.id}/retests/${first.document}/decision`, { decision: 'rejected' }, 400)
  await post(`/api/vulnerabilities/${sqli.id}/retests/${first.document}/decision`, { decision: 'rejected', note: 'Letter covers staging only' }, 200)
  assert.equal((await get('/api/vulnerabilities/' + sqli.id)).finding.state, 'open')
  await post(`/api/vulnerabilities/${sqli.id}/fixed`, { note: 'Production verified' }, 200)
  const second = await attach()
  const closed = await post(`/api/vulnerabilities/${sqli.id}/retests/${second.document}/decision`, { decision: 'approved', note: 'Production retest' }, 200)
  assert.equal(closed.state, 'closed')
  const detail = await get('/api/vulnerabilities/' + sqli.id)
  assert.equal(detail.finding.state, 'closed'); assert.equal(detail.finding.closed_by, 'Evidence owner'); assert.match(detail.finding.closure_basis, /retest-letter\.pdf approved/)
  assert.equal(detail.finding.sla_status, 'closed after SLA')
  assert.equal(detail.finding.title, 'SQL injection in search'); assert.equal(detail.finding.report_date, '2026-10-01')
  assert.deepEqual(detail.events.map(e => e.kind), ['imported', 'marked fixed', 'retest attached', 'retest rejected', 'marked fixed', 'retest attached', 'closed'])
  assert.deepEqual(detail.retests.map(r => [r.decision, r.decided_name]), [['rejected', 'Evidence owner'], ['approved', 'Evidence owner']])
  assert.deepEqual(Buffer.from(await (await app.fetch(`/app/vulnerabilities/${sqli.id}/retests/${second.document}/file`)).arrayBuffer()), letter)
  assert.deepEqual(Buffer.from(await (await app.fetch(`/app/receipts/${imported.receipt}/download`)).arrayBuffer()), pdf)
  totals = (await get('/api/programs/' + program)).readiness.totals
  assert.deepEqual([totals.pentest_open, totals.pentest_awaiting_verification], [10, 0])
  assert.match(await (await app.fetch('/app/programs/' + program)).text(), /Pentest findings open/)

  const population = await (await app.fetch('/api/vulnerabilities/population.csv')).text()
  const lines = population.trim().split('\r\n')
  assert.equal(lines[0], 'finding_id,title,severity,asset,provenance,tester,report_date,report,first_detected,sla_days,due_date,state,sla_status,marked_fixed_at,closed_at,closure_basis,closed_by')
  assert.equal(lines.length, 12)
  assert.ok(lines.slice(1).every(l => l.includes(',manual,Bishop Fox,2026-10-01,bishop-fox-2026.pdf,2026-10-01,')))
  assert.match(lines.find(l => l.startsWith(sqli.id)), /,closed,closed after SLA,.*Evidence owner$/)
 })
 await scenario('VULN-002: findings, retest decisions and the retest letter survive custody export and restore', async () => {
  const raw = new Uint8Array(await (await app.fetch('/api/archive/export')).arrayBuffer())
  const destination = await runtime()
  try {
   await destination.signin(); await destination.clock('2026-10-20T12:00:00Z')
   const restored = await destination.fetch('/api/archive/restore', { method: 'POST', headers: { origin: destination.origin, 'content-type': 'application/octet-stream', 'x-evidence-confirm': 'restore' }, body: raw })
   assert.equal(restored.status, 200, await restored.clone().text())
   assert.deepEqual(await (await destination.fetch('/api/vulnerabilities')).json(), await get('/api/vulnerabilities'))
   assert.deepEqual(await (await destination.fetch('/api/vulnerabilities/' + sqli.id)).json(), await get('/api/vulnerabilities/' + sqli.id))
   const doc = (await get('/api/vulnerabilities/' + sqli.id)).retests[1].id
   assert.equal(await (await destination.fetch(`/app/vulnerabilities/${sqli.id}/retests/${doc}/file`)).text(), await (await app.fetch(`/app/vulnerabilities/${sqli.id}/retests/${doc}/file`)).text())
  } finally { await destination.close() }
 })
 console.log(`${passed} vulnerability public-door scenarios passed with real workerd, D1, R2 and native owner sessions.`)
} finally { await app.close() }
