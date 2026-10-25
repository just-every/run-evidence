// The internal verification target, split into shards that CI runs in parallel
// (VERIFY_SHARD=core|custody|history|program|code|people|integrations|cloud|clouds|identity|trackers|browser|browser-data). Without a shard every step runs in order.
import { spawnSync } from 'node:child_process'
const shards = {
 core: [['rer', 'build', '--site'], ['node', 'tests/site.mjs'], ['pnpm', 'run', 'typecheck'], ['node', 'scripts/edition-authoring/cli.mjs', 'check'], ['node', 'scripts/library-check.mjs'], ['node', 'tests/ops.mjs'], ['node', 'tests/evidence.mjs']],
 custody: [['node', 'tests/review.mjs'], ['node', 'tests/archive.mjs']],
 history: [['node', 'tests/import.mjs'], ['node', 'tests/agent.mjs']],
 program: [['node', 'tests/open.mjs'], ['node', 'tests/program.mjs'], ['node', 'tests/api.mjs'], ['node', 'tests/private-collector.mjs'], ['node', 'tests/risk.mjs'], ['node', 'tests/report.mjs'], ['node', 'tests/readiness.mjs']],
 code: [['node','tests/github.mjs']],
 people: [['node', 'tests/policy.mjs'], ['node', 'tests/handover.mjs'], ['node', 'tests/cadence.mjs'], ['node', 'tests/population.mjs'], ['node', 'tests/inventory.mjs'], ['node', 'tests/access.mjs'], ['node', 'tests/training.mjs']],
 integrations: [['node', 'tests/work.mjs'], ['node', 'tests/followup.mjs'], ['node', 'tests/trust.mjs'], ['node', 'tests/failure-notices.mjs'], ['node', 'tests/vulns.mjs']],
 cloud: [['node', 'tests/cloud.mjs']],
 clouds: [['node', 'tests/clouds.mjs']],
 identity: [['node', 'tests/identity.mjs']],
 trackers: [['node', 'tests/trackers.mjs'], ['node', 'tests/trackers-browser.mjs'], ['node', 'tests/extended-programs-browser.mjs']],
 browser: [ ['node', 'tests/vendor-browser.mjs'], ['node', 'tests/program-documents-browser.mjs'], ['node', 'tests/period-agent-browser.mjs'], ['node', 'tests/ops-browser.mjs'], ['node', 'tests/email-link.mjs'], ['node', 'tests/browser.mjs'], ['node', 'tests/readiness-browser.mjs']],
 // Custody restore and inventory each start multiple clean installations. Keep
 // them separate from the other browser journeys within the same 15-minute cap.
 'browser-data': [['node', 'tests/review-browser.mjs'], ['node', 'tests/inventory-browser.mjs']],
}
const shard = process.env.VERIFY_SHARD
if (shard && !shards[shard]) { console.error(`Unknown VERIFY_SHARD ${shard}; use ${Object.keys(shards).join(', ')}.`); process.exit(2) }
// The production build comes first in every shard: rer verify then serves it.
for (const [command, ...args] of [['pnpm', 'run', 'build'], ...(shard ? shards[shard] : Object.values(shards).flat())]) {
 console.log(`\n> ${[command, ...args].join(' ')}`)
 if(command==='pnpm'&&args.join(' ')==='run build')console.log('OPS-001: documented production build must succeed before journeys')
 const started = performance.now()
 const result = spawnSync(command === 'rer' ? 'pnpm' : command, command === 'rer' ? ['exec', 'rer', ...args] : args, { stdio: 'inherit', env: process.env })
 console.log(`> ${[command, ...args].join(' ')} finished in ${((performance.now() - started) / 1000).toFixed(1)}s (exit ${result.status ?? 1})`)
 if (result.status !== 0) process.exit(result.status ?? 1)
}
