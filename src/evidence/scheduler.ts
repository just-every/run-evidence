import { configurationFailures } from './ops/configuration'
import { runStep, reconcileDeliveries } from './ops/outcomes'
import { EXECUTION_TIMEOUT_MS } from './ops/execution'
import { capabilityAllowed } from './archive/capabilities'
import type { Bindings } from '../auth.server'
import { runDueTests, runTest } from './tests/engine'
import { escalate, runRetests } from './remedy/storage'
import { renewalReminders } from './renewals'
import { collectDue } from './connect/collect'
import { escalateRiskAcceptances } from './risk/storage'
import { checkBasecampWebhooks } from './work/basecamp-webhook'
import { syncDue } from './work/sync'
import { snapshotReadiness } from './program/board'
import { openingNotices } from './followup/opened'
import { weeklyDigest } from './followup/digest'
import { syncPolicies } from './policy/builder'
import { attestationReminders, syncAttestations } from './attest/storage'
import { reviewReminders } from './reviews/schedule'
import { vendorReminders } from './vendor/diligence'
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
 const deadline = Date.now() + EXECUTION_TIMEOUT_MS
 const step = async (name: string, work: (scopedEnv: Bindings) => Promise<number>) => { outcome[name] = Date.now() >= deadline ? 'not run: execution deadline reached' : await runStep(env, name, now, work, deadline) }
 await step('delivery reconciliation', scoped => reconcileDeliveries(scoped, now))
 await step('collections', scoped => collectDue(scoped, now))
 await step('tickets', async scoped => (await checkBasecampWebhooks(scoped, now)) + (await syncDue(scoped, now)))
 if (!await capabilityAllowed(env,'schedules')) return outcome
 await step('policies', async scoped => (await syncPolicies(scoped, now)) + (await syncAttestations(scoped, now)))
 await step('tests', scoped => runDueTests(scoped, now))
 await step('access reviews', scoped => accessReviewWork(scoped, now))
 await step('training', scoped => trainingWork(scoped, now))
 await step('retests', scoped => runRetests(scoped, now, (test, resource) => runTest(scoped, test, 'retest', now, resource)))
 await step('ticket automation', scoped => ticketAutomation(scoped, now))
 await step('failure notices', scoped => openingNotices(scoped, now))
 await step('escalations', scoped => escalate(scoped, now))
 await step('renewals', scoped => renewalReminders(scoped, now))
 await step('risk acceptances', scoped => escalateRiskAcceptances(scoped, now))
 await step('weekly digest', scoped => weeklyDigest(scoped, now))
 await step('attestation reminders', scoped => attestationReminders(scoped, now))
 await step('review reminders', async scoped => (await reviewReminders(scoped, now)) + (await vendorReminders(scoped, now)))
 await step('handovers', scoped => handoverWork(scoped, now))
 await step('readiness snapshots', scoped => snapshotReadiness(scoped, now))
 return outcome
}
