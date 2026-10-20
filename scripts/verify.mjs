// The internal verification target, split into shards that CI runs in parallel
// (VERIFY_SHARD=core|program|people|integrations|trackers|browser). Without a shard every step runs in order.
import { spawnSync } from 'node:child_process'
const shards = {
 core: [['rer', 'build', '--site'], ['node', 'tests/site.mjs'], ['pnpm', 'run', 'typecheck'], ['node', 'scripts/edition-authoring/cli.mjs', 'check'], ['node', 'scripts/library-check.mjs'], ['node', 'tests/evidence.mjs'], ['node', 'tests/review.mjs'], ['node', 'tests/archive.mjs'], ['node', 'tests/import.mjs'], ['node', 'tests/agent.mjs']],
 program: [['node', 'tests/open.mjs'], ['node', 'tests/program.mjs'], ['node', 'tests/api.mjs'], ['node', 'tests/github.mjs'], ['node', 'tests/private-collector.mjs'], ['node', 'tests/risk.mjs'], ['node', 'tests/report.mjs'], ['node', 'tests/readiness.mjs']],
 people: [['node', 'tests/policy.mjs'], ['node', 'tests/handover.mjs'], ['node', 'tests/cadence.mjs'], ['node', 'tests/population.mjs'], ['node', 'tests/inventory.mjs'], ['node', 'tests/access.mjs'], ['node', 'tests/training.mjs']],
 integrations: [['node', 'tests/work.mjs'], ['node', 'tests/followup.mjs'], ['node', 'tests/cloud.mjs'], ['node', 'tests/identity.mjs'], ['node', 'tests/clouds.mjs'], ['node', 'tests/vulns.mjs']],
 trackers: [['node', 'tests/trackers.mjs'], ['node', 'tests/trackers-browser.mjs']],
 browser: [ ['node', 'tests/email-link.mjs'], ['node', 'tests/browser.mjs'], ['node', 'tests/readiness-browser.mjs'], ['node', 'tests/review-browser.mjs'], ['node', 'tests/inventory-browser.mjs']],
}
const shard = process.env.VERIFY_SHARD
if (shard && !shards[shard]) { console.error(`Unknown VERIFY_SHARD ${shard}; use ${Object.keys(shards).join(', ')}.`); process.exit(2) }
// The production build comes first in every shard: rer verify then serves it.
for (const [command, ...args] of [['pnpm', 'run', 'build'], ...(shard ? shards[shard] : Object.values(shards).flat())]) {
 console.log(`\n> ${[command, ...args].join(' ')}`)
 const result = spawnSync(command === 'rer' ? 'pnpm' : command, command === 'rer' ? ['exec', 'rer', ...args] : args, { stdio: 'inherit', env: process.env })
 if (result.status !== 0) process.exit(result.status ?? 1)
}
