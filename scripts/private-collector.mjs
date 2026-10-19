#!/usr/bin/env node
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { collectGit } from './private-collector/git.mjs'

const help = `Usage: node scripts/private-collector.mjs --origin URL --connection UUID --label LABEL --repository PATH

Requires Node.js 22+ and Git. Copy private-collector.mjs and the adjacent
private-collector/ directory together to install; no npm dependencies are needed.
Set EVIDENCE_COLLECTOR_TOKEN in the environment to the connection credential.
Credentials are never accepted on the command line. Use HTTPS; HTTP is permitted
only for localhost, 127.0.0.0/8 and ::1. Redirects are never followed.

One invocation reads one local repository and sends one observation to
POST /collectors/{connection}/observations. Schedule invocations with cron using
an environment that securely supplies EVIDENCE_COLLECTOR_TOKEN, for example:
  */15 * * * * /usr/local/bin/node /opt/evidence/private-collector.mjs --origin https://evidence.example --connection UUID --label LABEL --repository /private/repository
Choose the schedule to meet the connection's configured cadence.

Payload fields: revision=private-git/v1, outcome=complete, observedAt=ISO time;
resource.uniqueId and resource.displayName are LABEL. resource.attributes holds
branches (number of local branch refs), heads (distinct local branch commit IDs),
head (HEAD commit ID or null), latest_commit_at (HEAD commit time or null),
and bare (boolean). An unborn branch may have null HEAD/time and zero counts.
Only these fields leave the machine: no repository path, author, remote URL,
file names, file contents or Git diagnostics. Git never fetches or writes.

Unreadable repositories send outcome=failed, error=repository_unreadable,
revision and observedAt, with no resource. Source failures and delivery failures
exit nonzero; a delivered source failure never reports success.
`

function parseOptions(args) {
  const options = {}
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]
    const value = args[i + 1]
    if (!['--origin', '--connection', '--label', '--repository'].includes(key) || !value || value.startsWith('--') || Object.hasOwn(options, key)) throw new Error('arguments')
    options[key] = value
  }
  if (Object.keys(options).length !== 4) throw new Error('arguments')
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(options['--connection'])) throw new Error('arguments')
  if (!options['--label'].trim() || /[\u0000-\u001f\u007f]/.test(options['--label'])) throw new Error('arguments')
  const origin = new URL(options['--origin'])
  const loopback = origin.hostname === 'localhost' || origin.hostname === '[::1]' || /^127(?:\.\d{1,3}){3}$/.test(origin.hostname)
  if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash || (origin.protocol === 'http:' && !loopback)) throw new Error('arguments')
  return { origin, connection: options['--connection'], label: options['--label'], repository: options['--repository'] }
}

export async function main(args = process.argv.slice(2)) {
  if (args.length === 1 && args[0] === '--help') {
    process.stdout.write(help)
    return 0
  }
  let options
  try { options = parseOptions(args) } catch {
    console.error('Invalid collector arguments. Use --help for usage; HTTPS is required except on loopback.')
    return 2
  }
  const token = process.env.EVIDENCE_COLLECTOR_TOKEN
  if (!token || !/^[A-Za-z0-9._~+\/-]+=*$/.test(token)) {
    console.error('Set EVIDENCE_COLLECTOR_TOKEN to the connection credential.')
    return 2
  }

  let observation
  try {
    const attributes = await collectGit(options.repository)
    observation = { revision: 'private-git/v1', outcome: 'complete', observedAt: new Date().toISOString(), resource: { uniqueId: options.label, displayName: options.label, attributes } }
  } catch {
    observation = { revision: 'private-git/v1', outcome: 'failed', observedAt: new Date().toISOString(), error: 'repository_unreadable' }
  }

  try {
    const response = await fetch(new URL(`/collectors/${options.connection}/observations`, options.origin), {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(observation),
      redirect: 'manual',
      signal: AbortSignal.timeout(30000),
    })
    // No untrusted response body or transport error is printed.
    if (!response.ok) {
      response.body?.cancel().catch(() => {})
      console.error(`Collector request failed (HTTP ${response.status}).`)
      return 1
    }
    await response.body?.cancel()
  } catch {
    console.error('Collector request failed; check the origin and network.')
    return 1
  }
  if (observation.outcome === 'failed') {
    console.error('Repository unreadable; failure reported.')
    return 1
  }
  console.log('Observation accepted.')
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = await main()
}
