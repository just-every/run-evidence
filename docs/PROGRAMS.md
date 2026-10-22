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
- Prerequisites and assessor handoff: each program lists its data-processing
  prerequisites (BAAs for HIPAA, DPAs, PCI service-provider agreements, licensed
  framework text, and regional controls for any region outside the US), each
  marked "not verified by Evidence", names who decides and signs, and shows USD
  provider costs. Export the assessor handoff pack as JSON
  (`/api/programs/{id}/handoff`): scope, prerequisites, costs, readiness, every
  unresolved requirement and a SHA-256 index of current exhibits. Share the files
  themselves through an expiring review folder.

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

Archive version 6 carries current program records and verified original population files, including historical scoring definitions and risk-library revision provenance. Versions 1–5 remain readable; legacy definitions are shown as not recorded. Restored API tokens cannot
authenticate and restored connections stay inactive until reconnected. The
existing limits (8 MiB metadata, 20,000 rows) now count observations too; an
installation past them gets an explicit refusal, never a truncated archive.

## Extended and regulated programs

Start these from **Programs** like any other: pick the framework and edition, name the legal entity and scope. They use the same shipped control library, so a business that already runs SOC 2 reuses its proof and tests: each program page shows which controls it shares with your other programs and how many evidence items they hold. Evidence prepares evidence; each program names the body that decides (an accredited certification body, a C3PAO, a HITRUST assessor, or counsel) and asserts no certification.

- **US Data Privacy (USDP)** covers nineteen state laws. Record your annual revenue, the share of revenue from selling personal data, small-business and sensitive-data status, and consumers per state. Each state's threshold is evaluated on those figures; only states that apply keep their obligations. The others stay visible as excluded with your figures. When you change the figures, the page proposes the resulting state changes; a state's obligations are added or excluded only when you accept the change with a reason. Counsel confirms which laws apply and the section-level citations.
- **CMMC Level 2** shows a SPRS worksheet: 110 less the DoD Assessment Methodology weight of each requirement not implemented. A requirement counts as implemented when its mapped controls have current proof and no failing or unknown test. Record whether MFA covers all users and whether encryption is FIPS-validated, because the methodology gives partial credit. A plan of action never substitutes, and a missing system security plan (3.12.4) means the score is not valid to submit.
- **ISO/IEC 27701** keeps PII controller (Annex A) and processor (Annex B) controls separately applicable: choose the roles when you start the program.
- GDPR, ISO/IEC 42001, NIST AI RMF, NIST CSF 2.0, NIST SP 800-53 (Low and Moderate), CMMC Level 1 and HITRUST CSF (assessment domains) ship their requirements pre-mapped.

The privacy programs keep their records as program documents with immutable revisions and named approval: USDP self-attestation (you write the officer's statement), consumer-rights requests, privacy-notice and opt-out evidence and data protection assessments; GDPR records of processing (Article 30), DPIAs and data-subject requests; ISO/IEC 27701 PII processing. CMMC and NIST SP 800-53 keep a system security plan and a plan of action; ISO/IEC 42001 and the AI RMF keep an AI system register (with impact assessments for ISO/IEC 42001); the CSF, ISO/IEC 42001 and HITRUST keep a profile, statement of applicability or readiness summary. In each, the implementation of every requirement is derived from live proof and tests, and a plan of action never makes a requirement implemented. A newly enacted or amended state law arrives as a library revision on the Control library page; accepting it proposes the resulting state change for your review. Not yet shipped: FedRAMP readiness, ISO/IEC 27701:2025 and HITRUST requirement statements (licensed).
