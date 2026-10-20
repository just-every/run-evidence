// OPEN-001 through owner HTTP doors on real workerd, D1 and R2. Only the
// external mail and GitHub network edges are faked; no author service is used.
process.env.RER_SERVER_JOURNEY = '1'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { runtime } from './helpers/runtime.mjs'
const app = await runtime({ outbound: async request => {
 const url = new URL(request.url)
 if (url.origin !== 'https://api.github.com') return null
 if (url.pathname === '/orgs/northstar') return Response.json({ login: 'northstar' })
 if (url.pathname === '/orgs/northstar/repos') return Response.json([])
 throw Error('Unexpected GitHub call: ' + url.pathname)
} })
let passed = 0
const scenario = async (name, fn) => { await fn(); passed++; console.log('PASS OPS-001: ' + name) }
const post = async (path, body) => {
 const response = await app.fetch(path, { method: 'POST', headers: { origin: app.origin, 'content-type': 'application/json' }, body: JSON.stringify(body) })
 assert.equal(response.status, 201, path + ': ' + await response.clone().text())
 return response.json()
}
const html = async path => {
 const response = await app.fetch(path)
 assert.equal(response.status, 200, path)
 assert.match(response.headers.get('content-type'), /text\/html/, path)
 const body = await response.text()
 assert.doesNotMatch(body, /(?:enter|purchase|buy|activate) (?:an? )?(?:Evidence )?licen[cs]e key|upgrade (?:your|to a paid) Evidence|payment required|seat limit reached|framework limit reached/i, path)
 return body
}
const disclosure = (body, provider) => {
 const entry = body.match(new RegExp(`<li data-cost-provider="${provider}">([\\s\\S]*?)</li>`))
 assert.ok(entry, 'Provider cost missing: ' + provider)
 assert.match(entry[1], /USD/, 'Currency missing: ' + provider)
}
try {
 await scenario('OPEN-001: repository and package grant MIT redistribution rights', async () => {
  const license = await readFile('LICENSE', 'utf8'), pkg = JSON.parse(await readFile('package.json', 'utf8'))
  assert.equal(pkg.license, 'MIT')
  assert.match(license, /MIT License/)
  assert.match(license, /permission.*(?:\n|.)*redistribut|Permission is hereby granted[\s\S]*distribute/i)
 })
 await scenario('OPEN-001: an owner reaches every shipped area with four core programs and 250 people without author payment or license credentials', async () => {
  await app.signin()
  for (const framework of ['soc2', 'iso27001', 'hipaa', 'pci']) {
   const program = await post('/api/programs', { framework, report_type: 'Type II', name: framework + ' program', legal_entity: 'Northstar', audit_from: '2026-07-01', audit_to: '2027-06-30' })
   await html('/app/programs/' + program.id)
  }
  for (let i = 0; i < 250; i++) await post('/api/people', { name: 'Person ' + i, email: `person${i}@northstar.test`, kind: 'employee' })
  const roster = await app.fetch('/api/people')
  assert.equal(roster.status, 200)
  assert.equal((await roster.json()).people.length, 250)
  for (const path of ['/app', '/app/programs', '/app/tests', '/app/remediation', '/app/policies', '/app/policies/builder', '/app/people', '/app/vendors', '/app/risks', '/app/connections', '/app/folders', '/app/agent', '/app/import', '/app/archive', '/app/trackers', '/app/followups', '/app/training', '/app/populations', '/app/inventory', '/app/identities', '/app/access-reviews']) await html(path)
 })
 await scenario('OPEN-001: current provider setup screens disclose USD provider charges and connecting needs no Evidence payment', async () => {
  for (const [path, providers] of [
   ['/app/connections', ['github', 'aws', 'gcp', 'azure', 'okta', 'google', 'entra', 'jumpcloud', 'cloudflare', 'resend', 'sendgrid', 'cloudflare_mail']],
   ['/app/trackers', ['vector', 'jira', 'linear', 'github', 'asana']],
   ['/app/followups', ['slack', 'teams', 'resend', 'sendgrid', 'cloudflare_mail']],
   ['/app/training', ['knowbe4']],
  ]) {
   const body = await html(path)
   for (const provider of providers) disclosure(body, provider)
  }
  // Each activation form carries its relevant disclosure in the same section,
  // before credentials are submitted. Check the served HTML, not source files.
  const connections = await html('/app/connections')
  for (const [section, providers] of [['github-title', ['github']], ['aws-title', ['aws']], ['clouds-title', ['gcp', 'azure']], ['directory-title', ['okta', 'google', 'entra', 'jumpcloud']]]) {
   const content = connections.match(new RegExp(`<section aria-labelledby="${section}">([\\s\\S]*?)<form`))
   assert.ok(content, section)
   for (const provider of providers) disclosure(content[1], provider)
  }
  const connection = await post('/api/connections', { account: 'northstar', token: 'github_pat_test', label: 'Northstar repositories' })
  const response = await app.fetch('/api/connections/' + connection.id)
  assert.equal(response.status, 200)
  assert.equal((await response.json()).connection.status, 'active')
  disclosure(await html('/app/connections/' + connection.id), 'github')
 })
 console.log(`${passed} OPEN-001 public-door scenarios passed.`)
} finally { await app.close() }
