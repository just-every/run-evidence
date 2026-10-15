// A test cohort needs fifteen minutes with no other admissions. Run only in
// run-demo, where the deployment's credentials can open the operator tail.
import { spawn } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
const config = '.rer/demo-host/wrangler.json'
const plan = JSON.parse(readFileSync(config, 'utf8'))
const host = plan.routes[0].pattern
const started = Date.now(), quietMs = 15 * 60_000
let lastAdmission = started, admissions = 0, observed = false, recent = ''
const tail = spawn('pnpm', ['exec', 'wrangler', 'tail', '--config', config, '--format', 'json'], { stdio: ['ignore', 'pipe', 'pipe'] })
let closed = false
const observe = chunk => {
 const text = recent + chunk.toString()
 if (text.includes('"eventTimestamp"')) observed = true
 const matches = text.match(/demo_admitted/g)
 if (matches) { admissions += matches.length; lastAdmission = Date.now() }
 recent = text.slice(-12) // retain split event-name prefixes only
}
tail.stdout.on('data', observe)
tail.stderr.resume()
tail.on('exit', () => { closed = true })
try {
 while (Date.now() - started < 21 * 60_000) {
  if (closed) throw Error('Operator tail ended before the quiet window completed')
  // A harmless GET also proves the tail is receiving events; it starts no demo.
  await fetch('https://' + host + '/').then(r => r.body?.cancel())
  if (observed && Date.now() - lastAdmission >= quietMs) {
   const result = { host, started: new Date(started).toISOString(), ended: new Date().toISOString(), quietSeconds: Math.floor((Date.now() - lastAdmission) / 1000), admissions }
   writeFileSync('demo-quiet.json', JSON.stringify(result, null, 2) + '\n')
   console.log(JSON.stringify(result)); process.exitCode = 0; break
  }
  await new Promise(resolve => setTimeout(resolve, 10_000))
 }
 if (!observed || Date.now() - lastAdmission < quietMs) throw Error('No complete quiet admission window; do not start the cohort')
} finally { tail.kill('SIGTERM') }
