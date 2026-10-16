# Evidence contract clauses — gr-evidence-contract-1

Contract: `CONTRACT.md` at 360750f (75 clauses). A clause is **done** only when the
whole clause has a working path a person can use and a cited public-door test.
**partial** names what exists and what is missing. **missing** has no product path.
"Needs account" marks a built and tested connection flow whose live acceptance
needs a provider account, credential or paid plan the fleet does not hold.

| | Done | Partial | Missing | Done % |
| --- | --- | --- | --- | --- |
| Before (main 60039d3, measured 17 Oct; all existing suites passing) | 7 | 12 | 56 | **9.3%** |
| After (this round) | 13 | 22 | 40 | **17.3%** |

Before was re-measured, not copied: every cited suite (`tests/evidence.mjs`,
`review.mjs`, `archive.mjs`, `import.mjs`, `agent.mjs`, `site.mjs`, `browser.mjs`,
`review-browser.mjs`, `email-link.mjs`) passed on the unchanged clone.

## Clauses

| Clause | Before | After | Proof (files and public-door tests) and what remains |
| --- | --- | --- | --- |
| PROGRAM-001 | missing | **done** | `src/evidence/program/{storage,http,view,readiness}.ts`, `src/evidence/library/*`; `tests/program.mjs` (four core programs pre-mapped with zero unmapped requirements; scope fields; applicability exclusions with rationale; assessor review; ISO 27001:2013→2022 edition change as a reviewed mapping change; export with owners, exclusions, edition history and unresolved obligations; no certification asserted). Framework documents are PROGRAM-003. |
| PROGRAM-003 | missing | missing | — (system description, SoA, HIPAA risk analysis, SAQ worksheets). |
| PROGRAM-004 | missing | missing | — |
| LIBRARY-001 | missing | partial | Done: versioned library (`src/evidence/library/controls.ts`, 112 controls) mapped to all 455 requirements of SOC 2 (incl. optional categories), ISO 27001:2022 clauses 4–10 + Annex A (and 2013), HIPAA Security + Breach Notification, PCI DSS v4.0.1; every control names proof; build check `scripts/library-check.mjs` (run in Verify); GitHub code catalogue with per-provider console/API/Terraform remediation and an unsupported class with its manual requirement (`src/evidence/tests/catalogue.ts`); How-to-remediate panel; hourly scheduling; stale intervals (`tests/github.mjs`). Missing: cloud, hosting, identity, app, vulnerability, monitoring, HRIS and device catalogues; library revisions as reviewable updates; policy templates linked per control (titles only). |
| PROGRAM-002 | missing | **done** | `src/evidence/program/control.ts`, `view.ts`; `tests/program.mjs` (AC-04 mapped across SOC 2/ISO/HIPAA/PCI; owner + contributor + due date; proof attached once counts in every mapping; custom mapping added and removed with reason; scope add/remove with reason; audit-period report keeps both denominators with the changed-definition label). Expiring exceptions: `tests/api.mjs`. |
| CONTROL-001 | partial | partial | Owner-written controls, custom framework mappings with history (`tests/program.mjs`). Missing: control revisions, multiple evidence requirements per control in the UI, CSV/XLSX custom-framework import, AGENT-006 proposals. |
| READINESS-001 | partial | partial | Program readiness separates proof completeness from automated test results, drills from every total to its requirements, shows failing sources and explains its calculation (`tests/program.mjs`, `tests/api.mjs`). Missing: filters by product/owner/period/severity, period comparison and trend, board/auditor exports with per-item SLA and freshness. |
| PROOF-001 | done | done | `src/evidence/upload.ts`, `storage.ts`; `tests/evidence.mjs`. Receipts may now also carry an owner-asserted effective date (`receipt_effective_dates`). |
| GAP-001 | done | done | `src/evidence/model.ts` (`gapIn` keeps the four calendar periods unchanged); `tests/evidence.mjs`. |
| CADENCE-001 | missing | partial | Done for evidence requirements: semi-annual/annual, effective-date anchor (8-month-old report leaves 4 months), fiscal-year and audit-window anchors, one-off renewal date for the current cycle only, prospective schedule revisions with historical periods unchanged, due-soon lead and deduplicated owner reminders at lead and deadline (`src/evidence/cadence.ts`, `renewals.ts`, `program/schedule.ts`; `tests/program.mjs`). Missing: recurrence for policy reviews, vendor reviews, training and access-review campaigns (those records do not exist yet). |
| COLLECTION-001 | missing | partial (needs account) | Scheduled GitHub collection from the Cron Trigger with durable one-at-a-time runs, coverage, connector revision, timestamps, terminal outcome, unreadable repositories kept as gaps, throttling with bounded backoff, expired grants, interrupted-run closure, stale reads made unknown (`src/evidence/connect/collect.ts`; `tests/github.mjs`, GitHub faked at the network edge). Missing: source events/webhooks, cursors, audit-period stamping, schema-drift detection, other providers; live sandbox acceptance needs a read-only GitHub org token. |
| CONNECT-001 | missing | partial | Connections UI with exact read permissions, account binding, unsupported classes, latest read, reconnect; AES-GCM custody under an installation-derived key; rotate, revoke (credential destroyed), reconnect; credentials never in listings, logs or archives; restored connections inactive; API push for buyer collectors (`src/evidence/connect/*`, `src/evidence/archive/program.ts`; `tests/github.mjs`). Missing: an installable owner-reviewed private-network collector and its reconciliation journey. |
| API-001 | missing | **done** | `src/evidence/api/*`, `src/evidence/resources.ts`; `tests/api.mjs` (scoped expiring tokens; foreign-installation, revoked, cookie-only and out-of-scope calls refused with no write; 50-resource idempotent push with unchanged timestamps; full sync marks removed with history; per-item schema refusals; custom `mfa_enforced` test labelled source-reported through the token in test results and readiness; cursor/changed-since reads of programs, controls, requirements, tests, test results, remediation, policies, people, vendors, risks reconciled with owner views; 429 with retry time; evidence push labelled source-reported; every call audited); OpenAPI 3.1 at `/v1/openapi.json`; `docs/API.md`. |
| CLOUD-001 | missing | missing | — (AWS/GCP/Azure need accounts) |
| CLOUD-002 | missing | missing | — |
| CODE-001 | missing | partial (needs account) | GitHub only: repository inventory, privacy, branch protection, required reviews and checks, organization two-factor enforcement, Dependabot and secret-scanning alert counts, selected private repositories, revoked access as unknown (`src/evidence/connect/github.ts`; `tests/github.mjs`). Missing: merge/deployment history, departed members (unsupported until an HRIS/IdP source), dependency manifests, GitLab, Bitbucket Cloud and Azure DevOps (need accounts); live GitHub sandbox proof needs a read-only org token. |
| IDENTITY-001 | missing | missing | — |
| APPS-001 | missing | missing | — |
| MONITOR-001 | missing | missing | — |
| HRIS-001 | missing | missing | — |
| DEVICE-001 | missing | missing | — |
| DEVICE-002 | missing | missing | — |
| VULN-001 | missing | missing | — |
| VULN-002 | missing | missing | — |
| ISSUES-001 | missing | missing | — |
| INVENTORY-001 | missing | missing | — (resources exist for tests; no unified inventory view) |
| POPULATION-001 | missing | missing | — |
| TEST-001 | missing | **done** | `src/evidence/tests/{engine,storage,criteria,http,view}.ts`, `scheduler.ts`; `tests/api.mjs` and `tests/github.mjs` (catalogue, API and custom tests; hourly/daily schedule from the Cron Trigger and source-change runs; immutable observations with criteria revision, source, interval and pass/fail/unknown/not-applicable; criteria revision and scope exclusion with rationale keep earlier failures; expiring exceptions never rewrite observations; throttled/revoked/stale reads become unknown, never a pass). Start a test from its control (`/app/tests?controls=…`). |
| REMEDY-001 | missing | **done** | `src/evidence/remedy/*`; `tests/api.mjs` and `tests/github.mjs` (failed test → durable obligation with item, mapped controls, severity, owner, target date, next action, per-provider guidance, SLA deadline and source observations; assign, comment, attach change; marking done stays awaiting verification; the automatic re-test fails and keeps it open; source fix verifies; regression reopens with both observations; time-bounded risk acceptance with approver and expiry reopens on expiry). Tracker-closed re-tests arrive with WORK-001. |
| REMEDY-002 | missing | partial (needs account) | SLA policies by category and severity with shipped defaults, prospective policy changes, per-item clocks, exception pauses, within/approaching/missed status in the queue and API, time-to-remediate filters, one escalation per cycle, re-test within one 5-minute tick of closing work in Evidence or a source change (`tests/api.mjs`). Missing: SLA status in readiness, test history and board/auditor exports; Jira, GitHub Issues and Asana closes (WORK-001, need accounts). |
| WORK-001 | missing | missing | — (Vector and trackers next round) |
| WORK-002 | missing | missing | — |
| FOLLOWUP-001 | missing | partial (needs account) | Durable, deduplicated email follow-ups through Base mail (Resend/SendGrid) with accepted/failed/uncertain outcomes for renewals, SLA escalations and expired risk acceptances (`src/evidence/followup.ts`; `tests/program.mjs`, `api.mjs`, `risk.mjs`, mail faked at the network edge). Missing: Slack and Microsoft Teams (need workspaces), escalation chains, business calendar, quiet hours, pause/acknowledge, weekly digest. |
| RISK-001 | missing | **done** | `src/evidence/risk/*`; `tests/risk.mjs` (risks from library, import, form and API; scenario, assets, likelihood, impact, inherent/residual, method revision, owner, review date, treatment plan with test verification; links to controls, failing tests, vendors and incidents; time-bounded residual acceptance that expires and escalates once; passing re-test verifies treatment without touching assessments; CSV register export). Obligation page links "Record this failure as a risk". |
| RISK-002 | missing | partial | 103-scenario library across the nine areas with control and asset matching; CSV/XLSX import with mapping, dry run, duplicate and owner detection, labelled imported; form; API with risk-push scope; owner-set versioned method (3×3–5×5, labels, product or matrix, thresholds) that never rescores history (`tests/risk.mjs`). Missing: level definitions and terminology, reviewable library revisions, the HIPAA risk analysis start (PROGRAM-003). |
| VENDOR-001 | missing | partial | Vendor inventory (owner, data access, criticality, review date) linked from risks (`tests/risk.mjs`). Missing: diligence, questionnaires, supplier links, contracts/BAAs, reassessment. |
| VENDOR-003 | missing | missing | — |
| VENDOR-002 | missing | missing | — |
| POLICY-001 | missing | partial | Policy register with exact-revision approval by fingerprint, publication, superseding and a one-year review deadline; policy titles from the library (`src/evidence/policy/*`; `tests/api.mjs`). Missing: shipped templates and builder, policy tests, readiness listing, exceptions, employee assignment. |
| ATTEST-001 | missing | missing | — |
| TRAIN-001 | missing | missing | — |
| LIFECYCLE-001 | missing | missing | — |
| ACCESS-001 | missing | missing | — |
| REVIEW-001 | done | done | `src/evidence/review/*`; `tests/review.mjs`, `tests/review-browser.mjs`. |
| AUDIT-001 | partial | partial | Unchanged. |
| AUDIT-002 | missing | missing | — |
| AUDIT-003 | missing | missing | — |
| TRUST-001 | partial | partial | Unchanged. |
| TRUST-002 | missing | missing | — |
| TRUST-003 | missing | missing | — |
| TRUST-004 | missing | missing | — |
| ANSWER-001 | missing | missing | — |
| ANSWER-002 | missing | missing | — |
| ANSWER-003 | missing | missing | — |
| IMPORT-001 | done | done | `src/evidence/import/*`; `tests/import.mjs`. |
| MIGRATE-001 | partial | partial | Unchanged. |
| MIGRATE-002 | missing | missing | — |
| CUSTODY-001 | done | done | `src/evidence/archive/*`; `tests/archive.mjs`, `tests/review-browser.mjs`. Archive version 3 adds the program extension; versions 1 and 2 still restore. |
| PORTABLE-001 | partial | partial | Archive v3 now accounts for every program table explicitly, refuses incomplete listings, omits token digests and credentials, restores tokens without authority and connections inactive (`src/evidence/archive/program.ts`; `tests/github.mjs`). Missing: erasure fences, offline disaster-recovery guide, archives past 20,000 rows. |
| AUTH-001 | partial | partial | Adds scoped, expiring, revocable API tokens that cannot approve or publish. Roles, SSO, SCIM missing. |
| SECURE-001 | partial | partial | Adds connector credential custody and declared read permissions. Record-level grants, flow declarations and key rotation missing. |
| ERASE-001 | missing | missing | — |
| LOG-001 | partial | partial | Adds `product_audit` (append-only, no secrets) for program, control, test, remediation, connection, token, policy and risk actions, and per-call API audit; carried in archive v3. Erasure anonymization and unified export missing. |
| OPS-001 | partial | partial | Adds the Cron Trigger scheduler with per-step outcomes, durable collection claims and interrupted-run closure. Cost disclosure, health surfaces and backup status missing. |
| MOBILE-001 | partial | partial | Existing 1440/390 journeys pass; new pages use the same responsive primitives but have no browser journey or axe run yet. |
| PUBLIC-001 | done | done | `tests/site.mjs`, `tests/browser.mjs` pass unchanged. |
| AGENT-001 | done | done | `tests/agent.mjs`. |
| AGENT-002 | missing | missing | — |
| AGENT-003 | missing | missing | — |
| AGENT-004 | missing | missing | — |
| AGENT-005 | missing | missing | — |
| AGENT-006 | missing | missing | — |
| AGENT-007 | missing | missing | — |
| AI-001 | missing | missing | — |
| BOUNDARY-001 | partial | partial | Programs state the assessor that decides each framework and never assert certification. |

## Built this round

PROGRAM-001, PROGRAM-002, API-001, TEST-001, REMEDY-001, RISK-001 (done); LIBRARY-001,
CADENCE-001, COLLECTION-001, CONNECT-001, CODE-001, REMEDY-002, FOLLOWUP-001,
RISK-002, VENDOR-001, POLICY-001 (now partial); PORTABLE-001, LOG-001, AUTH-001,
SECURE-001, OPS-001, READINESS-001, CONTROL-001 (partial, widened).

## Needs account

- CODE-001 / COLLECTION-001: a fine-grained read-only token for a sandbox GitHub
  organization (live acceptance); GitLab, Bitbucket Cloud and Azure DevOps accounts.
- FOLLOWUP-001: Slack and Microsoft Teams workspaces; production Resend or SendGrid key.
- REMEDY-002 / WORK-001: Jira Cloud, GitHub Issues and Asana sandboxes.

## Next round

WORK-001 (Vector first, then Jira/Linear/GitHub Issues), REMEDY-002 completion,
FOLLOWUP-001 (Slack, Teams, weekly digest), CLOUD-001 (AWS read-only role),
IDENTITY-001 (Google Workspace, Okta), POLICY-001 templates with ATTEST-001,
CADENCE-001 recurrence for policy and vendor reviews, POPULATION-001, READINESS-001
exports, LIBRARY-001 revisions.
