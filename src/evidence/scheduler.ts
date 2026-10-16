import type { Bindings } from '../auth.server'
import { runDueTests, runTest } from './tests/engine'
import { escalate, runRetests } from './remedy/storage'
import { renewalReminders } from './renewals'
import { collectDue } from './connect/collect'
import { escalateRiskAcceptances } from './risk/storage'
// The Worker's Cron Trigger (every five minutes): collect due connector reads,
// run due tests, run queued re-tests, then send deduplicated follow-ups. Each
// step records its own durable outcome; a failed step does not hide the others.
export async function scheduledWork(env: Bindings, now: Date) {
 const outcome: Record<string, number | string> = {}
 const step = async (name: string, work: () => Promise<number>) => { try { outcome[name] = await work() } catch (error) { console.error('Scheduled step failed', name, error instanceof Error ? error.message : ''); outcome[name] = 'failed' } }
 await step('collections', () => collectDue(env, now))
 await step('tests', () => runDueTests(env, now))
 await step('retests', () => runRetests(env, now, (test, resource) => runTest(env, test, 'retest', now, resource)))
 await step('escalations', () => escalate(env, now))
 await step('renewals', () => renewalReminders(env, now))
 await step('risk acceptances', () => escalateRiskAcceptances(env, now))
 return outcome
}
