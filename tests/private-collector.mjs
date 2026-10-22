// CONNECT-001 through installed CLI + production HTTP/D1/R2. The private source
// is an actual local Git repository; only the mail network edge is faked.
process.env.RER_SERVER_JOURNEY = '1'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { spawn, execFileSync } from 'node:child_process'
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { runtime } from './helpers/runtime.mjs'
const app = await runtime(), dir = await mkdtemp(join(tmpdir(), 'evidence-private-source-')), repo = join(dir, 'service')
let receiver = app, passed = 0, issued, reader, supported, unsupported, lastPayload
const server = createServer(async (req, res) => {
 try {
  const chunks = []; for await (const chunk of req) chunks.push(chunk)
  const body = Buffer.concat(chunks)
  lastPayload = body.length ? JSON.parse(body) : null
  const response = await receiver.fetch(req.url, { method: req.method, headers: { authorization: req.headers.authorization ?? '', 'content-type': req.headers['content-type'] ?? '', host: new URL(receiver.origin).host }, body })
  res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer()))
 } catch { res.writeHead(500); res.end() }
})
await new Promise(done => server.listen(0, '127.0.0.1', done))
const origin = `http://127.0.0.1:${server.address().port}`
const git = (...args) => execFileSync(args[0]==='commit'?'env':'git', args[0]==='commit'?['GIT_AUTHOR_NAME=Run Edit Run fleet','GIT_AUTHOR_EMAIL=fleet@runeditrun.com','GIT_COMMITTER_NAME=Run Edit Run fleet','GIT_COMMITTER_EMAIL=fleet@runeditrun.com','git',...args]:args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
const post = async (path, body, expected = 201, target = app) => {
 const r = await target.fetch(path, { method: 'POST', headers: { origin: target.origin, 'content-type': 'application/json' }, body: JSON.stringify(body) })
 assert.equal(r.status, expected, path + ': ' + await r.clone().text()); return r.json()
}
const get = async path => { const r = await app.fetch(path); assert.equal(r.status, 200); return r.json() }
const v1 = (token, path, init = {}) => app.fetch(path, { ...init, headers: { cookie: '', authorization: 'Bearer ' + token, 'content-type': 'application/json' } })
const resource = async () => (await (await v1(reader.token, '/v1/resources')).json()).data.filter(r => r.type === 'private.git.repository')
const cli = async (token, repository = repo, connection = issued.id, label = 'Production service') => new Promise((done, fail) => {
 const p = spawn(process.execPath, [resolve('scripts/private-collector.mjs'), '--origin', origin, '--connection', connection, '--label', label, '--repository', repository], { env: { ...process.env, EVIDENCE_COLLECTOR_TOKEN: token }, stdio: ['ignore', 'pipe', 'pipe'] })
 let output = ''; p.stdout.on('data', b => output += b); p.stderr.on('data', b => output += b); p.once('error', fail); p.once('close', code => done({ code, output }))
})
const clockNow = target => target.clock(new Date().toISOString())
const scenario = async (name, fn) => { await fn(); console.log('PASS CONNECT-001: ' + name); passed++ }
try {
 await app.signin(); await clockNow(app)
 await scenario('owner reviews the private collector, installs it against real Git, reconciles its exact reads and sees unsupported checks as unknown', async () => {
  await post('/api/collectors', { label: 'Production service' }, 400)
  assert.equal((await app.fetch('/api/collectors', { method: 'POST', headers: { origin: app.origin, cookie: '', 'content-type': 'application/json' }, body: '{}' })).status, 401)
  issued = await post('/api/collectors', { label: 'Production service', reviewed: 'yes' })
  // COLLECTION-001: a push collector keeps its independently owned local schedule.
  await post(`/api/connections/${issued.id}/schedule`, { minutes: 15 }, 409)
  assert.equal(JSON.parse((await get('/api/connections/' + issued.id)).connection.config_json).collection_minutes, undefined)
  reader = await post('/api/api-tokens', { name: 'Read collector inventory', scopes: ['read', 'resource-push'], expires_at: new Date(Date.now() + 86400000).toISOString() })
  await new Promise((done, fail) => { const p = spawn('git', ['init', '--initial-branch=main', repo], { stdio: 'ignore' }); p.once('error', fail); p.once('close', n => n === 0 ? done() : fail(Error('git init failed'))) })
  git('config', 'user.name', 'Run Edit Run fleet'); git('config', 'user.email', 'fleet@runeditrun.com')
  await writeFile(join(repo, 'service.txt'), 'Private application contents never leave Git.\n')
  git('add', 'service.txt'); git('commit', '-m', 'Private source initialization'); git('branch', 'release')
  const head = git('rev-parse', 'HEAD'), before = await readFile(join(repo, '.git', 'HEAD'))
  supported = (await post('/api/tests', { name: 'Private repository has release branches', resourceType: 'private.git.repository', criteria: JSON.stringify([{ attribute: 'branches', op: 'min', value: 2 }]), controls: ['AC-05'], cadence: 'hourly', category: 'code' })).id
  unsupported = (await post('/api/tests', { name: 'Hosted review policy', resourceType: 'private.git.repository', criteria: JSON.stringify([{ attribute: 'branch_protection', op: 'equals', value: true }]), controls: ['AC-05'], cadence: 'hourly', category: 'code' })).id
  await clockNow(app); assert.equal((await cli(issued.token)).code, 0)
  const rows = await resource(); assert.equal(rows.length, 1)
  assert.equal(rows[0].source_kind, 'source-observed')
  assert.deepEqual(JSON.parse(rows[0].attributes_json), { bare: false, branches: 2, head, heads: 1, latest_commit_at: git('show', '--no-patch', '--format=%cI', 'HEAD') })
  assert.equal(rows[0].unique_id, issued.id)
  assert.equal((await get('/api/tests/' + supported)).latest[0].result, 'pass')
  assert.equal((await get('/api/tests/' + unsupported)).latest[0].result, 'unknown')
  assert.deepEqual(await readFile(join(repo, '.git', 'HEAD')), before)
  assert.equal(git('status', '--porcelain'), '')
  assert.ok(!JSON.stringify(lastPayload).includes('Private application contents') && !JSON.stringify(lastPayload).includes(repo))
  const detail = await get('/api/connections/' + issued.id)
  assert.equal(detail.runs[0].outcome, 'complete'); assert.ok(JSON.parse(detail.runs[0].coverage_json).unsupported)
  assert.ok(!JSON.stringify(detail).includes(issued.token)); assert.ok(!JSON.stringify(detail).includes('collector_token_hash'))
  assert.match(await (await app.fetch('/app/connections/' + issued.id)).text(), /Hosted branch protection/)
  const malformed = { ...lastPayload, resource: { ...lastPayload.resource, attributes: { ...lastPayload.resource.attributes, file_contents: 'disallowed' } } }
  assert.equal((await app.fetch(`/collectors/${issued.id}/observations`, { method: 'POST', headers: { authorization: 'Bearer ' + issued.token, 'content-type': 'application/json' }, body: JSON.stringify(malformed) })).status, 400)
  assert.equal((await v1(reader.token, '/v1/resources/private.git.repository', { method: 'PUT', body: JSON.stringify({ resources: [] }) })).status, 400)
  await clockNow(app)
  const failed = await cli(issued.token, join(dir, 'unreadable'))
  assert.equal(failed.code, 1); assert.ok(!failed.output.includes(repo))
  assert.equal((await get('/api/tests/' + supported)).latest[0].result, 'unknown')
  assert.equal((await resource()).length, 1)
  assert.equal((await get('/api/connections/' + issued.id)).runs[0].outcome, 'failed')
  assert.equal(JSON.parse((await get('/api/connections/'+issued.id)).runs[0].coverage_json).received_at,app.harnessState().settings.HARNESS_NOW,'a private-source clock never overwrites the server receipt clock')
  await clockNow(app); assert.equal((await cli(issued.token)).code, 0)
  const recovered = await get('/api/tests/' + supported)
  assert.equal(recovered.latest[0].result, 'pass'); assert.ok(recovered.runs.some(r => r.unknown === 1))
 })
 await scenario('PORTABLE-001 / credentials bind one installation and connection, rotate/revoke immediately, stay secret in custody, and missed reads become stale without invented observations', async () => {
  const second = await post('/api/collectors', { label: 'Second private service', reviewed: 'yes' })
  assert.equal((await cli(issued.token, repo, second.id, 'Second private service')).code, 1)
  const rotated = await post(`/api/collectors/${issued.id}/rotate`, {}, 200)
  assert.equal((await cli(issued.token)).code, 1)
  issued = rotated; await clockNow(app); assert.equal((await cli(issued.token)).code, 0)
  await post(`/api/connections/${issued.id}/revoke`, {}, 200)
  assert.equal((await cli(issued.token)).code, 1)
  issued = await post(`/api/collectors/${issued.id}/rotate`, {}, 200)
  await clockNow(app); assert.equal((await cli(issued.token)).code, 0)
  const raw = new Uint8Array(await (await app.fetch('/api/archive/export')).arrayBuffer())
  const retained = new TextDecoder().decode(raw)
  assert.ok(!retained.includes(issued.token) && !retained.includes('collector_token_hash'))
  const target = await runtime()
  try {
   await target.signin(); await clockNow(target)
   const restored = await target.fetch('/api/archive/restore', { method: 'POST', headers: { origin: target.origin, 'content-type': 'application/octet-stream', 'x-evidence-confirm': 'restore', 'x-evidence-erasure-history':'unverified acknowledged' }, body: raw })
   assert.equal(restored.status, 200, await restored.clone().text())
   receiver = target
   assert.equal((await cli(issued.token)).code, 1)
   const state = await (await target.fetch('/api/connections/' + issued.id)).json()
   assert.equal(state.connection.status, 'inactive after restore')
   const fresh = await post(`/api/collectors/${issued.id}/rotate`, {}, 200, target)
   await clockNow(target); assert.equal((await cli(fresh.token)).code, 1, 'PORTABLE-001 fresh credentials still require explicit collection reauthorization')
   await post('/api/archive/reauthorize', { capability: 'collections', subject: issued.id }, 200, target)
   assert.equal((await cli(fresh.token)).code, 0)
  } finally { receiver = app; await target.close() }
  const before = (await get('/api/connections/' + issued.id)).runs.length
  await app.clock(new Date(Date.now() + 3 * 3600000).toISOString()); await app.tick()
  assert.equal((await get('/api/tests/' + supported)).latest[0].result, 'unknown')
  assert.equal((await get('/api/connections/' + issued.id)).runs.length, before)
  assert.ok((await get('/api/tests/' + supported)).runs.some(r => r.passed === 1))
 })
 console.log(`${passed} CONNECT-001 installed collector public-door scenarios passed.`)
} finally { await new Promise(done => server.close(done)); await app.close(); await rm(dir, { recursive: true, force: true }) }
