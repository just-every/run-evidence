import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
const execute = promisify(execFile)
// CONNECT-001: actual installed collector, owner review and visible loss/recovery.
export async function collectorJourney(page, origin, width, capture) {
 const dir = await mkdtemp(join(tmpdir(), 'evidence-private-browser-')), repo = join(dir, 'service')
 try {
  await execute('git', ['init', '--initial-branch=main', repo])
  const git = args => execute(args[0]==='commit'?'env':'git',args[0]==='commit'?['GIT_AUTHOR_NAME=Run Edit Run fleet','GIT_AUTHOR_EMAIL=' + ['fleet', 'runeditrun.com'].join('@'),'GIT_COMMITTER_NAME=Run Edit Run fleet','GIT_COMMITTER_EMAIL=' + ['fleet', 'runeditrun.com'].join('@'),'git',...args]:args,{cwd:repo})
  await git(['config', 'user.name', 'Run Edit Run fleet']); await git(['config', 'user.email', ['fleet', 'runeditrun.com'].join('@')])
  await writeFile(join(repo, 'application.txt'), 'Private service data stays here.\n')
  await git(['add', '.']); await git(['commit', '-m', 'Private service'])
  await page.goto(origin + '/app/connections')
  await page.getByRole('link', { name: 'Install a reviewed private Git collector' }).click()
  await page.getByRole('heading', { name: 'Review and register a read-only collector' }).waitFor()
  await capture(page, `${width}-collector-review`)
  const label = `Production service ${width}`
  await page.getByLabel('Repository label', { exact: true }).fill(label)
  await page.getByLabel('I reviewed the fixed collector, its fields and read-only permissions.').check()
  await page.getByRole('button', { name: 'Register reviewed collector' }).click()
  const secret = page.locator('[data-secret]'); await secret.waitFor()
  let token = await secret.innerText()
  const link = page.getByRole('link', { name: 'Open registered connection' })
  const connection = (await link.getAttribute('href')).split('/').at(-1)
  await capture(page, `${width}-collector-issued`)
  const collect = async (repository = repo) => new Promise((done, fail) => {
   const p = spawn(process.execPath, [resolve('scripts/private-collector.mjs'), '--origin', origin, '--connection', connection, '--label', label, '--repository', repository], { env: { ...process.env, EVIDENCE_COLLECTOR_TOKEN: token }, stdio: 'ignore' })
   p.once('error', fail); p.once('close', code => done(code))
  })
  assert.equal(await collect(), 0)
  await page.goto(origin + '/app/connections/' + connection)
  assert.equal(await page.locator('[data-secret]').count(), 0)
  const detail = async () => (await page.request.get(origin + '/api/connections/' + connection)).json()
  assert.equal((await detail()).runs[0].outcome, 'complete')
  await capture(page, `${width}-collector-collected`)
  assert.equal(await collect(join(dir, 'unavailable')), 1)
  await page.reload()
  assert.match(await page.locator('main').innerText(), /repository_unreadable/)
  assert.equal((await detail()).runs[0].outcome, 'failed')
  await capture(page, `${width}-collector-failed`)
  await page.getByRole('button', { name: 'Rotate collector token' }).click()
  token = await page.locator('[data-secret]').innerText()
  assert.equal(await collect(), 0)
  await page.goto(origin + '/app/connections/' + connection)
  assert.equal((await detail()).runs[0].outcome, 'complete')
  await capture(page, `${width}-collector-recovered`)
  await page.getByRole('button', { name: 'Revoke collector', exact: true }).click()
  assert.equal((await detail()).connection.status, 'revoked')
  assert.equal(await collect(), 1)
  await capture(page, `${width}-collector-revoked`)
  console.log(`PASS CONNECT-001 reviewed collector, real Git, failure/recovery and revocation at ${width}`)
 } finally { await rm(dir, { recursive: true, force: true }) }
}
