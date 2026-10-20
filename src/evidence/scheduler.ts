import { configurationFailures } from './ops/configuration'
import { runStep, reconcileDeliveries } from './ops/outcomes'
import { capabilityAllowed } from './archive/capabilities'
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
import { ticketAutomation } from './work/granularity'
import { handoverWork } from './handover/storage'
// The Worker's Cron Trigger (every five minutes): collect due connector reads,
// read linked tracker tickets, run due tests, run queued re-tests, then send deduplicated follow-ups. Each
// step records its own durable outcome; a failed step does not hide the others.
export async function scheduledWork(env: Bindings, now: Date) {
 const missing = configurationFailures(env)
 if (missing.length) throw new Error('Required configuration is missing or invalid: ' + missing.join(', '))
 const outcome: Record<string, number | string> = {}
 const step = async (name: string, work: () => Promise<number>) => { outcome[name] = await runStep(env, name, now, work) }
 await step('delivery reconciliation', () => reconcileDeliveries(env, now))
 await step('collections', () => collectDue(env, now))
 await step('tickets', () => syncDue(env, now))
 if (!await capabilityAllowed(env,'schedules')) return outcome
 await step('policies', async () => (await syncPolicies(env, now)) + (await syncAttestations(env, now)))
 await step('tests', () => runDueTests(env, now))
 await step('access reviews', () => accessReviewWork(env, now))
 await step('training', () => trainingWork(env, now))
 await step('retests', () => runRetests(env, now, (test, resource) => runTest(env, test, 'retest', now, resource)))
 await step('ticket automation', () => ticketAutomation(env, now))
 await step('escalations', () => escalate(env, now))
 await step('renewals', () => renewalReminders(env, now))
 await step('risk acceptances', () => escalateRiskAcceptances(env, now))
 await step('weekly digest', () => weeklyDigest(env, now))
 await step('attestation reminders', () => attestationReminders(env, now))
 await step('review reminders', () => reviewReminders(env, now))
 await step('handovers', () => handoverWork(env, now))
 await step('readiness snapshots', () => snapshotReadiness(env, now))
 return outcome
}
