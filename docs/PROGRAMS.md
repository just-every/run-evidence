# Programs, tests and remediation

## Programs and the control library

**Programs** runs SOC 2 (2017 TSC, 2022 points of focus), ISO/IEC 27001 (2022,
with 2013 for transitions), HIPAA (Security and Breach Notification rules) and
PCI DSS v4.0.1. Creating a program adopts the shipped control library (112
controls covering all 455 shipped requirements); one control serves every
framework it maps to, so proof attached once counts everywhere.

- Scope: legal entity, products, teams, regions, systems, audit period, assessor,
  accountable lead and milestones. Every change is a revision with a reason.
- Applicability: excluded requirements stay listed with their rationale. Record
  the assessor's review of the current decisions.
- Editions: moving editions (for example ISO/IEC 27001:2013 → 2022) is a
  reviewable change listing new, retired and carried requirements. Accepting it
  applies from that moment.
- Readiness keeps proof completeness and automated test results apart, drills
  from each total to its requirements, and never labels a business certified.
- Export a program as JSON (`/api/programs/{id}/export`).

Requirement and control text from AICPA, ISO and PCI SSC is licensed; Evidence
ships reference ids and its own short summaries.

`node scripts/library-check.mjs` (run by Verify) fails if any requirement lacks a
control, any control lacks proof or a test, or any catalogue test lacks
per-provider remediation steps.

## Renewal schedules

Proof can recur daily, weekly, monthly, quarterly, semi-annually or annually.
Annual and semi-annual proof defaults to the **effective date** anchor: upload a
penetration test report with its report date as the effective date, and the next
due date is that date plus the period. Fiscal-year and audit-window anchors set
fixed periods. A one-off renewal date moves only the current cycle. Schedule
changes apply from now on; earlier periods keep their definition. Reminders go to
the requirement owner once at the reminder lead and once at the deadline.

## Continuous tests

Tests evaluate resources on a schedule (hourly configuration tests, daily period
tests) and whenever a source changes. Observations are immutable and keep the
criteria revision, source and interval. Exceptions expire; scope exclusions carry
a rationale; neither rewrites history. A collector read older than the cadence
allows is **unknown**, never a carried-forward pass.

## Remediation

A failing item opens one obligation with its own SLA clock (defaults: critical
15, high 30, medium 60, low 90 days; set per category and severity under
Remediation). Marking work done queues a re-test; only a passing observation
closes the obligation, and a later failure reopens it. Approved exceptions pause
the clock; risk acceptances expire and reopen the work. Approaching and missed
SLAs email the owner once per cycle.

## GitHub connection

Connect an organization under **Connections** with a fine-grained, read-only
token (Metadata, Administration, Dependabot alerts and Secret scanning alerts
read; organization Members read for two-factor enforcement). Choose the
repositories in scope. Collection runs hourly from the Cron Trigger and records
coverage, unreadable repositories and throttling. The token is encrypted under a
key derived from `SESSION_SECRET`; rotating that secret means reconnecting.

## Risks

The register ships 103 library scenarios, imports CSV or XLSX registers through a
dry run, and scores under an owner-set, versioned method (3×3 to 5×5). Residual
acceptances expire and escalate; treatment tasks can be verified by a test.

## Custody archives

Archive version 3 carries every program record. Restored API tokens cannot
authenticate and restored connections stay inactive until reconnected. The
existing limits (8 MiB metadata, 20,000 rows) now count observations too; an
installation past them gets an explicit refusal, never a truncated archive.
