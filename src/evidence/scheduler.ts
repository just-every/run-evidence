import type { Bindings } from '../auth.server'
import { runDueTests, runTest } from './tests/engine'
import { escalate, runRetests } from './remedy/storage'
import { renewalReminders } from './renewals'
import { collectDue } from './connect/collect'
import { escalateRiskAcceptances } from './risk/storage'
import { syncDue } from './work/sync'
import { snapshotReadiness } from './program/board'
import { weeklyDigest } from './followup/digest'
import { syncPolicies } from './policy/builder'
import { attestationReminders, syncAttestations } from './attest/storage'
import { reviewReminders } from './reviews/schedule'
import { accessReviewWork } from './access/storage'
import { trainingWork } from './training/storage'
// The Worker's Cron Trigger (every five minutes): collect due connector reads,
// read linked tracker tickets, run due tests, run queued re-tests, then send deduplicated follow-ups. Each
// step records its own durable outcome; a failed step does not hide the others.
export async function scheduledWork(env: Bindings, now: Date) {
 const outcome: Record<string, number | string> = {}
 const step = async (name: string, work: () => Promise<number>) => { try { outcome[name] = await work() } catch (error) { console.error('Scheduled step failed', name, error instanceof Error ? error.message : ''); outcome[name] = 'failed' } }
 await step('collections', () => collectDue(env, now))
 await step('tickets', () => syncDue(env, now))
 await step('policies', async () => (await syncPolicies(env, now)) + (await syncAttestations(env, now)))
 await step('tests', () => runDueTests(env, now))
 await step('access reviews', () => accessReviewWork(env, now))
 await step('training', () => trainingWork(env, now))
 await step('retests', () => runRetests(env, now, (test, resource) => runTest(env, test, 'retest', now, resource)))
 await step('escalations', () => escalate(env, now))
 await step('renewals', () => renewalReminders(env, now))
 await step('risk acceptances', () => escalateRiskAcceptances(env, now))
 await step('weekly digest', () => weeklyDigest(env, now))
 await step('attestation reminders', () => attestationReminders(env, now))
 await step('review reminders', () => reviewReminders(env, now))
 await step('readiness snapshots', () => snapshotReadiness(env, now))
 return outcome
}
