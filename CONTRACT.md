# Evidence target product contract

Target date: **16 October 2026**. Evidence is an owned security compliance automation and customer-trust product for a US security or operations lead at a 20–250 person business. A buyer can replace Vanta, Drata or Secureframe for framework readiness, continuous control testing, policy and employee compliance, remediation, risk/vendor management, auditor collaboration and customer security reviews. Comp AI, Sprinto and Delve are the comparison set for the next step: agents carry a failed control to a narrowly authorized fix and fresh source proof, while preserving the original failure. Existing immutable receipts, honest gaps, imports and reviewer folders remain the provenance layer within the complete job.

## Product target

| | |
| --- | --- |
| Category | Security compliance automation and customer trust (SOC 2, ISO 27001, HIPAA, PCI DSS) |
| Incumbents a buyer switches from | Vanta, Drata, Secureframe |
| Up-and-comers it must also beat | Comp AI, Sprinto, Delve |
| First buyer | A US security or operations lead at a 20–250 person business preparing for SOC 2, ISO 27001, HIPAA or PCI DSS readiness, or moving its program off Vanta, Drata or Secureframe; one installation for the business, costs in USD |

The primary journey: a US security lead moves in from an incumbent or starts fresh, connects cloud, code, identity and people sources, runs SOC 2 on the shipped control library, fixes failing tests through owned and re-tested remediation, keeps policies, training and access reviews current, gives the auditor a workspace for the audit period, and answers customer security reviews from cited proof.

## How to read this contract

- This follows the RER contract standard. This is the product to build toward, not a description of today’s release: Core is what a buyer switching from Vanta, Drata or Secureframe uses in the first week, plus the push-further agent work; Agent surface and Later are reported separately.
- Done means every acceptance point passes through Evidence's own doors (owner, employee, auditor and reviewer routes, the public API, the scheduler door, official-schema provider fakes at the network edge and seeded runs) in a recorded Verify run. Partial names the delivered part and the gap; missing means the target behavior has no product path. Future acceptance journeys below are requirements, not claims that planned screens/routes exist.
- Real-world proof Evidence cannot produce in its own repository (live provider tenants, a funded incumbent export, licensed questionnaire content, a human screen-reader pass) is in the Field proof register; it never blocks done.
- Door rules D-1 to D-8 are stated once below; a clause that lists them proves them at its own door.
- ACCEPTANCE.md and docs/CLAIMS.md are generated from this file. Rulings are in RULINGS.md, history in CHANGELOG.md, and exact rules, bounds and formats in `docs/rules/`.

## Door rules

- **D-1.** Provenance stays truthful. The receipt origin vocabulary is exactly source-observed, manually-asserted or imported, and pushed API records are source-reported. Only a successful authorized source read produces source-observed evidence; manual uploads, pushed records, forwarded events and imported artifacts cannot impersonate it. Imported history cannot establish current proof, and a result computed over pushed or manual data says so.
- **D-2.** Unknown is never passing. An unreadable, revoked, expired, throttled, truncated, stale or unsupported source makes the affected results unknown or incomplete, never passing and never empty. An inaccessible account, asset or person cannot disappear from the denominator, an unsupported evidence class never counts as passing, and failures do not refresh a pass.
- **D-3.** History is never rewritten. A later pass, revision, exception, mapping, scope, policy or library change applies prospectively; every earlier observation, receipt, decision and period result keeps the exact revision it was evaluated under and stays inspectable.
- **D-4.** Restore grants nothing. A restored archive leaves connections, credentials, collectors, schedules, event grants, reviewer links, callbacks, external shares and agent access inactive until the owner authorizes each again; restored reviewer links stay permanently closed.
- **D-5.** A new source meets Inventory. Before a new source or provider ships, it inherits INVENTORY-001 through its own public doors: connection-qualified source identity, every retained source row, reviewed canonical grouping without destructive People merges or automatic email/serial matching, per-source ownership/criticality/scope/lifecycle, honest unknown/unmatched states and reconciled scope export. Ownership grants no auth; inventory exclusion never removes test subjects without the separate explicit test-scope decision.
- **D-6.** New program records join readiness. A clause that adds program records (questionnaire completions and assignments, engagements and requests, trust publication and access, auditor decisions) adds them to the READINESS-001 checklist with reconciled counts and record drilldown before it ships; an area that is not built yet shows 0 recorded, never complete.
- **D-7.** New responsibilities join handover. A clause that adds a responsibility a person holds (auditor request assignments, questionnaire assignments, named policy approvers) joins LIFECYCLE-002 before it ships: a departed holder's open items show "owner left", are reassigned singly or in bulk with a reason, and escalate after the window.
- **D-8.** Later doors keep the shared duties. A capability or provider door that ships after today joins, before it ships, the custody archive (PORTABLE-001), the action audit with actor, reason, revision and outcome (LOG-001), named configuration refusals, bounded and cancellable work, durable outcomes, health and recovery (OPS-001), the no-gate and pre-activation USD disclosure (OPEN-001) and the prerequisites and no-certification rule (BOUNDARY-001). These future records cannot silently be omitted from the archive.

## Shared duties (Base)

| Base duty | Duty | Delta clauses | Base journey |
| --- | --- | --- | --- |
| BASE-ACCESS-001 | Sign-in | AUTH-001 | not run |
| BASE-ACCESS-002 | Sessions | AUTH-001 | not run |
| BASE-ACCESS-003 | Public endpoints | REVIEW-001, TRUST-001, PUBLIC-001 | not run |
| BASE-ACCESS-004 | Server-side authorisation | AUTH-001 | not run |
| BASE-INPUT-001 | Validation | API-001 | not run |
| BASE-INPUT-002 | HTML | SECURE-001 | not run |
| BASE-INPUT-003 | Uploads | PROOF-001, SECURE-001 | not run |
| BASE-SECRET-001 | No leakage | CONNECT-001 | not run |
| BASE-SECRET-002 | Startup | OPS-001 | not run |
| BASE-DATA-001 | Export and import | CUSTODY-001, PORTABLE-001 | not run |
| BASE-DATA-002 | Retention | none | not run |
| BASE-DATA-003 | Erasure | ERASE-001 | not run |
| BASE-DATA-004 | Outbound flows | SECURE-001, OWN-001 | not run |
| BASE-DATA-005 | Independence | OPEN-001, OWN-001 | not run |
| BASE-DATA-006 | Erasure respects retention and legal hold | ERASE-001 | not run |
| BASE-PUBLIC-001 | Privacy | TRUST-001 | not run |
| BASE-PUBLIC-002 | Origins | none | not run |
| BASE-PUBLIC-003 | Accessibility | MOBILE-001 | not run |
| BASE-OPS-001 | Health | OPS-001 | not run |
| BASE-OPS-002 | Migrations | OPS-001 | not run |
| BASE-OPS-003 | Idempotency | WORK-001 | not run |
| BASE-OPS-004 | Failure is visible | OPS-001 | not run |
| BASE-OPS-005 | Audit | LOG-001 | not run |
| BASE-ROLE-001 | Roles through every door | AUTH-001 | not run |
| BASE-AUDIT-001 | Searchable, durable audit | LOG-001 | not run |
| BASE-BACKUP-001 | Independent backup, restore and rollback | PORTABLE-001, OPS-001 | not run |
| BASE-SIGNIN-001 | Standards-based SSO and lifecycle | AUTH-001 | not run |
| BASE-SIGNIN-002 | Native multi-factor authentication | none | not run |
| BASE-INSTALL-001 | Free self-host and removal | OWN-001, OPEN-001 | not run |
| BASE-MAIL-001 | Truthful mail outcomes | FOLLOWUP-001, TRUST-003 | not run |
| BASE-ACCESSIBILITY-001 | One accessibility bar | MOBILE-001 | not run |
| BASE-DOCS-001 | On-site docs from one contract | PUBLIC-001 | not run |
| BASE-AGENT-001 | One MCP door per seed | SURFACE-001 | not run |
| BASE-AGENT-002 | The seed's jobs are tools | SURFACE-001 | not run |
| BASE-AGENT-003 | Records are resources | SURFACE-001, SURFACE-005 | not run |
| BASE-AGENT-004 | Business identity and short-lived tokens | SURFACE-001 | not run |
| BASE-AGENT-005 | An agent acts as a person in a role | AGENT-001, SURFACE-004 | not run |
| BASE-AGENT-006 | Every action declares its risk class | SURFACE-002, SURFACE-003, SURFACE-004, SURFACE-005 | not run |
| BASE-AGENT-007 | The company's policy decides | SURFACE-007 | not run |
| BASE-AGENT-008 | Truthful attribution | AGENT-001, SURFACE-003 | not run |
| BASE-AGENT-009 | Every agent action is audited | none | not run |
| BASE-AGENT-010 | Agents can follow changes | SURFACE-006 | not run |
| BASE-AGENT-011 | Limits are policy, and Pause stops everything | none | not run |
| BASE-AGENT-012 | Writes are idempotent and conflict-safe | SURFACE-001 | not run |
| BASE-AGENT-013 | Manifest, docs and the conformance journey | SURFACE-001, SURFACE-007 | not run |

## Published clauses

- `PROOF-001`: *Tier:* Core · *Cites:* BASE-INPUT-003 · *Rules:* D-1, D-3
- `GAP-001`: *Tier:* Core · *Rules:* D-1, D-2
- `COLLECTION-001`: *Tier:* Core · *Rules:* D-1, D-2, D-4 · *Register:* R-3
- `REVIEW-001`: *Tier:* Core · *Cites:* BASE-ACCESS-003
- `ANSWER-001`: *Tier:* Core · *Rules:* D-6 · *Register:* R-10
- `IMPORT-001`: *Tier:* Core · *Rules:* D-1 · *Register:* R-6
- `CUSTODY-001`: *Tier:* Core · *Cites:* BASE-DATA-001 · *Rules:* D-4
- `AGENT-001`: *Tier:* Core · *Cites:* BASE-AGENT-005, BASE-AGENT-008 · *Rules:* D-4

### Immutable proof and collection

#### PROOF-001 — Immutable exhibits and attributable receipts

**Requirement.** An owner creates Control → Requirement → Exhibit → Receipt. The server reads stored bytes before issuing a receipt, records server time and authenticated actor, ignores forged digest/origin fields, appends explicit same-requirement replacements, and retains original bytes and facts. Each read verifies size and SHA-256. Source-observed, manually-asserted and imported remain distinct; a fingerprint proves unchanged stored bytes, not truth or operation of a control. The receipt rules in `docs/rules/receipts.md` remain binding.

**Acceptance.** Through the controls page and the requirement upload form:
1. Attempt forged receipt facts, replace an exhibit, reload its original receipt and download both versions.
2. Attempt a double replacement, oversized upload and changed/missing object: refuse unsafe writes/downloads and retain facts.

#### GAP-001 — Honest period-specific proof coverage

**Requirement.** The owner desk derives covered, due soon, overdue, missing, superseded-only or unavailable bytes per requirement and selected UTC cadence period. Imported history cannot establish current proof. Storage failure is unavailable, never green. Historical completeness describes recorded assertions and remains separate from observed control effectiveness. The period rules in `docs/rules/periods.md` remain binding. Semi-annual, annual and anchored renewal periods are CADENCE-001; they add periods and never change these four.

**Acceptance.** Through the owner desk and receipt downloads:
1. At the desk select daily, weekly, monthly and quarterly periods, advance across their deadlines and inspect a superseded period, imported-only proof and changed/missing R2 bytes.
2. Reopen a completed historical period and confirm the original state logic.

#### COLLECTION-001 — Scheduled source collection with visible failures

**Requirement.** Owner-authorized collectors run without an open browser on configurable schedules and source events. Every run records account/asset coverage, connector and control revision, source and receipt timestamps, audit period, cursor, completeness and a terminal outcome. Source-observed evidence requires a successful authorized read; manual uploads and imported artifacts cannot impersonate it. Pagination, partial permissions, throttling, expired grants, dropped assets and schema drift create explicit gaps. Bounded backoff resumes collection without duplicate receipts or fabricated catch-up observations. A forwarded source event is an unverified hint that prompts a real authorized read; it never becomes evidence (RL-2). Schedules, event grants, retained context, schema checks and durable continuations follow `docs/rules/collection.md`.

**Acceptance.** Through the Connections UI, the scheduler and the owner reports:
1. Connect an authorized account, schedule collection, close the browser, change the source and inspect the next run.
2. Revoke a required scope, throttle a page and interrupt a run; reconnect and resume.
3. The run history and period report preserve missing coverage, failure and recovery separately; only actual source reads issue observed receipts.
4. Grant forwarded events to one connection with a recorded reason: a new connection denies events, the event token is shown once and stored only as its digest, and the grant and reason are audited.
5. Forward an event: only its fingerprint, token reference, received time and optional unverified reported time are queued, no receipt is issued, and the next scheduler run performs an authorized read before the elapsed interval is due, honoring backoff.
6. Deliver the same event id twice and replay it: one queue entry results; after restart, a committed collection is reconciled before another read.
7. Remove the grant, revoke or let the token expire: pending events never dispatch, and restored tokens and connections stay inactive.

### Audit folders and questionnaires

#### REVIEW-001 — Selected expiring evidence folders

**Requirement.** Owners select controls, an inclusive date range and expiry. A one-time bearer link exposes only the scoped read-only projection, checked on every request and again before disclosure. Closing is terminal; unknown, changed, closed, expired and out-of-scope requests receive the same plain 404. Tokens never appear in stored owner lists, events or archives. Originals inside a folder scope remain visible even after redacted replacement; inspect the full list before sharing. The reviewer rules in `docs/rules/review-folders.md` remain binding.

**Acceptance.** Through the owner folder doors and the public reviewer page:
1. Issue a folder, open its reviewer page and download only in-period exhibits.
2. Try a crossing-period receipt, foreign control, write, altered token, expiry during a read and closed folder.
3. Owner event history retains allowed/refused attempts without raw links.

#### ANSWER-001 — Cited security-questionnaire completion

**Requirement.** Upload XLSX, CSV, DOCX and PDF questionnaires (PDF capture, per-question collaboration and answer-library import are ANSWER-003; portal questionnaires are ANSWER-002), preserve question IDs, sections and required answer format, and draft answers only from authorized approved policies, control observations, audit reports and prior approved answers. Every material assertion cites exact source revision and relevant period; unsupported or contradictory questions stay flagged. Exporting or submitting an answer set reaches a customer and binds the business: a person who approves it approves the exact answer set and recipient in the product, and an agent's call that exports or submits one carries the external and commitment classes, which the company's policy decides. Export preserves the buyer’s template; reusable answers expire or invalidate when sources change. Each draft reports counts of cited, uncited-but-flagged and conflicting answers. An answer is either cited to sources that support every assertion in it or flagged; it is never drafted uncited.

**Acceptance.** Against a populated program (approved policies, passing and failing tests, a SOC 2 report), in Questionnaires:
1. Upload a full-length SIG Lite (XLSX) and CSA CAIQ v4 (XLSX), plus a CSV and a DOCX customer questionnaire, and generate cited drafts.
2. A held-out reviewer key, prepared independently, lists for each question whether the populated sources can answer it and which source supports it; the draft reports cited, flagged and conflicting counts that reconcile to the question total.
3. At least 90% of the questions the key marks answerable are drafted with citations.
4. 100% of citations resolve to the source revision and period they name, and support the claim per the key.
5. Zero answers are uncited or assert beyond their sources, and every question the key marks unanswerable is flagged.
6. Inspect citations, edit and approve an exact version.
7. Modify a source after approval and attempt reuse/submission: require a new decision.
8. Export and reopen the original formats without losing question placement, IDs or flagged gaps.

### Import, custody and approvals

#### IMPORT-001 — Reviewed Drata archive admission and undo

**Requirement.** The owner dry-runs the documented Drata ZIP/HTML-manifest shape, reviews every proposed mapping and unsupported item, explicitly admits a Base journal and can undo active native links while original artifacts and immutable custody remain. Imported history never proves a live control operated. Original archive bytes and source provenance remain available; the supported shape and synthetic-fixture boundary in `docs/DRATA-IMPORT.md` are explicit. A real customer export is field proof (R-6).

**Acceptance.** Through Move-in:
1. Inspect a documented-shape Drata ZIP, review mappings and refuse unsafe/malformed artifacts, admit with a journal, then undo active links.
2. Inspect retained originals and import history after undo, restart and archive restore.

#### CUSTODY-001 — Complete custody archive and empty-target restore

**Requirement.** The owner inventories, streams, dry-runs and restores the current Evidence domain archive, including all controls, requirements, immutable receipts, actor provenance, available verified exhibits, closed reviewer-folder history, import custody/original ZIPs and agent snapshots/decisions. The archive records unavailable bytes honestly, validates all entries before business admission and requires empty product data/bucket. Restoration grants no source-owner, reviewer or agent authority. The versioned format and size bounds in `docs/rules/custody-archive.md` remain binding; this domain archive is how Evidence meets BASE-DATA-001, distinct from Base's generic transfer.

**Acceptance.** Through the archive doors and the archive CLI:
1. Export, inspect the manifest, dry-run and restore into empty real D1/R2; compare every portable record and byte.
2. Try altered digests, traversal, missing/unlisted files, unavailable bytes and a nonempty target.
3. Refusal preserves the target; successful restore leaves grants inactive.

#### AGENT-001 — Agent folder proposals and exact decisions

**Requirement.** An expiring, revocable agent credential reads the permitted desk and prepares an evidence-folder proposal. Its grant can be prepare-only: such a grant gives no sharing, owner-mutation or source-write power, and the person who issues it can revoke it. An approval binds the exact current proposal snapshot; changed or stale snapshots require a new decision. Issuing the approved folder shares evidence outside the business, so an agent's call that would issue one carries the external class, which the company's policy decides. Immutable decisions survive restart and archive transfer without reviving agent authority. See `docs/AGENT-COMMANDS.md`.

**Acceptance.** Through the agent commands and API and the owner agent page:
1. Issue a prepare token, inspect gaps and propose a folder.
2. With that prepare-only token, attempt direct sharing, an owner-only mutation and an approval, and with the owner session a stale-snapshot approval; refuse each.
3. Under the prepare-only grant, the owner approves the current snapshot, revisits its immutable decision and revokes the token.

## Target clauses

### Program and readiness

#### PROGRAM-001 — Framework programs and applicability

*Tier:* Core · *Rules:* D-3

**Requirement.** A US security or operations lead at a 20–250 person business can run SOC 2 Type I and Type II, ISO 27001, HIPAA and PCI DSS programs. Each program records its framework edition, licensed requirement references where necessary, legal entity, in-scope products, teams, regions, systems, audit period, assessor, accountable lead and milestone dates. An applicability review records exclusions and rationale; changing editions creates a reviewable mapping change, never a retroactive pass. Each core program is created pre-mapped to the shipped control library (LIBRARY-001) and produces its framework-required documents (PROGRAM-003); extended and regulated programs are PROGRAM-004.

**Acceptance.** From the program-setup UI:
1. Create each of the four core programs for a US SaaS business, choose two scoped products and different periods, review applicability with an assessor, then upgrade one framework edition.
2. Reopen the program and export it: owners, exclusions, edition history and unresolved obligations survive; excluded work is visible and no certification is asserted.

#### PROGRAM-003 — Framework-required program documents

*Tier:* Core · *Rules:* D-3

**Requirement.** Each core program generates, versions and exports the deliverables its assessor asks for, each with an accountable owner, approver, effective date, annual (or owner-set shorter) review deadline and full revision history:
- **SOC 2:** a system description following the AICPA description criteria (services, principal service commitments and system requirements, infrastructure, software, people, data, procedures, subservice organizations with carved-out/inclusive treatment, complementary user entity controls, and changes during the period). Draft sections pre-fill from connected inventory, approved policies and program scope; every pre-filled statement cites its source record and revision, and unsupported sections stay marked for the owner. Export as DOCX and PDF.
- **HIPAA:** a Security Rule risk analysis per 45 CFR 164.308(a)(1)(ii)(A), covering ePHI systems and flows, threats and vulnerabilities, likelihood/impact, current safeguards and a remediation plan linked to RISK-001. Also the HIPAA policy set and the business associate agreement inventory from VENDOR-001.

Reconcile every document with live program state: a drift between document and program flags the document as needing review, and the approved revision stays retrievable. The ISO 27001 records are PROGRAM-005 and the PCI DSS documents are PROGRAM-006. Evidence never signs an attestation or AOC on anyone's behalf. PROGRAM-003 also carries the RISK-002 document integration: starting the HIPAA risk analysis and adding the shipped library scenarios inside that document. The document model, revisions, citations, exports and drift comparison follow `docs/rules/program-documents.md`.

**Acceptance.** Through Program → Documents:
1. For each core program, generate its documents from a populated program, edit and approve a revision, and export it (system description as DOCX and PDF, SoA as XLSX and PDF, risk analysis and SAQ worksheet as PDF).
2. Then reconcile each document with program state.
3. The SOC 2 description cites the inventory and policy revisions it pre-filled from.
4. Start the HIPAA risk analysis and add its RISK-002 library scenarios inside the document.

#### PROGRAM-005 — ISO 27001 Statement of Applicability and management-system records

*Tier:* Core · *From:* PROGRAM-003 · *Rules:* D-3

**Requirement.** An ISO 27001:2022 program produces a Statement of Applicability listing every Annex A control with included/excluded state, justification, implementation status and linked controls/evidence, plus records for the clause 6.1 risk assessment and treatment plan, a clause 9.2 internal-audit program (independent auditor, scope, findings, nonconformities and corrective actions) and a clause 9.3 management review (required inputs, decisions and actions). An SoA exclusion must match the PROGRAM-001 applicability decision, and a control marked implemented must have a current passing test or accepted evidence.

**Acceptance.** Through Program → Documents on an ISO 27001 program:
1. The SoA lists all 93 Annex A:2022 controls, and its exclusions match applicability.
2. Record an internal audit with one nonconformity and corrective action, and one management review.
3. Fail a test mapped to a control the SoA marks implemented: the SoA flags drift and needs review, and the approved prior revision stays retrievable.

#### PROGRAM-006 — PCI DSS scope, SAQ selection and worksheets

*Tier:* Core · *From:* PROGRAM-003 · *Rules:* D-3

**Requirement.** A PCI DSS v4.0.1 program records cardholder-data-environment scope with data-flow and network diagrams attached as exhibits, guided SAQ type selection (A, A-EP, B, B-IP, C, C-VT, P2PE, D-Merchant, D-Service Provider) with recorded answers, a requirement-by-requirement worksheet for the chosen SAQ, and a handoff package for the Attestation of Compliance that the merchant or QSA signs. Each worksheet names the SAQ revision its requirement ids were read from (RL-5). The licensed PCI SSC text is not shipped; the merchant or QSA confirms the worksheet against the licensed SAQ (`docs/SAQ-WORKSHEETS.md`).

**Acceptance.** Through Program → Documents on a PCI DSS program:
1. Switching the SAQ answers changes the selected type and worksheet.
2. The SAQ A worksheet lists only SAQ A's requirement ids and names its SAQ revision.
3. A not-applicable or CCW response without its explanation blocks approval.

#### PROGRAM-004 — Extended and regulated programs

*Tier:* Core · *Rules:* D-3, D-8

**Requirement.** The same versioned program, library and readiness model runs these programs:
- **US Data Privacy (USDP):** one consolidated control set covering the CCPA as amended by the CPRA and every enacted comprehensive US state privacy law, at minimum Virginia, Colorado, Connecticut, Utah, Texas, Oregon, Montana, Iowa, Delaware, New Hampshire, New Jersey, Nebraska, Tennessee, Minnesota, Maryland, Indiana, Kentucky and Rhode Island. Each requirement carries its per-state citations and effective dates. The applicability review records each state's thresholds (for example California's annual-revenue and consumer/household thresholds, and other states' consumer-count and sale-of-data thresholds) against the business's own figures, and only states that apply generate obligations; the others stay visible as excluded with the recorded figures. The program produces consumer-rights request records, privacy-notice and opt-out (including universal opt-out signal) evidence, data-protection assessment records and a self-attestation document. Newly enacted or amended state laws arrive as reviewable library revisions.
- **ISO/IEC 27701** (the 2019 extension to ISO 27001 and the 2025 standalone edition), with PII controller and processor controls and the privacy information management system records it requires.
- **Further privacy, AI, government and sector programs:** GDPR (for US businesses with EU customers, including Article 30 records of processing, DPIA records and data-subject request evidence); ISO/IEC 42001:2023; NIST AI RMF 1.0; NIST CSF 2.0; NIST SP 800-53 Rev. 5 (Low/Moderate baselines); CMMC 2.0 Level 1 and Level 2 (NIST SP 800-171 Rev. 2) with an SPRS score worksheet; FedRAMP readiness (Moderate baseline); and HITRUST CSF readiness.

Each ships requirements (with licensed text where required), pre-mapped library controls, the program's required document records, and declared assessment or authorization dependencies (an accredited ISO certification body for ISO 27701, a C3PAO, a FedRAMP 3PAO and agency sponsor, a HITRUST assessor; USDP is self-attested, with counsel confirming state applicability). Cross-mapping reuses evidence already collected for core programs. The program model, USDP thresholds, SPRS scoring and edition rules follow `docs/rules/extended-programs.md` and `docs/USDP-CITATIONS.md`.

**Acceptance.** Through program setup and readiness:
1. For each named extended program, create it on a business that already runs SOC 2 through program setup, review applicability, and open readiness.
2. Readiness reports zero requirements without a mapped control, shows the evidence reused from SOC 2, and names the external assessment dependency.
3. Exclude one requirement with a rationale: it stays visible as excluded. Export the program.
4. For CMMC Level 2, readiness also shows the computed SPRS score, and changing one control's state changes the score.
5. For USDP, enter business figures that meet California's and Texas's thresholds but not Montana's: readiness shows California and Texas obligations, Montana stays visible as excluded with the recorded figures, and raising the figures above Montana's threshold adds its obligations as a reviewable applicability change; the self-attestation exports with the applicable states listed.
6. For ISO/IEC 27701, readiness shows the reuse from ISO 27001 and keeps controller and processor controls separately applicable.

#### LIBRARY-001 — Shipped control library mapped to every core requirement

*Tier:* Core

**Requirement.** Evidence ships a versioned common control library pre-mapped to every requirement of each core program: the SOC 2 Trust Services Criteria (2017, revised points of focus 2022) for Security plus the optional Availability, Confidentiality, Processing Integrity and Privacy categories; ISO 27001:2022 clauses 4–10 and Annex A; the HIPAA Security Rule and the Breach Notification Rule; and PCI DSS v4.0.1. Each shipped control carries at least one automated test or a named evidence requirement, plus linked policy templates (POLICY-001). A build-time catalog check guards the library and every connector's test catalog (LIBRARY-002).

**Acceptance.** On a fresh installation and through the build-time catalog check:
1. Create each core program on a fresh installation: readiness reports zero unmapped requirements, and every mapped control shows a test or an evidence requirement.
2. A build-time catalog check enumerates every program requirement and every listed connector evidence class, and fails on any requirement with no control, any control with neither test nor evidence requirement, or any evidence class with neither a shipped test nor an explicit unsupported entry naming its replacement evidence requirement.

#### LIBRARY-002 — Connector test catalogs and how-to-remediate guidance

*Tier:* Core · *From:* LIBRARY-001 · *Rules:* D-2 · *Register:* R-1

**Requirement.** Each named cloud, identity, code, HRIS and device connector ships a published test catalog covering every evidence class its clause lists:
- **Cloud:** IAM/MFA, public storage, encryption at rest and in transit, logging/monitoring, backup and network configuration.
- **Hosting, edge and managed data (CLOUD-002):** member access and MFA/SSO, encryption and TLS, audit logging, backup and recovery, network restrictions and public exposure, per platform.
- **Identity:** MFA, privileged roles, inactive and departed users.
- **App accounts (APPS-001):** departed person with an active account, admin without MFA, local login bypassing required SSO, privileged guest and inactive account.
- **Code:** branch protection, required review and checks, membership and MFA, repository privacy, and dependency/secret alerts.
- **Vulnerability (VULN-001):** findings past their SLA due date, and critical/high findings without an owner or exception.
- **Security issues and incidents (ISSUES-001):** security issues resolved within SLA, open security issues past their due date, and incident tasks completed per the incident response policy.
- **Monitoring and alerting (MONITOR-001):** each in-scope production service has availability and error-rate or latency monitors, a security-event alert routes to a person, every monitor routes to a live notification target, no production monitor is muted beyond the owner-set window, and on-call escalation covers every hour of the coming 14 days.
- **HRIS:** roster and lifecycle completeness.
- **Device:** encryption, screen lock, OS/patch, MDM enrollment and EDR sensor health.

A platform that does not expose an evidence class lists it in its catalog as unsupported, together with the manual evidence requirement that replaces it. Every connector that exists today (AWS, Google Cloud and Azure under CLOUD-001; Okta, Google Workspace, Entra ID and JumpCloud under IDENTITY-001; GitHub under CODE-001 and CONNECT-001) ships its catalog and is enumerated by the build-time check. Each later clause that adds a connector ships its catalog, per-provider remediation steps (with a Terraform snippet or a stated absence of a Terraform provider) and build-time check entries before it ships: CLOUD-002 (hosting, edge and managed data, including the Vercel deployment-protection test), APPS-001, VULN-001, ISSUES-001, MONITOR-001, HRIS-001 and DEVICE-001. Each catalog entry states the criteria, evaluated resource type, mapped controls and cadence, plus remediation steps for every provider it runs against: the console steps, the equivalent CLI or API call and, for cloud and hosting configuration tests on a platform with a Terraform provider, a Terraform snippet that sets the passing configuration. A platform without a Terraform provider has its entry say so. A test's Results page shows these steps in a How to remediate panel for the provider of each failing resource, and the guidance on its REMEDY-001 obligation is drawn from them, pinned to the library revision. Acceptance runs against fakes built from each provider's documented API at the network edge, as CLOUD-001 does; applying the Terraform snippet in a live account is field proof (R-1).

**Acceptance.** Through the build-time catalog check and a test's Results page:
1. The build-time check fails on any test entry with no remediation steps for a provider it runs against, and on any cloud or hosting configuration test with neither a Terraform snippet nor a stated absence of a Terraform provider.
2. Fail an AWS S3 public-access test and a Vercel deployment-protection test: each Results page shows the How to remediate panel for its own provider, the AWS entry includes a Terraform snippet, and applying that snippet makes the next run pass.

#### LIBRARY-003 — Test cadence and stale intervals

*Tier:* Core · *From:* LIBRARY-001 · *Rules:* D-2

**Requirement.** Scheduled configuration tests run at least once per hour per connected account, and population and period tests at least daily. Each catalog entry and the readiness view show the last-run time, and a missed run appears as a stale interval, never as a carried-forward pass.

**Acceptance.** With a connected cloud account and the scheduler:
1. Connect one cloud account and leave it for two hours: at least two runs per configuration test appear.
2. Pause the scheduler for an hour: that interval shows as stale.

#### LIBRARY-004 — Reviewable library revisions

*Tier:* Core · *From:* LIBRARY-001 · *Rules:* D-3

**Requirement.** Library updates arrive as reviewable revisions and never retroactively change results. Every installation starts at shipped library revision 1; each later shipped revision is a change set of control-to-requirement mappings (and, for PROGRAM-006 and PROGRAM-004, SAQ scope and state-law changes) listed under Control library with the programs it would affect. Programs follow the installation's accepted revision until the owner accepts a later one with a reason, an accepted revision is never rolled back, and every test run keeps the library revision in force when it ran. The acceptance, change-set and archive rules follow `docs/rules/library.md`.

**Acceptance.** Through Control library:
1. Accept a library revision: earlier observations keep the revision they were evaluated under.

#### LIBRARY-005 — One observation counts in every framework it maps to

*Tier:* Core · *From:* LIBRARY-001

**Requirement.** A connected test mapped to a shared library control is observed once, and that single observation decides every requirement mapped to the control across all programs on the installation, with no copied evidence.

**Acceptance.** On one installation running SOC 2, ISO 27001 and HIPAA programs:
1. Let one connected test mapped to a shared library control (for example an MFA test on the logical-access control) pass once: each program's readiness shows every requirement mapped to that control as passing from that single observation, with one observation and no copied evidence in the store.
2. Fail the same test: all three programs show those requirements failing from the same observation.

#### PROGRAM-002 — Reusable mappings and accountable ownership

*Tier:* Core · *Rules:* D-3

**Requirement.** One versioned control can satisfy explicitly mapped requirements in several frameworks without duplicating evidence. Every mapping states the implementation, test, evidence requirements, scope and accountable human, with delegated contributors and due dates. Scope changes, accepted exceptions and mapping changes retain actor, reason and effective period; no scope reduction silently improves a historical result.

**Acceptance.** In the program UI:
1. Map an access-review control to SOC 2, ISO 27001 and HIPAA, assign an owner and contributor, attach period evidence once, and inspect all three mappings.
2. Remove an asset from scope with a reason: earlier denominators and the changed-definition label remain in the audit-period report.

#### CONTROL-001 — Custom controls and testing intent

*Tier:* Core · *Rules:* D-3

**Requirement.** Owners create and revise custom controls, framework requirements, evidence requirements, cadence (the GAP-001 calendar periods and the semi-annual, annual and anchored periods of CADENCE-001), applicability, test intent and evaluation criteria alongside shipped templates. Revisions take effect prospectively; prior observations retain the exact revision evaluated. Custom mappings are first-class and exportable. A control's applicability, test intent and evaluation criteria are owner-written definition text; automated tests retain their own versioned structured criteria, and every new run captures both. The revision and capture rules follow `docs/rules/controls.md`.

**Acceptance.** Through the control form and the historical report:
1. Create a custom production-access control through the control form, add two evidence requirements and a custom framework mapping, revise its test intent after a failed observation, then view both revisions in the historical report.
2. The earlier failure keeps its original meaning.

#### CONTROL-002 — Custom framework import from CSV or XLSX

*Tier:* Core · *From:* CONTROL-001 · *Rules:* D-3

**Requirement.** A custom framework, such as a customer security addendum or an internal framework, can be imported from a CSV or XLSX file through a reviewed import. Owners map columns for requirement ID, title, description, section and an optional mapping to library control IDs. A dry run shows what will be admitted, and row-level validation refuses invalid rows (a duplicate requirement ID, a missing title or an unknown control ID) without admitting them. The confirmed import becomes a revision of that custom framework, labeled with the file, importer and time, and the original file is kept as an exhibit. Imported requirements without a mapping stay visible as unmapped in readiness. An agent may propose mappings; AGENT-006 carries those proposals, each decided individually on its exact revision, and whether a person or an agent's call decides one is the company's policy for its class. Re-importing a revised file shows added, changed and removed requirements for review before anything changes. A removed requirement keeps its history and earlier observations, and is never deleted.

**Acceptance.** Through the framework import:
1. Import an 80-row XLSX customer security addendum: the dry run refuses one duplicate requirement ID and one unknown control ID and admits nothing until confirmed.
2. Confirm: 78 requirements appear, those mapped in the file show their controls, and readiness counts the rest as unmapped.
3. Re-import a revised file with three changed rows and one removed: the review lists exactly those four changes, and after confirmation the removed requirement remains in history with its earlier observations.

#### READINESS-001 — Readiness, trend and executive reports

*Tier:* Core · *Rules:* D-2, D-6

**Requirement.** The readiness view separates recorded proof completeness, automated test effectiveness, policy/personnel completion, risks, exceptions and auditor decisions. Filter by framework, product, owner, period and severity; drill from each total to its denominator and source. Board/auditor exports include scope, open obligations, overdue work, per-item SLA status (REMEDY-002), collection freshness, test last-run times and trend history. Missing, stale, unsupported and untested work remains visible; any score explains its calculation and does not label a business certified. Each program shows one readiness percentage: the share of its in-scope requirements that are ready (mapped, proof current, every mapped test passing and every required policy approved and current), shown with the counts it was computed from and the program's checklist areas (policies, access reviews, vendor risk, trust center and the others the program uses), each with its own count. Unknown, stale and untested requirements count as not ready, so 100% means every in-scope requirement is ready today, never that the business is certified. The calculation, staleness, filters and daily snapshots follow `docs/rules/readiness.md`.

**Acceptance.** From readiness and its exports:
1. Compare current and prior audit periods with a stale connector, failed test, accepted exception and missing policy attestation.
2. Follow every displayed total to records, export the report, and reconcile counts and period boundaries.
3. A filtered or failed read cannot create a passing result.
4. On a SOC 2 Type II program with 50 in-scope requirements, 47 of them ready: readiness shows 94% with "47 of 50 requirements ready" and its calculation, and the checklist lists policies, access reviews, vendor risk and trust center with their own counts.
5. Let one passing test's collector go stale: the percentage drops to 92%.
6. Make the remaining three requirements ready: it shows 100%, and no page or export uses the word certified.

### Evidence provenance and continuous observation

#### CADENCE-001 — Annual, semi-annual and anchored evidence renewal

*Tier:* Core · *Rules:* D-1, D-3

**Requirement.** Evidence requirements, policy and vendor reviews, training campaigns and access-review campaigns can recur semi-annually or annually, in addition to the four GAP-001 calendar periods. Typical annual and semi-annual evidence includes the penetration test, BCP/DR test, incident-response tabletop, risk assessment, board or management security review, vendor reassessment and semi-annual access reviews of low-risk systems. Each such requirement chooses one anchor:
- **Effective date (default):** the next due date is the exhibit's effective date plus the period. The effective date is an owner-asserted receipt fact (for example the pentest report date), recorded separately from the server upload time, so uploading an eight-month-old report leaves four months of coverage, not twelve.
- **Fiscal year:** periods start on an owner-set fiscal-year start month.
- **Audit window:** periods align to the program's audit period start (PROGRAM-001).
- **One-off custom renewal date:** overrides the next due date for the current cycle only, with actor and reason recorded; later cycles return to the anchor.

The covered → due soon → overdue states and their precedence (unavailable bytes, superseded-only, missing) follow the GAP-001 rules. Due soon begins at an owner-set reminder lead (default: the final 20% of the period, as for the other periods), and FOLLOWUP-001 sends deduplicated reminders to the requirement owner at the lead and at the deadline. Imported material still cannot establish current proof. Changing a requirement's period or anchor takes effect prospectively, and historical periods keep the definition they were evaluated under. The daily, weekly, monthly and quarterly logic is unchanged.

**Acceptance.** Through requirement setup, the desk and the test-harness clock:
1. Create an annual penetration-test requirement and upload today a report whose effective date is eight months ago: the requirement shows covered with a due date four months out (effective date plus twelve months), not twelve.
2. Advance the test-harness clock: it moves covered → due soon (one reminder sent and not repeated on restart) → overdue at the deadline, with a deadline reminder.
3. Create a semi-annual access-review requirement anchored to an audit window that starts 1 February: periods run February–July and August–January.
4. Anchor an annual risk assessment to a July fiscal year.
5. Set a one-off custom renewal date on the pentest requirement: it moves the current deadline only, and the next cycle returns to the effective-date anchor.
6. Upload an imported annual report: it stays imported and does not establish current proof.
7. Reopen a historical quarterly period and an annual period from before a period change: each keeps its original state.

#### CONNECT-001 — Least-privilege integration custody and custom collectors

*Tier:* Core · *Cites:* BASE-SECRET-001 · *Rules:* D-2, D-4

**Requirement.** The Connections UI exposes exact scopes, account/tenant binding, covered and unsupported resources, latest successful read and reconnect instructions. Read-only OAuth/provider apps or scoped role grants are the collection default. Secrets are encrypted under installation-local custody, kept out of archives and rotated or revoked without resurrecting old authority. Buyers can install a reviewed custom read-only connector or private-network collector for on-premises systems using the same observation protocol, or push source-reported resources and evidence through the public API (API-001). Provider registration, permissions review and deployment are engineering deliverables, not manual-upload substitutes. The installable private-network door is the fixed read-only Git collector (`docs/PRIVATE-COLLECTOR.md`); its registration, receiving credential, clock and staleness rules follow `docs/rules/connections.md`.

**Acceptance.** Through Connections and the installed private collector:
1. Authorize, rotate, revoke and reconnect a provider through Connections; attempt cross-tenant use and export/restore.
2. Validate that secrets never appear and restored connectors remain inactive.
3. Install one owner-reviewed private collector, inspect unsupported resources and a lost connection, and reconcile its read-only output with the actual private source.
4. Run the installed collector against an actual private local Git repository through registration, scoped receiving credentials, loss/recovery, staleness, rotation/revocation and inactive archive restore.
5. Exercise native provider credential custody on a GitHub connection, and show owner review, installation, failure/recovery and revocation at 1440 and 390.

#### API-001 — Public REST API for pushed resources, custom tests and program state

*Tier:* Core · *Cites:* BASE-INPUT-001 · *Rules:* D-1

**Requirement.** A versioned, documented public REST API (OpenAPI 3.1 specification published with each release) uses scoped, expiring, revocable API tokens bound to one installation and named scopes. Tokens can be read-only, resource-push or evidence-push; a token never approves or publishes. Its operations are:
- **Push resources.** Idempotent upsert by caller-supplied `uniqueId` within a declared custom resource type and schema, with deletion and full-sync semantics that mark absent resources as removed rather than silently dropping them.
- **Push evidence documents.** Attach evidence to a requirement.
- **Define and run custom tests.** Custom tests over pushed or connected resources declare criteria, mapped controls and cadence, and produce TEST-001 observations.
- **Read state.** Read programs, controls, requirements, test results, remediation obligations, policies, people and vendors, with cursor pagination and changed-since filters.

The API resource identity remains (`type`, `uniqueId`) across token replacement; provider-observed resources are instead qualified by their connection. Every pushed record is labeled source-reported through the named token and its owner, distinct from source-observed collection and from manual assertions. A test result over pushed data says so. Rate limits return explicit 429 responses with a retry time. Every call is audited under LOG-001. Breaking changes require a new version, and a deprecated version keeps working for at least 12 months. The calls are documented in `docs/API.md`.

**Acceptance.** Through Settings → API and the public API:
1. Issue a resource-push token in Settings → API.
2. With a script, push 50 resources of a custom `internal_service` type, then push the same payload again: there are no duplicates and the update timestamps are unchanged.
3. Run a full sync that omits one resource: it is marked removed, and its history remains.
4. Define a custom test requiring `mfa_enforced=true`. One resource fails, and the readiness view shows the result labeled source-reported via the token.
5. Read the program, test and remediation state through the API and reconcile it with the UI.
6. A token from another installation, a write outside the token's scopes and a revoked token are each refused with no partial write.
7. A schema-invalid payload is rejected per item with reasons.

#### CLOUD-001 — AWS, Google Cloud and Microsoft Azure

*Tier:* Core · *Rules:* D-2 · *Register:* R-1

**Requirement.** Native AWS, Google Cloud (GCP) and Microsoft Azure connections inventory in-scope accounts/projects/subscriptions and collect IAM/MFA, public storage, encryption, logging, backup and network-configuration evidence. Scheduled tests from the published CLOUD catalog (LIBRARY-002), at least hourly, expose exact resources and applicable exclusions, including organizational child accounts; an inaccessible account cannot disappear from the denominator. Acceptance runs at each provider's official-schema network edge; live provider accounts are field proof (R-1).

**Acceptance.** Through Connections for each provider:
1. Connect an authorized account through Connections, discover a child account/project/subscription, and run every catalog test, covering IAM/MFA, public storage, encryption, logging, backup and network classes, with at least one failing resource.
2. Change a setting at the provider, re-test, and revoke one read permission.
3. The failing resource, missing coverage, original observations and recovery are individually visible.

#### CLOUD-002 — Heroku, Vercel, DigitalOcean, Cloudflare, Netlify, Supabase, MongoDB Atlas and Snowflake

*Tier:* Core · *Rules:* D-2, D-5, D-8

**Requirement.** Native read-only connections to the hosting, edge and managed-data platforms that small SaaS companies run production on inventory their teams, projects, apps, zones, clusters, databases and warehouses. Each platform ships a published LIBRARY-002 catalog, run at the CLOUD-001 cadence, for the evidence classes it exposes:
- **Heroku:** team members and MFA/SSO enforcement; Heroku Postgres continuous protection, rollback and backup schedules; Private Spaces and trusted IP ranges; automated certificate management and HTTPS; audit trail.
- **Vercel:** team members and SAML enforcement; deployment protection on preview and production; audit log; HTTPS and certificate state; public exposure of preview deployments.
- **DigitalOcean:** team members and two-factor enforcement; Droplet backups; managed-database backups and trusted sources; cloud firewalls; Spaces bucket ACLs and public objects.
- **Cloudflare:** account members and two-factor enforcement; SSL/TLS mode, minimum TLS version and Always Use HTTPS per zone; WAF and managed rules; audit logs.
- **Netlify:** team members and SAML enforcement; deploy-preview password or SSO protection; HTTPS; audit log.
- **Supabase:** organization members and MFA enforcement; point-in-time recovery and backups; row-level security on exposed tables; network restrictions; SSL enforcement.
- **MongoDB Atlas:** organization and project users and MFA; IP access list (including an open 0.0.0.0/0 entry); encryption at rest with customer keys where configured; cloud backup and snapshots; database auditing.
- **Snowflake:** users with MFA or key-pair authentication; network policies; Time Travel and fail-safe retention; access history and login history; account-level encryption settings.

An evidence class a platform does not expose is listed as unsupported in its catalog, with the manual evidence requirement that replaces it. As in CLOUD-001, an inaccessible team, project or account cannot disappear from the denominator.

**Acceptance.** Through Connections for each of the eight platforms:
1. Connect an authorized sandbox through Connections and run every catalog test with at least one deliberately failing resource.
2. Examples: a Heroku Postgres database without continuous protection, an unprotected Vercel preview, a DigitalOcean Space with a public object, a Cloudflare zone with minimum TLS 1.0, an unprotected Netlify deploy preview, a Supabase table without row-level security, an Atlas IP access list open to 0.0.0.0/0, and a Snowflake user without MFA.
3. Fix each in the real platform and observe a pass, with both observations retained.
4. Revoke one read permission per platform: the affected resources show missing coverage and stay in the denominator.
5. The catalog lists each unsupported class with its manual requirement, and the build-time check fails if any class has neither a test nor that entry.

#### CODE-001 — GitHub, GitLab, Bitbucket Cloud and Azure DevOps change assurance

*Tier:* Core · *Rules:* D-1, D-2, D-4, D-5, D-8 · *Register:* R-3

**Requirement.** GitHub and GitLab provider apps, a Bitbucket Cloud app (repositories, branch restrictions, merge checks and required approvals, Bitbucket Pipelines deployments) and an Azure DevOps (Azure Repos and Pipelines) connection collect repository inventory and privacy, branch protection, required reviews/checks, merge and deployment history, membership and MFA/two-step enforcement, departed members, dependency manifests and vulnerability evidence. Dependency and secret-scanning alerts feed VULN-001, and dependency manifests feed AI-001's AI SDK discovery. Scope includes private repositories explicitly granted by the owner. Audit-period evidence links a production change to its review/check outcome and source revision; missing event history is unknown. Bitbucket's write-capable restriction-read scope is a named exception to CONNECT-001's read-only default, used only for GET reads after an audited owner consent (RL-3). Private original manifests are captured and included in custody exports only after an authorized connection manager explicitly selects the repositories, immutable paths and revisions, purpose and recipient custody; otherwise they stay denied, with read-only source access, private downloads, secret exclusion and disabled restored grants (RL-103). The per-provider rules follow `docs/rules/code-providers.md` and `docs/CODE-MANIFESTS.md`.

**Acceptance.** Through Connections for each code provider:
1. Connect each of GitHub, GitLab, Bitbucket Cloud and Azure DevOps, select two repositories and run branch-protection/branch-policy, reviewed-change, membership-MFA and repository-privacy tests.
2. Merge an authorized reviewed change (through a Bitbucket Pipelines deployment for Bitbucket), remove protection on one repository, make one repository public and revoke access to the other.
3. Inspect source links, event period coverage, failure and unknown states without exposing repository secrets.
4. Bitbucket makes only GET calls and refuses any non-GET call, and records an audited owner consent reason before credential use and again on rotation.

#### IDENTITY-001 — Google Workspace, Microsoft 365, Entra ID, Okta and JumpCloud

*Tier:* Core · *Rules:* D-2 · *Register:* R-2

**Requirement.** Google Workspace, Microsoft 365 / Entra ID, Okta and JumpCloud directory connections collect user/group, privileged-role, MFA, lifecycle and sign-in evidence for compliance checks and access reviews. Reconcile identities across sources using reviewable matches; suspended accounts, service identities, guests and contractors remain explicit populations. Accounts held directly in SaaS apps, outside the IdP, come from APPS-001. Live directory tenants are field proof (R-2).

**Acceptance.** Through Connections for each named identity service:
1. Connect a tenant via Connections, ingest an admin, employee, guest and service account, and test MFA and inactive-user access.
2. Disable one account and deny one scope.
3. Reconcile duplicates with a human decision and inspect fresh source readback and incomplete coverage.

#### APPS-001 — App-level account connectors for access reviews and leaver checks

*Tier:* Core · *Rules:* D-2, D-5, D-8

**Requirement.** Read-only connectors pull accounts directly from the SaaS apps themselves, not only from the IdP, because local accounts created outside SSO, in-app admin roles and app-level MFA are what quarterly reviews and leaver checks catch. The named apps are Slack, Salesforce, Atlassian (Jira and Confluence Cloud), Zoom, Notion, HubSpot, Zendesk, 1Password, Datadog and PagerDuty. Each connector collects every account with its app identifier and email, its account type (owner, admin, member, guest, or service/bot), app roles and privileges, status (active, suspended or deactivated), sign-in method (SSO or local password) and, where the app exposes them, app-level MFA state and last activity. An attribute an app does not expose shows as "not exposed", never as passing. Each app's accounts feed four places:
- **Inventory (INVENTORY-001):** account, role and MFA facts, matched to people through reviewable matches; unmatched accounts stay visible.
- **Access reviews (ACCESS-001):** the app's frozen population, with no upload; revocations close only on source readback.
- **Leaver verification (LIFECYCLE-001):** every connected app where the leaver holds an account is a monitored account on the checklist, closed only by a source readback showing it deactivated or removed. Apps without a connector appear as manual check-offs that close only with an attached exhibit or a re-uploaded account list (POPULATION-001), labeled manual.
- **Tests (LIBRARY-002 app-account catalog):** a departed person still has an active account, an admin without MFA, a local login bypassing required SSO, a guest with a privileged role, and an account inactive beyond the owner-set window.

Connectors never deactivate accounts. Revocation happens in the app, or through AGENT-003's separate writer.

**Acceptance.** Through Connections, Inventory, People and Access Reviews:
1. For each of the ten named apps, connect a sandbox workspace through Connections and ingest an admin, a member and a guest.
2. Each appears in Inventory with role, status and MFA state (or "not exposed"), matched to its person.
3. Terminate in a connected HRIS a person who holds an account in every app: the leaver checklist lists each app as a monitored account and stays open, and the departed-user test fails for each app while its account is active.
4. Deactivate the account in each app: the next source readback closes that item, and the checklist closes only when all ten are verified.
5. Add an unconnected app: it appears as a manual check-off and closes only with an attached exhibit.
6. Start a quarterly access review: its frozen population includes each connected app's accounts and roles without any upload.

#### MONITOR-001 — Monitoring and alerting evidence from observability tools

*Tier:* Core · *Rules:* D-2, D-8

**Requirement.** Read-only connectors collect the production monitoring and alerting configuration that SOC 2 CC7.2, ISO 27001:2022 A.8.16, the HIPAA audit-controls standard and PCI DSS Requirement 10 call for, from the tools teams actually alert from:
- **Datadog:** monitors, downtimes and mutes, notification handles and Cloud SIEM detection rules (under a monitor read scope separate from APPS-001's account read);
- **New Relic:** alert policies, conditions, muting rules and notification destinations;
- **Grafana Cloud:** alert rules, contact points, notification policies and silences;
- **Sentry:** issue and metric alert rules with their actions;
- **PagerDuty:** services, escalation policies and on-call schedules;
- **[Uptime](https://github.com/just-every/run-uptime):** monitors and notification routes, read through the sibling product's API.

AWS CloudWatch alarms, Google Cloud Monitoring alerting policies and Azure Monitor alert rules come through CLOUD-001's logging and monitoring class and feed the same tests. Each monitor is recorded with its source ID and link, name, query or target, service and environment tags, notification targets, state, mute or silence status with start and end times, and last triggered time. Owners map monitors to in-scope production services in Inventory (INVENTORY-001) by tag rule or explicit selection; the mapping is a reviewable revision. Notification targets resolve to people, on-call schedules or channels, and a target that resolves to a deactivated person or a deleted schedule counts as not routed. The MONITOR tests in the LIBRARY-002 catalog run at least daily, and on-call coverage is evaluated over the coming 14 days. A muted monitor fails after the owner-set window (default 7 days) unless an approved, expiring exception covers it. Connectors never create, change or mute a monitor.

**Acceptance.** Through Connections and Inventory with six named sources and two production services:
1. Connect a sandbox for each of the six named sources through Connections and map two production services.
2. Service A has an availability monitor and an error-rate monitor in Datadog routed to a PagerDuty schedule; service B has only an availability monitor in New Relic. The coverage test passes for A and fails for B, naming the missing monitor type.
3. Add a Grafana Cloud error-rate alert for B: the next run passes.
4. Mute A's error-rate monitor and advance the test-harness clock eight days: the mute test fails. Approve a seven-day exception: it passes until the exception expires.
5. Deactivate in the IdP the only person a Sentry alert routes to: the routing test fails for that alert.
6. Leave a six-hour gap in the PagerDuty schedule next week: the on-call test fails, naming the uncovered hours.
7. Map an Uptime monitor to service B: it counts toward B's availability coverage.
8. Revoke the Datadog grant: A's Datadog-backed tests show unknown, not passing, and earlier observations remain.

#### HRIS-001 — BambooHR, Gusto, Rippling, Justworks, Deel HR and ADP Workforce Now personnel sources

*Tier:* Core · *Rules:* D-5, D-7, D-8

**Requirement.** BambooHR, Gusto, Rippling, Justworks, Deel HR and ADP Workforce Now integrations synchronize the employee and contractor roster (W-2 and 1099), manager, department, employment type, start and termination dates as authoritative lifecycle inputs. Buyers review source conflicts rather than merging people silently. Compensation, SSNs and bank data are unnecessary and excluded from the requested scope. Payroll is the separate [Envelope](https://github.com/just-every/run-envelope) sibling seed. An HRIS without a connector uses the labeled CSV roster route (POPULATION-001), never an unlabeled roster. A leaver this clause imports records its departure through the People departure door, so LIFECYCLE-002 flags, requests and escalates the handover of everything the person holds.

**Acceptance.** Through Connections and People for each of the six named HRIS:
1. Connect each of the six named HRIS, import a joiner, mover and leaver, then correct a start date and terminate an account in the real source.
2. The People UI shows source priority, conflict review, correct obligations and no collected payroll or tax identifiers.
3. In a Rippling sandbox, terminate a person who still has an active Okta account: on the next HRIS sync the departed-user identity test fails, naming that person, their Okta account and the Rippling termination date, and a REMEDY-001 obligation opens.
4. Deactivate the account in Okta: the next identity read passes, and both observations are retained.

#### DEVICE-001 — MDM and EDR posture: Jamf, Intune, Kandji, JumpCloud, Addigy, NinjaOne, CrowdStrike, SentinelOne and Defender for Endpoint

*Tier:* Core · *Rules:* D-2, D-5, D-8

**Requirement.** The MDM sources Jamf, Microsoft Intune, Kandji (now Iru), JumpCloud, Addigy and NinjaOne supply managed-device inventory, ownership, encryption, screen-lock, OS/patch and management status. The EDR sources CrowdStrike Falcon, SentinelOne Singularity and Microsoft Defender for Endpoint supply agent presence, sensor health and last-seen time, protection or policy mode, and active-threat state per device. Correlation exposes unmanaged or unmatched endpoints, devices with an MDM record but no healthy EDR sensor, and missing collection; compliance tests do not replace MDM or EDR operation.

**Acceptance.** Through Connections and the device tests:
1. Connect each of the six MDM sources, match a device to a person, change encryption or patch state in a sandbox and run a fresh test.
2. Connect each of the three EDR sources, and for each put one sensor into an unhealthy or disabled state: the sensor-health test fails for that device, then passes after recovery.
3. A missing device feed, a device with no EDR sensor or an unmatched endpoint stays a gap; the original failed posture and correction remain attributable.
4. In a Jamf sandbox, turn FileVault off on a Mac matched to a person: the disk-encryption test fails on that device within the next hourly run and opens a REMEDY-001 obligation for the device's owner with its REMEDY-002 due date.
5. Turn FileVault back on: the obligation closes only after the passing re-test, and the failing and passing observations both stay on record.

#### DEVICE-002 — Owned read-only device monitor for computers without MDM

*Tier:* Core · *Rules:* D-2, D-8

**Requirement.** Evidence ships its own signed, read-only device monitor for macOS (13 and later, notarized package), Windows (10 and 11, signed MSI) and Linux (Ubuntu 18.04 and later and Debian 10 and later, signed .deb package), for businesses without an MDM or for devices outside it. Employees install it from their onboarding checklist, and administrators can deploy it silently with an enrollment token. It reports through the same observation protocol and person↔device matching as DEVICE-001 at least every hour while the device is online. It checks:
- full-disk encryption: FileVault, or BitLocker on the system drive;
- an approved password manager installed;
- active antivirus/endpoint protection (XProtect/third-party on macOS, Microsoft Defender or third-party on Windows);
- screen lock after 60 minutes or less of inactivity, with a password required on wake;
- OS version within the owner's supported window.

On Linux it checks full-disk encryption (LUKS/dm-crypt on the root volume), screen lock where a GNOME or KDE session exposes it, and OS version. Checks it cannot read on a Linux device report unknown and open that device's manual evidence requirement. The monitor holds no write authority. It does not collect browsing history, file contents, keystrokes or location, and it states exactly what it reads. A device that stops reporting becomes stale after the owner-set window (default 14 days) and then unknown. Uninstalling or tampering is reported when observable. Stale, uninstalled and never-reporting devices are never counted as passing.

**Acceptance.** On real macOS, Windows, Ubuntu and Debian devices through the employee checklist:
1. Install the monitor on a real macOS and a real Windows device through the employee checklist, and confirm each device matches its person.
2. For each of the four required checks, put the device into the failing state (encryption off, no password manager, protection disabled, lock above 60 minutes), observe a failing result within the next reporting interval, fix it and observe a pass, with both observations retained.
3. Disconnect one device past the stale window, then uninstall the monitor from the other: each shows stale or unknown and the device test does not pass.
4. Inspect the declared data list; the payload contains nothing beyond it.
5. Install the .deb on a real Ubuntu device with LUKS and a real Debian device without it: Ubuntu passes encryption and Debian fails it.
6. Set the Ubuntu GNOME lock above 60 minutes and observe a fail, then a pass after fixing it.
7. The checks the Linux monitor cannot read show unknown with the manual requirement open, and neither device passes on them.

#### VULN-001 — Vulnerability findings from scanners, code and cloud-native sources

*Tier:* Core · *Rules:* D-2, D-3, D-8

**Requirement.** Integrations ingest findings from Tenable, Qualys, Snyk, GitHub Dependabot (with GitHub code-scanning and secret-scanning alerts), AWS Inspector (EC2, ECR and Lambda), Google Cloud Artifact Registry (Artifact Analysis) and Security Command Center, Microsoft Defender for Cloud, Semgrep, Aikido and Wiz. Every finding, whatever its source, gets one lifecycle:
- asset linkage (host, image, function, repository or cloud resource) and source severity normalized to critical/high/medium/low, with CVE/CWE where given;
- deduplication across sources that retains every source ID and history;
- first-detected and last-seen times, accepted time-bounded exceptions, and verified resolution only through a fresh source read. Scanner silence or a deleted finding is not proof of remediation.

**SLA due dates are fixed at detection.** Each finding's remediate-by date is its first-detected time plus the vulnerability SLA for its severity in force at that moment (REMEDY-002), and the finding records the SLA policy revision used. A later SLA policy change applies only to findings first detected after the change and never moves an existing due date. An approved exception pauses the clock. A finding that recurs after verified resolution reopens with its original source IDs and history, and the recurrence is recorded. Findings approaching or past their due date alert their owner through FOLLOWUP-001, and per-finding SLA status appears in readiness, the remediation queue and board/auditor exports, reconciled with the vulnerability-remediation population without rewriting earlier observations. Penetration-test findings follow the same lifecycle through VULN-002, and a connected scanner's fresh read is retest evidence that closes a VULN-002 finding awaiting verification. Security issues that people raise, such as bug-bounty reports, customer-reported issues and internal findings, come from the team's own tracker through ISSUES-001. Evidence delegates scanning compute to the authorized scanner. GitHub's dependency and secret findings already feed a source-finding register (`docs/rules/code-providers.md`) that this lifecycle inherits.

**Acceptance.** Through Connections, Vulnerabilities and the remediation queue:
1. Connect each of the ten named sources via Connections and ingest at least one finding from each.
2. Ingest a Dependabot alert and an AWS Inspector ECR finding for the same CVE on the same service: they deduplicate into one finding retaining both source IDs.
3. Link it to a control and remediation task, accept a time-bounded exception and let it expire.
4. Change the critical-severity SLA from 15 to 7 days: every existing finding keeps its due date, and the next new critical finding gets 7 days.
5. Correct the sandbox issue and perform a fresh source read: only verified resolution closes the compliance obligation, with original findings retained.
6. Reintroduce the issue: the finding reopens with its history.

#### VULN-002 — Penetration-test findings with retest-verified closure

*Tier:* Core · *Rules:* D-1, D-3

**Requirement.** Owners import penetration-test and other manual assessment findings through a reviewed CSV/XLSX import with column mapping and a dry run. The mapped fields are title, severity, affected asset, description, CVE/CWE, tester, report date and recommended fix, and row-level validation refuses invalid rows without admitting them. The original report (PDF) is kept as an immutable exhibit. Each finding carries manual provenance (tester, report and date), links to the assets it affects, and gets the VULN-001 SLA due date from the report date under the policy then in force. An owner marking a finding fixed leaves it awaiting verification. It closes only on retest evidence: a tester's retest letter or report attached and approved by a named reviewer, or a connected scanner's fresh read showing it resolved (VULN-001). Pentest findings appear in readiness, the AUDIT-002 vulnerability-remediation population and auditor packs, and the annual penetration-test requirement (CADENCE-001) is satisfied by the report. The import, due-date, asset-matching and reviewer rules follow `docs/rules/pentest-findings.md`.

**Acceptance.** Through Vulnerabilities → Import:
1. Import a 12-row pentest findings CSV with its PDF report. The dry run refuses one row with a missing severity and admits nothing until confirmed.
2. Confirm: 11 findings appear labeled manual with tester, report date and SLA due dates.
3. Mark one fixed without retest evidence: it stays awaiting verification.
4. Attach a retest letter and have the reviewer approve: it closes, with the original finding and report retained.
5. The AUDIT-002 vulnerability-remediation population lists the pentest findings with their provenance.

#### ISSUES-001 — Security issues from the team's own trackers

*Tier:* Core · *Rules:* D-1, D-2, D-3, D-8

**Requirement.** Evidence reads the security issues a team already tracks, read-only, so they become source-observed evidence with SLA tests and Type II populations, without CSV exports. Owners configure one or more selectors per source and per task type. Each WORK-001 destination is a source, with these selectors:
- **Jira Cloud,** including Jira Service Management projects: a label (default `security`) or a JQL query;
- **Linear:** a label, optionally limited to teams;
- **GitHub Issues and GitLab Issues:** a label, or an issue search query, across the organizations CODE-001 connects;
- **Azure Boards:** a tag or a WIQL query;
- **Asana, Shortcut, ClickUp and Vector:** a tag or label within chosen projects, workspaces or boards;
- **YouTrack:** a tag or a search query;
- **Freshservice:** a tag, or its native incident ticket type;
- **monday.com:** a status or label column value on chosen boards;
- **Basecamp:** a chosen project and to-do list.

Reads use a read scope. Where WORK-001 already holds a write grant to the same tracker, ingestion uses only its read scopes, and an ingestion-only connection never holds write scope. Evidence never writes to a tracker through ISSUES-001. Each record keeps its source, source ID and link, title, task type, the selector revision it matched, created time, resolved time and every reopened time, assignee and status, and severity. Severity comes from the tracker's priority through an owner-reviewed mapping per source, with a label fallback (for example `sev1`); a source with no priority field uses the selector's default severity. Each record is labeled source-observed from the tracker, with its retrieval time. Evidence stores the title and link, not the issue body or comments; a snapshot of the body and comments is captured as an exhibit only when the record is sampled (AUDIT-002) or an owner attaches one, and the owner can preview what will be captured. On connection, Evidence back-fills matching issues from source history for an owner-chosen lookback that covers at least the current audit period. A security issue gets its own REMEDY-002 SLA clock in the security-issue category, fixed at its tracker creation time from the SLA policy revision then in force; a priority change recomputes the due date from the original creation time under the same revision, and the change is recorded. An approved, expiring exception pauses the clock. Closure is the tracker's resolution, recorded as "resolved in tracker" with its time, distinct from a verified re-test; a reopened issue resumes its original clock and keeps every resolution. When a security issue is linked to a failing test or a VULN-001 finding, that obligation still closes only on a verified re-test. Approaching and missed due dates alert, through FOLLOWUP-001, the assignee when matched to a person in Evidence, and otherwise the selector's owner. Security issues appear in readiness, the remediation queue and board and auditor exports as tracker-owned items; no WORK-001 ticket is created for them, because one already exists. The LIBRARY-002 catalog gains "security issues resolved within SLA", reporting each issue as within SLA, SLA missed, open and overdue, or open within SLA, shareable into AUDIT-003 like any other test.

**Acceptance.** Through Connections and the security-issue test:
1. In a Jira Cloud sandbox, label three issues `security` at high priority. Resolve two, one inside and one outside the SLA, and leave the third open past its due date.
2. The "resolved within SLA" test shows one within SLA, one SLA missed and one open and overdue, each with its Jira link and the policy revision used, and the resolved issues read "resolved in tracker", not verified.
3. Reopen the on-time issue: it resumes its original clock and keeps both times.
4. Repeat with a Linear issue and a GitHub issue selected by label, with a GitLab issue selected by label, with an Azure Boards item selected by WIQL, and with a Jira JQL query in place of the label: each is ingested with its link and SLA status.
5. Change the critical SLA: existing due dates stay.

#### ISSUES-002 — Incidents and incident tasks from trackers and incident tools

*Tier:* Core · *From:* ISSUES-001 · *Rules:* D-1, D-2, D-8

**Requirement.** Incident-management records (the incident itself) and incident-resolution records (the corrective follow-up, such as root cause, post-incident review and remediation tasks, linked to its incident through tracker links, sub-issues or parent issues) come from the ISSUES-001 selectors and from PagerDuty and incident.io, selected by service, severity or priority. Incident management and incident resolution are kept distinct throughout, and an issue matching several selectors is recorded once per task type under the same source ID. Incident-management and incident-resolution records feed the AUDIT-002 incidents population, and security issues feed its security-issues population. Each population records every source and selector revision used, retrieval time, completeness and record count. A zero-record population is a non-occurrence only when every configured source was read completely for the whole period; a revoked grant, an unreadable tracker, a truncated or rate-limited read, or a period gap makes the population incomplete, never empty. The incident test reports, per incident in the period, whether it is resolved and whether each linked resolution task was completed within the deadline in the incident response policy revision in force (POLICY-001), showing that revision; the LIBRARY-002 catalog gains "incident tasks completed per policy", shareable into AUDIT-003.

**Acceptance.** Through Connections and the AUDIT-002 incidents population:
1. Label two Jira issues `incident` inside a Type II period, link a post-incident review task to one, and leave the other's resolution task open past the policy deadline.
2. Generate the AUDIT-002 incidents population: it reconciles to the two issues with retrieval metadata, one can be sampled with its body captured as an exhibit, and "incident tasks completed per policy" passes for one and fails for the other.
3. Trigger a PagerDuty incident on a selected service: it joins the population with its source.
4. Revoke the Jira grant and regenerate: the population shows incomplete, not zero, and cannot be recorded as a non-occurrence.

#### ISSUES-003 — Selector revisions and tracker offboarding and procurement tasks

*Tier:* Core · *From:* ISSUES-001 · *Rules:* D-3, D-8

**Requirement.** Changing a label, tag or query creates a reviewable selector revision. Before approval, the owner sees how many records the new revision matches against the current one. A revision applies from its approval and never rewrites earlier populations, observations or SLA results. Records that stop matching keep their history, labeled "no longer selected". Two optional task types also feed from selectors: **offboarding** feeds the LIFECYCLE-001 leaver checklist as a tracker-recorded completion, which never replaces an account or device readback, and **vendor procurement** opens a review-required VENDOR-001 intake for the vendor named.

**Acceptance.** Through selector settings and the leaver checklist:
1. Change the label: the preview shows the old and new match counts, and earlier populations keep the selector revision they were generated under.
2. Label a Jira issue `offboarding` for a leaver: the checklist shows it completed in the tracker, while the leaver's app accounts still need readback.

#### INVENTORY-001 — Unified assets, people and ownership

*Tier:* Core · *Rules:* D-2, D-3, D-4

**Requirement.** A compliance inventory reconciles cloud and hosting resources (CLOUD-001, CLOUD-002), code repositories, applications and their app-level accounts (APPS-001), vendors, devices, people and service accounts from connected sources and approved manual entries. Each record has source identity, owner, criticality, scope, last observation and lifecycle state; deduplication and exclusion are reviewable. Inventory supports framework scoping and access-review populations without replacing HRIS, CMDB or endpoint management. Source identity is qualified by connection/source and record kind; identical emails, serials or provider IDs never group records automatically, and every source row, original People ID and history remains. Ownership grants no authentication or authorization, and inventory grouping, scope exclusion and retirement never remove test subjects. HRIS-001, DEVICE-001, CLOUD-002, APPS-001 and LIFECYCLE-001 assert their inherited source/checklist doors when they ship (D-5). The grouping, metadata-decision and People rules follow `docs/rules/inventory.md`.

**Acceptance.** Through Inventory, People and their exports:
1. Through current Inventory doors reconcile duplicate person/device records by explicit grouping, assign an unowned service and retire/exclude it with a reason.
2. Export every source member/row and reconcile counts, canonical membership and history, including unmatched/excluded/retired records.
3. Restore the archive and restart without losing decisions or original rows.
4. Remove GitHub/AWS collection permission and reconnect an identical provider ID through a different connection: retain distinct sources and unchanged test subjects.
5. Through the same People identities explicitly assign role policies, enroll role training and freeze an access-review population; record a departure and verify future campaigns exclude the person while prior history remains.
6. The Inventory console shows these states at 1440 and 390.

#### POPULATION-001 — Labeled CSV populations for unsupported systems

*Tier:* Core · *Rules:* D-1, D-2

**Requirement.** For an HRIS, application, identity source or device fleet with no connector, owners upload a CSV roster, account list or device list against a published column template. Required columns are named; others are mapped on upload. Each upload is an immutable, manually-asserted exhibit (PROOF-001) that records uploader, upload time, declared source system and as-of date. It feeds Inventory and access-review populations, labeled manual provenance everywhere it appears. Rows reconcile to people and devices in Inventory through reviewable matches, with unmatched rows kept visible. A CSV population never creates source-observed evidence, never satisfies a test that requires a source read, and goes stale after its declared as-of date plus the owner-set refresh window.

**Acceptance.** Through Inventory → Upload population and the People and Inventory views:
1. Upload a Justworks-style roster CSV and an account list for an unconnected SaaS app through Inventory → Upload population.
2. Map one renamed column, resolve one ambiguous person match, and leave one row unmatched.
3. The People and Inventory views show both lists labeled manual with the upload time.
4. A test requiring source reads stays unknown for those records.
5. Upload a revised list: the original exhibit stays, and the differences appear as joiners, leavers and removed accounts.
6. Let the refresh window pass: the population shows stale.
7. A malformed file is refused with row-level reasons, and nothing is admitted.

#### TEST-001 — Continuous control tests and exception discipline

*Tier:* Core · *Rules:* D-2, D-3

**Requirement.** Framework tests from the shipped catalog (LIBRARY-002), API-defined tests (API-001) and owner-defined custom tests run on their schedule (configuration tests at least hourly, population and period tests at least daily) and on source change events against the declared asset population. Each immutable observation keeps expected criteria, evaluated revision, source references, interval and result: pass, fail, unknown or not applicable with approved rationale. Configuration snapshots and event/period tests are distinct. Tune noisy tests with reviewed scope, thresholds and expiring exceptions; suppressing alerts never rewrites observations or closes risk.

**Acceptance.** From a mapped control and its test results:
1. From a mapped control enable a scheduled MFA or reviewed-deployment test, confirm it runs at least hourly, fail a real source setting and inspect all resource results.
2. Tune scope with an expiring exception, interrupt collection, and revise criteria.
3. A later pass, expired exception or revised denominator never erases the earlier failure or fills an unobserved period.

### Remediation and follow-through

#### REMEDY-001 — Failed test to verified remediation

*Tier:* Core · *Rules:* D-3

**Requirement.** A failed test creates or links a durable remediation obligation with affected assets, control/framework mappings, severity, accountable owner, guidance (the test's per-provider remediation steps, LIBRARY-002), deadline, next action and source evidence. Owners triage, assign, comment and attach changes. A re-test starts automatically when the linked task closes in Evidence or in any WORK-001 tracker (per item when tickets are per item, WORK-002), or when a relevant source change event arrives, and owners can also request one. A ticket marked done remains awaiting verification until an independent real-source re-test passes; failures reopen work and time-bounded risk acceptance has an approver and expiry.

**Acceptance.** Through a test's Remediate action and the obligation:
1. Fail a real connected control, follow its Remediate action, assign an owner and due date, attach a change and mark work done before fixing the source. The obligation remains open.
2. Fix the source, re-test and observe verified closure.
3. Regress it and confirm reopening with both observations retained.

#### REMEDY-002 — Remediation SLAs and automatic re-test

*Tier:* Core · *Rules:* D-3

**Requirement.** Owners define SLA policies by test category (cloud, identity, code, device, vulnerability, security issue, personnel, policy, vendor) and severity, with shipped default SLA days per category. Each failing user, device, account, resource or vulnerability finding gets its own SLA clock starting at its first failing observation. A vulnerability finding's due date is fixed at first detection from the SLA policy revision then in force (VULN-001); changing a policy applies only to findings first detected afterwards. A tracker-sourced security issue (ISSUES-001) is clocked the same way from its tracker creation time, and its closure is recorded as the tracker's resolution rather than a verified pass. The clock pauses only for an approved, expiring exception and resets only on verified pass. Readiness, test history, the remediation queue and board/auditor exports show each item as within SLA, approaching or SLA missed, with time-to-remediate history filterable by period, owner and category. SLA breaches escalate through FOLLOWUP-001. A linked task closing in Evidence or in any WORK-001 tracker, or a source change event, automatically queues a re-test within 15 minutes, with no human action; a per-item ticket (WORK-002) re-tests only its item. If that re-test fails, the obligation reopens and the SLA clock keeps running. Every new WORK-001 destination inherits automatic re-test within 15 minutes, per-item scope and preservation of a still-failing clock before it ships. SLA day counting, exception unions and time-to-remediate follow `docs/rules/remediation.md`.

**Acceptance.** With a 7-day SLA for high-severity identity failures and the test-harness clock:
1. Set a 7-day SLA for high-severity identity failures. Fail MFA for two real users, fix one within the SLA, and let the other's clock pass the deadline using the test-harness clock: one item shows within SLA and resolved, the other SLA missed with an escalation sent.
2. Export the board report and reconcile per-item SLA status.
3. Close the linked Jira ticket without fixing the source: a re-test starts automatically with no human action, fails, and keeps the obligation open.
4. Repeat that step with a GitHub Issues ticket and an Asana task: each close starts a re-test with no human action.
5. Fix the source: the source event triggers a re-test that verifies closure.
6. Apply an expiring exception: the clock pauses, then resumes when it expires.

#### WORK-001 — Two-way remediation tickets in Vector and twelve external trackers

*Tier:* Core · *Cites:* BASE-OPS-003 · *Rules:* D-4 · *Register:* R-4

**Requirement.** Remediation can create and synchronize a linked ticket in [Vector](https://github.com/just-every/run-vector) or in any of these trackers, each connected by its own authorized OAuth app or API token:
- Jira Cloud and Linear;
- GitHub Issues and GitLab Issues (the organizations CODE-001 connects, under a separate issue-write grant that collection credentials never hold), and Azure Boards (Azure DevOps work items);
- Asana, Shortcut, ClickUp and monday.com;
- Basecamp, Freshservice and YouTrack.

Every destination gets the same behavior:
- **Mapping.** A per-destination project, board or list, and field mapping for owner, due date, priority, status, labels and a description with source links. Explicit field rules state which side owns each field.
- **Two-way sync.** Comments synchronize both ways. Inbound webhooks, or polling where a tracker has none, bring the tracker's assignee and status into Evidence within 15 minutes.
- **Basecamp callback.** Basecamp webhooks are unsigned: the owner registers a callback from Evidence, using a unique 256-bit secret address sealed per destination and never displayed or exported. Only that address admits events with matching account/project and stable event IDs; events prompt authorized source reads and never establish source truth. The five-minute scheduler checks registration hourly for provider deactivation or changed/unavailable registration; failed checks destroy local callback authority and show a reconnect state, while ten-minute polling remains the backstop. A publicly reachable HTTPS installation is required. Custody restore excludes callback secrets and leaves the destination inactive.
- **Visible failures.** Authorization loss, a deleted remote ticket, a field-mapping failure and conflicting edits on both sides are shown on the linked obligation with the remote value, the local value and the time. Nothing is silently overwritten.

Ticket granularity and tracker status on tests are WORK-002; Evidence-origin writes to tracker assignees and statuses are WORK-003. Reading the security issues and incidents people raise in these trackers is ISSUES-001. Closing a ticket on any destination triggers a re-test (REMEDY-001, REMEDY-002) and is never a verified fix. Evidence owns the compliance obligation and its verification; Vector and the external trackers own general project execution. Related independent RunEditRun sibling: [Pegboard](https://github.com/just-every/run-pegboard) (work and project management). Native fields, callbacks, polling and comment retention follow `docs/TRACKERS.md` and `docs/rules/trackers.md`; live tracker accounts are field proof (R-4).

**Acceptance.** For each of the thirteen destinations:
1. Connect an authorized project, create a ticket from one failed control, change assignee and status in the tracker and in Evidence, and deliver the same inbound event twice: exactly one ticket exists, the tracker's assignee and status appear in Evidence within 15 minutes, and the second delivery changes nothing.
2. Edit the same field on both sides: the conflict shows both values and the time.
3. Revoke the tracker grant and delete one remote ticket: each failure is shown on its obligation.
4. Close the remote ticket while the test still fails: a re-test runs with no human action, fails, and Evidence keeps the compliance obligation open.
5. Add a comment in each tracker and inspect it in Evidence: retain text, author, time, stable ID and source link, mark truncation, and enforce the existing need-to-know/privacy limits; activity metadata alone fails acceptance.
6. For Basecamp, register the secret-address callback from Evidence, replay a to-do and comment event, and refuse a wrong secret/account/project.
7. Deactivate the Basecamp registration at the provider and advance the scheduler one hour: callback authority is removed, the owner sees the problem, and polling continues.
8. Restore the archive: no callback secret or registration authority returns.

#### WORK-003 — Evidence-origin writes to mapped tracker assignees and statuses

*Tier:* Core · *From:* WORK-001 · *Register:* R-4

**Requirement.** A signed-in person can write explicitly mapped native tracker assignees and statuses from Evidence, separately from Evidence's accountable owner and compliance state, on every WORK-001 destination. The field editor reads native identities, and a new source read precedes every write: if a selected field changed since the displayed snapshot, no field is written and both tracker and requested values, expected snapshot, actor reason and UTC conflict time remain in Sync history. Unknown native identities refuse writes. Read-back must confirm the requested identities; lost or unconfirmed outcomes stay uncertain and are never reported as success. A write reaches a system outside Evidence, so an agent's call that makes one carries the external class. Until a delegated role names tracker writes (AUTH-001, RL-102), the owner is the only person whose role includes them, and API tokens and unsigned requests are refused.

**Acceptance.** Through the tracker field editor on each of the thirteen destinations:
1. The signed-in owner writes a mapped native assignee and status, and read-back confirms the requested identities; editing Evidence's accountable owner or compliance state does not stand in for that write.
2. Change the field at the tracker after the displayed snapshot: no field is written, and Sync history keeps the tracker and requested values, the expected snapshot, the actor's reason and the UTC conflict time.
3. Request an unknown native identity: the write is refused.
4. Lose the read-back: the outcome stays uncertain and is never reported as success.
5. An API token or an unsigned request cannot use the write door.

#### WORK-002 — Per-test or per-item tickets, with tracker status on tests

*Tier:* Core · *Register:* R-4

**Requirement.** Owners choose, per test, how failures become tickets in a WORK-001 destination:
- **Granularity.** One ticket for the whole test, or one ticket per failing item: resource, user, account, device or vulnerability finding. A remediation-settings default applies to new tests. Changing a test's granularity applies to items that fail afterwards; existing tickets stay linked. With auto-create on, a ticket is created as each new item fails; otherwise Evidence proposes it for one-click creation.
- **SLA per ticket.** A per-item ticket links to that item's REMEDY-002 SLA clock, and its due date is written to the tracker. A whole-test ticket lists its items with each item's deadline, and its due date is the earliest open item's deadline. Newly failing items are added to the whole-test ticket as a comment and an updated item list.
- **Closure.** Closing a per-item ticket re-tests only that item: the item closes only on a verified pass, and other items' clocks are unaffected. Closing a whole-test ticket re-tests every item and closes only the passing ones. If any item still fails, the remote ticket is reopened with a comment naming those items, unless the owner has chosen to open a follow-up ticket instead.
- **Tracker status in Evidence.** The test page and the remediation queue show, for each linked ticket, its destination, key and link, assignee, status and last sync time. A sync older than its interval is marked stale. The remediation queue filters by tracker assignee and status.

Live tracker accounts are field proof (R-4).

**Acceptance.** For each WORK-001 destination:
1. Set a test to per-item tickets and fail it on two resources: two tickets are created, each with its own due date.
2. Change one ticket's assignee in the tracker: the test page and the remediation queue show the new assignee and status within 15 minutes.
3. Close that ticket without fixing the source: a re-test starts within 15 minutes with no human action and fails. That item stays open and its SLA clock keeps running, while the other item's clock runs unaffected.
4. Fix the second resource and close its ticket: only that item closes, as verified.
5. Switch another test to one ticket per test and fail three items: one ticket lists all three with their deadlines.
6. Close it with one item fixed: all three are re-tested, only the fixed item closes, and the remote ticket reopens naming the other two.

#### FOLLOWUP-001 — Email, Slack and Microsoft Teams follow-up

*Tier:* Core · *Cites:* BASE-MAIL-001 · *Register:* R-5

**Requirement.** Email through Resend or SendGrid, Slack and Microsoft Teams deliver actionable remediation, policy, training, vendor-diligence and access-review reminders with private record links. Owners configure escalation, US business timezone, business calendar, quiet hours, cadence, stop rules and destination permissions. Persist the obligation and next action across restarts, deduplicate scheduled sends, expose pending/acknowledged/failed/uncertain outcomes, and stop when work is verified, authority ends or an owner pauses it. A weekly compliance digest goes to each owner and control owner by email, Slack or Teams, on an owner-chosen day and time (default Monday 09:00 in the business timezone). It lists that person's new failures, items due in the next 14 days, overdue and SLA-missed items and expiring exceptions, each linked to its record. A person with nothing open gets no digest unless they opt into an all-clear. Live Slack and Teams workspaces and a production mail key are field proof (R-5).

**Acceptance.** For each named channel and provider:
1. Configure each named channel/provider, let a due obligation escalate across a DST/business-calendar boundary with the browser closed, then restart the worker.
2. Simulate a network-edge timeout and reconnect authorization; inspect delivery uncertainty without duplicate task closure.
3. Complete or pause the obligation and verify later reminders stop while history remains.
4. Let the weekly digest run on the test-harness clock: each control owner receives only their own new failures, upcoming, overdue and SLA-missed items, reconciled to the remediation queue, and a control owner with nothing open receives none.

#### FOLLOWUP-002 — Failure notices with an owner and a due date in Slack, Teams or email

*Tier:* Core · *Register:* R-5

**Requirement.** When a test's failing observation opens a REMEDY-001 obligation, Evidence notifies the obligation's accountable owner at once, on the channel that person chose under FOLLOWUP-001 (email, Slack or Microsoft Teams), without waiting for the SLA to approach. The notice names the test, the failing resource, the control and the framework requirements it maps to, the owner, the severity and REMEDY-002 due date, and the first how-to-remediate step (LIBRARY-002), with a private link to the obligation. Where a WORK-001 ticket was created, it also carries the ticket key and link. An obligation with no owner notifies the control owner, or failing that the escalation contact, and says so.
- **A task in the channel.** In Slack (interactive message) and Teams (Adaptive Card), the owner can Acknowledge, which records the person and time on the obligation, and Reassign, which changes the owner with a recorded reason and notifies the new owner. The message updates in place when the obligation is reassigned, re-tested or verified closed.
- **Never a closure.** Acting on a message never marks work done or closes the obligation; only a verified re-test does (REMEDY-001).
- **Grouping and deduplication.** A test that fails on several items at once sends one notice per owner listing each item with its own due date. Notices are deduplicated per obligation and failure cycle across restarts, quiet hours defer them rather than drop them, and their outcomes follow FOLLOWUP-001 (pending, accepted, failed or uncertain). A regression after verified closure sends a new notice for the new cycle.

The current notice rules follow `docs/rules/failure-notices.md`; the in-channel step is a private link until the in-message actions ship (RL-7).

**Acceptance.** With a Slack sandbox workspace, a Teams channel and a 7-day SLA for high-severity failures:
1. Connect a Slack sandbox workspace and a Teams channel, give one control owner Slack and another Teams as their channel, and set a 7-day SLA for high-severity failures. Fail a mapped connected test on one resource: within one scheduler run the Slack owner receives a message naming the test, resource, control, owner and a due date seven days out, with the obligation link, and the obligation history shows the notice accepted.
2. Click Acknowledge: the obligation records that person and time and stays open.
3. Reassign from the message with a reason: the new owner is recorded and notified.
4. Restart the worker: no duplicate is sent.
5. Fail a test owned by the Teams owner on three resources: one Adaptive Card lists all three items with their due dates. With Jira as the WORK-001 destination, the notice carries the Jira key and link.
6. Fix the source: after the passing re-test the Slack message shows verified. Regress it: a new notice is sent.
7. Fail a test during quiet hours: the notice waits for the business window.
8. Revoke the Slack token: the notice shows failed on the obligation with the reason.

### Risk and third parties

#### RISK-001 — Risk register and treatment lifecycle

*Tier:* Core · *Rules:* D-3

**Requirement.** Risk assessments record scenario, affected assets/processes, likelihood, impact, inherent/residual risk, method (the scoring-method revision of RISK-002), owner, review deadline, mitigation and approved acceptance. Risks come from the shipped library, import, the form or the API (RISK-002). Risks link controls, failing tests, incidents and vendors; treatment plans carry due work and verification. Risk acceptance expires and escalates rather than hiding a failed control.

**Acceptance.** Through Risk Register:
1. Create a risk from a failing control in Risk Register, score it, assign mitigation, approve a time-bounded residual-risk acceptance and export the register.
2. Let approval expire and inspect escalation; a passing re-test updates treatment evidence without rewriting the original assessment.

#### RISK-002 — Shipped risk library, register import and configurable scoring

*Tier:* Core · *Rules:* D-1, D-3

**Requirement.** A register never starts from a blank page. Evidence ships a versioned library of at least 100 risk scenarios covering access, change, vendor and supply chain, data loss and privacy, availability and continuity, people, physical, application security and AI risks. They are written to support the ISO 27001 clause 6.1 risk assessment, the SOC 2 risk assessment criteria and the HIPAA Security Rule risk analysis (PROGRAM-003). Each scenario has a threat and vulnerability description, affected asset types, a suggested likelihood, impact and treatment, and suggested LIBRARY-001 control mappings. Adding a scenario creates a RISK-001 risk linked to its suggested controls and to in-scope assets of matching type, all of which the owner can change. Library revisions are reviewable and never alter risks already added. Risks also enter in three other ways:
- **Spreadsheet import:** CSV/XLSX with column mapping and a dry run that validates each row and detects duplicates and owner matches before anything is admitted. Admitted risks are labeled imported with file and date. Incumbent register exports under MIGRATE-001 use this path.
- **By hand:** through the Risk Register form.
- **API:** through API-001, with a risk-push token scope.

**Scoring is owner-configurable and versioned.** Owners set the likelihood and impact scale size (3×3 to 5×5), level labels and definitions, the scoring formula (product or matrix lookup), risk-level thresholds and terminology. Each assessment records the scoring-method revision it was scored under. Changing the method never rescores history; reassessing a risk under a new method adds a new assessment beside the old one. PROGRAM-003 carries starting the HIPAA risk-analysis document and adding the HIPAA scenarios inside it. The score arithmetic and scaling follow `docs/rules/risks.md`.

**Acceptance.** On a fresh ISO 27001 program and a HIPAA program, through Risk Register:
1. On a fresh ISO 27001 program, add five library risks: each is linked to its suggested controls and matching in-scope assets.
2. Import a 30-row register CSV through Risk Register → Import: the dry run refuses one invalid row with a reason, and 29 risks are admitted labeled imported.
3. Change the scale from 5×5 to 4×4 with new labels: earlier assessments still show their original scale, labels and score.
4. Reassess one risk: both assessments are retained with their method revisions.
5. Create a HIPAA program and add its ePHI/HIPAA scenarios from the library.
6. Export the register with the method revision per assessment.

#### VENDOR-001 — Vendor inventory and security diligence

*Tier:* Core · *Rules:* D-4

**Requirement.** Track suppliers, business owner, data access, criticality, subprocessors, contracts/BAAs/DPAs, security documents, risk tier, assessment questionnaires, findings, approval, renewal and reassessment dates. Outgoing assessments use shipped standard questionnaire templates (SIG Lite and SIG Core, with Shared Assessments licensing where required; CSA CAIQ v4) or owner-built templates, with answers kept per question. Their licensed text loads only by importing the owner's licensed workbook, with a licence confirmation (RL-6). Secure supplier request links collect documents and replies with expiry and provenance. Compare document versions, chase missing diligence and route exceptions to a named approver; vendor marketing assertions remain distinct from verified evidence. The profile, diligence, link, document, answer, finding, approval and reminder rules follow `docs/rules/vendors.md` and `docs/QUESTIONNAIRE-WORKBOOKS.md`.

**Acceptance.** Through Vendors and the supplier request link:
1. Onboard a US SaaS supplier through Vendors, request a SOC 2 report and BAA where applicable.
2. Send the CAIQ v4 template type after importing its licensed workbook, collect the supplier's per-question response and record a finding.
3. Approve with an expiring condition, reach renewal, and inspect overdue reassessment reminders and the unchanged original documents.
4. An expired supplier link cannot read or mutate another vendor.
5. Import a CAIQ v4.0.x and a SIG Lite workbook with a licence confirmation, each refused without one, including under a name without 'SIG'.
6. Admit a SIG Core-sized workbook, and send each.
7. Receive a supplier's completed CAIQ as per-question answers keyed by CAIQ id.

#### VENDOR-003 — Vendor document review with cited findings

*Tier:* Core · *Rules:* D-1, D-3

**Requirement.** Evidence reads each collected vendor SOC 1/SOC 2 report, ISO certificate, penetration-test summary, DPA/BAA and questionnaire response, and proposes structured findings, each with a page citation that a reviewer confirms or corrects. For a SOC report it extracts:
- report type (Type I/II) and the period or as-of date;
- the service auditor;
- the opinion (unqualified, qualified, adverse or disclaimer);
- each tested-control exception;
- subservice organizations, with carve-out or inclusive treatment;
- each complementary user entity control (CUEC);
- a bridge-letter gap when the period ended more than the owner-set window ago (default 3 months) with no bridge letter on file.

Each CUEC becomes an obligation that the owner maps to one of their own controls or explicitly accepts as unaddressed. Exceptions and qualified opinions become vendor findings with risk-tier impact. Extraction is a proposal: findings, CUEC mappings and risk-tier changes take effect only after a named reviewer approves them, and the original document bytes stay unchanged. The readable-PDF and text readers, their bounds and the citation rules follow `docs/rules/vendor-documents.md`.

**Acceptance.** Through Vendors → Documents:
1. Upload a real-format SOC 2 Type II report containing one tested-control exception and two CUECs, issued more than three months after its period ended.
2. The proposed review shows report type, period, auditor, opinion, the exception and both CUECs, and each citation opens the cited page.
3. Map one CUEC to an existing access-review control and leave the other unmapped: the unmapped CUEC stays an open obligation in readiness.
4. The bridge-letter gap appears and clears when a bridge letter is uploaded.
5. Correct one wrong extraction: the correction and the original proposal both remain.
6. A qualified-opinion report raises a finding only after reviewer approval.

#### VENDOR-002 — Vendor discovery and risk-based follow-through

*Tier:* Core · *Rules:* D-8

**Requirement.** Discover candidate SaaS vendors from these named authorized sources:
- **Identity-provider app grants:** Google Workspace OAuth app grants (token audit), Microsoft Entra ID enterprise applications and OAuth consent grants, and Okta app assignments, each with granted scopes and the users who granted or hold them.
- **Spend sources:** QuickBooks Online vendors and bills, Ramp vendors and card transactions, and Brex vendors and expenses, each with amounts and dates.
- **Connected sources:** app-account connectors (APPS-001) and cloud marketplace subscriptions visible through CLOUD-001.

Each candidate shows the source records that surfaced it. Candidates seen in several sources merge only through a reviewable match. Identity, ownership and data access are confirmed before risk-tier assignment or external diligence; confirming a candidate is a standard call and sending diligence an external one, each of which the company's policy decides. Accepted vendors start tier-specific recurring reviews (CADENCE-001). A follow-up to a supplier reaches someone outside the business, so an agent's call that prepares or sends one carries the external class, which the company's policy decides.

**Acceptance.** Through Connections and Vendors:
1. Connect each of the six named grant and spend sources (Google Workspace, Entra ID, Okta, QuickBooks Online, Ramp and Brex): each surfaces at least one candidate citing its source records (granted scopes and users, or spend amounts and dates).
2. An app connected through APPS-001 that is not yet a vendor, and an AWS Marketplace subscription read through CLOUD-001, each surface as candidates too.
3. The same vendor found in QuickBooks Online and Ramp is proposed as one duplicate match, which a human accepts.
4. Review the proposed tier for an unknown vendor and approve diligence.
5. Change its access and reach its review date: a new assessment starts, missing replies escalate and rejected candidates receive no external requests.

### Policies, employees and access

#### POLICY-001 — Policy library, approval and version control

*Tier:* Core · *Rules:* D-3

**Requirement.** Evidence ships a template for every policy that the mapped requirements of SOC 2, ISO 27001:2022, HIPAA and PCI DSS call for. At minimum that is: information security, acceptable use, access control, asset management, data classification and management, data retention and disposal, encryption/cryptography, risk management, secure development, change management, vulnerability and patch management, logging and monitoring, incident response, business continuity and disaster recovery, vendor/third-party management, human resources security, physical and environmental security, privacy, and the HIPAA-specific sanctions, breach notification and workforce security policies. A guided policy builder for SOC 2 and ISO 27001:2022 tailors templates from program scope and connected facts. Each library requirement that calls for a policy links the template, and an approved, published policy revision automatically satisfies its linked policy test, which fails again when the policy passes its review deadline. Tailor them to actual operations; named reviewers approve exact revisions before publication. Maintain effective dates, change history, recurring review, control mappings and exceptions, with employee assignment tied to a specific approved version. Templates require applicability review and do not constitute legal advice.

**Acceptance.** Through Policies and readiness:
1. From Policies tailor a template to connected business facts, review an exact revision, reject a changed draft, then publish and map it to two frameworks.
2. Reach its review deadline and publish a replacement: original approval and attestations remain, with new required acknowledgments visible.
3. On a fresh SOC 2 program and a fresh ISO 27001 program, readiness first lists every requirement lacking an approved, published policy.
4. After the shipped templates are approved and published, it lists none.
5. A build-time check fails if any library requirement calling for a policy has no shipped template.
6. Let one policy pass its review deadline: its linked policy test fails.

#### ATTEST-001 — Employee policy attestations

*Tier:* Core

**Requirement.** Employees and contractors receive role-appropriate approved policies, attest to exact versions and see their outstanding actions. Managers/compliance owners track acknowledgments, exceptions, deadlines and reminders; bulk publication cannot invent employee assent. Departed workers retain historical evidence without active access.

**Acceptance.** Through the employee task page and the audit export:
1. Assign a policy revision to an employee and contractor, sign in as each and acknowledge one while leaving the other overdue.
2. Publish a material revision and inspect reassignment/reminders.
3. Terminate one person and confirm denied access with retained time/version/identity evidence in the audit export.

#### TRAIN-001 — Shipped security training and KnowBe4 evidence

*Tier:* Core · *Rules:* D-1 · *Register:* R-7

**Requirement.** Evidence ships versioned training courses with graded assessments on every installation: general security awareness (phishing, passwords and MFA, device security, data handling, incident reporting), HIPAA privacy and security workforce training, and secure coding (OWASP Top 10, secure SDLC, threat modeling). HIPAA training unlocks with a HIPAA program and secure coding with a SOC 2 or ISO program for engineering roles. Courses are accessible (captions and transcripts) and updated through reviewable revisions. Assign training during onboarding and on configurable recurring schedules, track course version, completion and assessment result and overdue obligations, and admit owner-supplied KnowBe4 completion records with their source attribution. Support approved internally delivered training with clearly manual provenance. Role-based campaigns, due dates and schedule customization drive reminders and escalation; a course assignment is not completion. A live KnowBe4 account is field proof (R-7).

**Acceptance.** Through Training:
1. Create an onboarding and annual campaign in Training, enroll a new hire, have them complete the shipped general security-awareness course including its assessment, and fail and retake the assessment once (both attempts retained).
2. Confirm that HIPAA and secure-coding courses appear only after their programs and roles apply.
3. Complete an approved internal course and ingest a real KnowBe4 sandbox completion.
4. Leave another learner overdue, amend the schedule, and verify reminders, original result provenance and an auditor export without fabricated completions.

#### LIFECYCLE-001 — Joiner, mover and leaver compliance

*Tier:* Core · *Rules:* D-1, D-7, D-8

**Requirement.** HRIS and identity events create employee/contractor checklists for policy acknowledgment, training, background-check evidence where lawful (collected from Certn or Checkr integrations as completion status and date only, never report contents, or uploaded with manual provenance), device posture, access grant/review and termination revocation. The checklists also consume the reviewed manual population rows and joiner/leaver differences from POPULATION-001, retaining their manual provenance and requiring attached exhibits or re-uploaded lists for manual check-offs. Each item has owner, due time and source-readback proof; an offboarding task is incomplete until required accounts and devices have been checked: IdP accounts by identity readback, every connected app account (APPS-001) by app readback, and every unconnected app by a manual check-off with attached evidence. HR or IT executes in its own system; Evidence coordinates and verifies compliance. Account checks run on the day itself: on a person's start date their checklist is open and their IdP and connected app accounts are read and checked (MFA enrolled, expected groups only), and on their termination date (or the day a termination is recorded, if later) their IdP accounts, connected app accounts and devices are read back, with further readbacks after each change until every item closes. Identity-source and CSV-roster leavers record their departure through the People departure door, so LIFECYCLE-002 flags, requests and escalates the handover of everything the person holds.

**Acceptance.** Through People and the checklists:
1. Change a joiner, mover and leaver in an authorized HRIS; follow their checklists in People, ingest the joiner's background-check completion from a Certn sandbox and a Checkr sandbox (status and date only), assign tasks, and attempt to close leaver work with an active Okta account. It remains open and escalates.
2. Disable the real account, re-read identity/device sources and verify closure with historical worker evidence preserved.
3. On the test-harness clock, give the joiner a start date and the leaver a termination date: the joiner's account checks and the leaver's account readbacks each run on that same UTC day in the business timezone, with their run times shown on the checklist.

#### LIFECYCLE-002 — Ownership handover when a person leaves

*Tier:* Core

**Requirement.** When a departure is recorded (from a connected HRIS, an identity source, a CSV roster or by hand), every compliance responsibility the person held is flagged for handover the same day: controls they own or contribute to (PROGRAM-002), policies they own or approve (POLICY-001), risks and treatment plans (RISK-001), vendors (VENDOR-001), open remediation obligations (REMEDY-001), access-review decisions (ACCESS-001), questionnaire assignments (ANSWER-003) and auditor requests (AUDIT-001). Each flagged item shows the departed owner and the date, and readiness counts it as unowned until it is reassigned. Reassignment names the new owner and a reason, keeps the earlier owner in the item's history, and notifies the new owner (FOLLOWUP-001). The leaver's manager, or failing that the compliance owner, is asked to hand over within an owner-set window (default 5 business days) and is escalated after it. A bulk handover can move all of a person's items to one successor, item by item in the record. Past observations, approvals and decisions keep the departed person as their actor; nothing is reattributed. The departure doors, holder kinds, window arithmetic and refusals follow `docs/rules/handover.md`.

**Acceptance.** Through People → Record departure and the flagged items:
1. Make one person the owner of two controls (one of them CC6.2's access-provisioning control), a policy, a risk and an open remediation obligation, then record their departure.
2. On the same day each item shows "owner left" with the departure date, readiness counts the controls as unowned, and the compliance owner is asked to hand them over.
3. Reassign CC6.2's control to Priya Shah with a reason: Priya is notified and the control shows her as owner, with the departed owner and the reason kept in its history.
4. Bulk hand over the rest to one successor.
5. Let one item pass the handover window: it escalates.
6. The departed person's earlier approvals and decisions still name them.

#### ACCESS-001 — Quarterly access-review campaigns

*Tier:* Core · *Rules:* D-1, D-3

**Requirement.** Schedule quarterly, semi-annual, annual (CADENCE-001) and owner-configured access reviews using a frozen source population of users, service identities, privileges and resources, drawn from identity connectors and from app-level account connectors (APPS-001) with in-app roles and MFA. Apps that are not connected or not behind SSO join a review through an uploaded account list (POPULATION-001), reconciled to people in Inventory and labeled manual provenance. Revocation in such an app is evidenced by a re-uploaded list or an attached exhibit, never by the reviewer's decision alone. Resource owners decide retain/revoke/change with reasons; self-review restrictions and delegated approvals are explicit. Track overdue decisions, reminders, exclusions and actual revocation readback; late discovered accounts become visible supplemental work. Owner-configured cadence, revocation evidence and People reconciliation follow `docs/rules/access-reviews.md`.

**Acceptance.** Through Access Reviews:
1. Start a quarterly review from Access Reviews, have two resource owners decide on employee, guest and privileged service access, and leave one decision overdue.
2. Request revocation, keep the source account active and inspect unresolved work.
3. Revoke in the source and re-test; export complete decisions, population and period evidence.
4. Add an unconnected SaaS app by uploading its account list: decide revoke on a departed person's account, re-upload the list without that account, and confirm the revocation is evidenced by the new upload with both lists retained.

### Audit collaboration

#### AUDIT-001 — Period-specific auditor workspace and request lists

*Tier:* Core · *Rules:* D-4, D-6, D-7

**Requirement.** Auditors sign into an engagement-scoped workspace or explicitly authorized API, with independent engagements, audit periods and requested-control populations. Import or create information request lists, assign internal request owners, set due dates, discuss findings, submit exact evidence versions, and record auditor accepted/rejected/needs-more states. Track requests through resubmission and close-out without treating an upload as auditor approval. Period packs retain scope, source provenance, exceptions and request decisions. Shared continuous tests, policies and documents are reviewed directly, with no request, in the auditor evidence view (AUDIT-003). The owner explicitly authorizes engagement-scoped native auditor identities (RL-9); auditors are refused at non-audit product doors and at the exact engagement-grant expiry. The native API rules follow `docs/AUDITOR-API.md` and `docs/rules/auditor-api.md`.

**Acceptance.** Through the auditor workspace and API:
1. Invite an auditor to one engagement, import a request list, assign a request, comment and submit a period-specific exhibit.
2. As auditor reject it, request more evidence and accept the next submission.
3. Export the pack; another engagement and revoked auditor remain inaccessible, and the original submission and decisions remain available to authorized owners.
4. Link a second request to a continuously tested control: as auditor, the request opens the in-period test observations with their source connector and account and their observed times, and the receipts of its exhibits with their source, server receipt time and SHA-256.
5. An observation or receipt outside the engagement's period is not shown.

#### AUDIT-002 — Type II populations, sampling and non-occurrence

*Tier:* Core · *Rules:* D-1, D-2, D-8

**Requirement.** For a Type II or surveillance engagement, the auditor workspace generates period populations from source data for the selected period, reconciled to their sources: new hires, terminations, role changes, production changes, access-review completions, security incidents and security issues (both from ISSUES-001 and ISSUES-002), vulnerability remediations, vendor reviews and backup or restore tests. Each population records source, query, retrieval time, completeness, record count and any gaps or manual rows. The auditor records sample selections, either picked or seeded random with the seed retained. Each sample opens its own evidence request (AUDIT-001) linked to the exact population record. A control whose triggering event never occurred in the period is recorded as a non-occurrence, supported by evidence of the empty population (for example, zero incidents with source completeness). The incidents population is complete only when every configured ISSUES-002 incident source was read completely for the whole period. A non-occurrence is never shown or exported as a passing operating test. A population whose source read was incomplete cannot be marked complete. Its vulnerability-remediation population includes the VULN-002 penetration-test findings with their manual provenance, fixed due dates and retest decisions.

**Acceptance.** As auditor on a Type II engagement:
1. Generate the terminations population for the period and reconcile its count and identities with the connected HRIS.
2. Select five samples with a recorded seed: five per-sample requests open with owners.
3. Satisfy four, and leave one rejected and resubmitted.
4. With ISSUES-002 incident selectors on a Jira Cloud sandbox that holds no matching issues in the period, generate the incidents population: zero records with complete source reads, recorded as a non-occurrence.
5. Readiness and the exported pack show it as a non-occurrence, never a pass, and a request to mark it passing is refused.
6. Revoke HRIS read scope mid-period and regenerate: the population shows incomplete and cannot be closed.
7. Export the population CSV with its retrieval metadata and sample decisions.

#### AUDIT-003 — Auditor review of continuous test evidence for the period

*Tier:* Core · *Rules:* D-3, D-4, D-6

**Requirement.** Continuously tested controls need no request: the auditor reviews them directly inside the engagement.
- **Sharing.** The owner shares chosen controls, tests, policies and documents into an AUDIT-001 engagement. Unsharing removes the auditor's access from then on and is recorded.
- **What the auditor sees.** For each shared test: its criteria and every library revision in force during the audit period; the in-scope resource population across the period, with assets added or removed and their dates; every observation inside the period with its result, and every stale or unknown interval (TEST-001); per-item REMEDY-002 SLA status (within SLA, SLA missed or resolved), approved exceptions with approver and expiry, and linked remediation; and a Test evidence panel stating what validates the test: criteria, source connector and account, population and exhibits. Nothing outside the audit period or the shared scope is shown in the page or returned by the API.
- **Pre-period failures.** An item that failed before the period and was still failing at its start appears from the start of the period. An item that failed and was verified fixed before the period began is not an in-period observation, but it is listed separately, labeled "remediated before period" with its dates, so the auditor sees it.
- **Detail level.** Full shows every population attribute. Restricted hides the attributes the owner selects (for example personal emails, IP addresses or resource tags) and replaces hidden identifiers with stable pseudonyms that stay consistent across tests within the engagement. The level is fixed when the engagement is created, shown to the auditor and recorded in the pack; another level needs a new engagement.
- **Auditor decisions.** For each shared test and document, the auditor records accepted, flagged (with a required comment) or not applicable (with a reason). Owners can reply. Decisions are attributable and versioned, are kept separate from AUDIT-001 request decisions, and never change a test result, observation, mapping or readiness pass. Flags appear to the owner in readiness with their comments.
- **Preview.** The owner can preview the engagement as the auditor: the same server-side projection, read-only, with the preview recorded.
- **Pack.** The exported period pack contains the shared scope, the detail level, each shared test's in-period observations and SLA status at that detail level, and every auditor decision. Auditor views are recorded in the product action audit (LOG-001).

**Acceptance.** On a Type II engagement with a Restricted detail level:
1. Create a Type II engagement with a Restricted detail level that hides user emails, and share three automated tests and one policy. In the period, one test has a mid-period failure, one has a stale interval, and one has an item remediated before the period began.
2. As auditor, open each test: only in-period observations and in-scope resources appear, including the mid-period failure and the stale interval, with SLA status per item and emails replaced by pseudonyms.
3. The pre-period item appears only in its "remediated before period" list.
4. Flag one test with a comment and accept the others: the flagged test's result and readiness are unchanged, and the decisions appear in the exported pack with the detail level.
5. The owner's preview matches the auditor's view field for field.
6. Requests for an unshared test and for an out-of-period observation are refused at the HTTP door.
7. Unshare the policy: the auditor can no longer open it, and the unsharing is recorded.

### Customer assurance

#### TRUST-001 — Published and permissioned trust center

*Tier:* Core · *Cites:* BASE-ACCESS-003, BASE-PUBLIC-001 · *Rules:* D-6, D-8

**Requirement.** A branded customer trust center publishes owner-approved security posture, frameworks, subprocessors and dated assurance statements with a custom domain. Updates, subscribers and subprocessor-change notices are TRUST-003. Restricted documents support access requests, reviewed recipients, NDA execution through a recorded in-product click-through NDA or through DocuSign or Dropbox Sign, CRM-driven auto-approval and live control status (TRUST-002), cited visitor Q&A (TRUST-004), expiry, download audit and revocation. Public, approved-customer and auditor scopes remain distinct; publishing never exposes raw connector or personnel data. A revoked grant cannot recall a previously downloaded copy.

**Acceptance.** Through the trust center and its owner pages:
1. Publish an approved statement, request a restricted SOC 2 report as a prospect, complete an NDA through each named e-signature integration, approve one recipient and deny another.
2. Check expiry/revocation, downloads and custom-domain access from a signed-out browser.
3. An unapproved draft and another prospect’s documents never appear.

#### TRUST-002 — CRM-driven access, click-through NDA and live control status

*Tier:* Core · *Rules:* D-2, D-8

**Requirement.** The trust center gains three access and status capabilities:
- **CRM auto-approval.** Salesforce and HubSpot integrations let owners define auto-approval rules. An access requester whose email or domain matches a contact or account, optionally gated by an account field such as a checkbox or stage, is approved for the mapped document tags. A rule may treat a customer as already under NDA when the owner marks that account's NDA as on file. CRM fields map to document tags. Every auto-approval records the rule, the CRM record and revision it matched, and the time, and rules stop matching when the CRM record changes.
- **Click-through NDA.** An owner-approved NDA version is presented in product. The requester's name, email, company, NDA version, time, IP address and explicit assent are recorded as an immutable acceptance and exported on request.
- **Live control status.** Owners choose control categories to publish as live status (for example access control, encryption, logging, vulnerability management). Each category reflects its linked tests. When any linked test fails or its observation becomes stale beyond the cadence, the category drops to "under review" on the next page render, without exposing resource-level detail. It returns to "monitored" only after a passing re-test. The page shows the time of the last successful check.

**Acceptance.** With Salesforce and HubSpot sandboxes and a published live status:
1. Connect Salesforce and HubSpot sandboxes and create one auto-approval rule in each. A prospect whose domain matches a gated Salesforce account is auto-approved for SOC 2 tags with the matched record shown.
2. A matching HubSpot contact is approved under that rule. A non-matching requester is queued for review.
3. Clear the Salesforce checkbox: the next request is no longer auto-approved.
4. Complete a click-through NDA as a new requester and inspect its acceptance record.
5. Publish live status for an access-control category, then fail its linked MFA test: a signed-out browser sees "under review" with no resource detail.
6. Pass the re-test: the category shows monitored again. A stale collector also drops the category to "under review".

#### TRUST-003 — Trust-center updates, subscribers and subprocessor-change notices

*Tier:* Core · *Cites:* BASE-MAIL-001 · *Register:* R-11

**Requirement.** Customers' DPAs oblige advance notice of subprocessor changes, and the trust center is how that notice is given and proven.
- **Update feed.** Owners publish updates in Compliance, Incidents, Security, Privacy and Subprocessors categories, plus owner-defined ones. Each update is drafted, approved by a named owner, and published with a date and a visibility of public or approved customers (TRUST-001). Incident updates are written by the owner; Evidence does not run incident response (BOUNDARY-001).
- **Subscribers.** Signed-out visitors subscribe by email per category with double opt-in confirmation. Owners add subscribers by email, recorded as owner-added with a reason such as a contractual notice obligation, and approved customers can be subscribed to subprocessor notices automatically. Every message carries a one-click unsubscribe, honored immediately, and the business's postal address (CAN-SPAM). The subscriber list exports with each address's consent source and history.
- **Notifications.** Publishing an update can send an owner-approved notification to that category's subscribers through the FOLLOWUP-001 email provider. Each subscriber's outcome is recorded as pending, delivered, bounced, failed or uncertain. Unsubscribed and unconfirmed addresses never receive a message.
- **Subprocessor-change notices.** Adding, removing or changing a subprocessor in the TRUST-001 list creates a notice draft with name, purpose, data categories, location and effective date. The owner sets the notice period (default 30 days), and the public list shows the pending change and its effective date until the change takes effect. Approving the notice sends it, and the change becomes active only on its effective date. The notice record keeps its approval, send time, effective date and per-subscriber delivery outcome as DPA evidence.

Owner-only, reasoned and expiring named-record read and submit grants, one-time links stored only as hashes and audited uses follow RL-10 and `docs/rules/trust.md`.

**Acceptance.** Through the trust center, its subscriber and notice pages:
1. Subscribe a signed-out visitor to Subprocessors and confirm the double opt-in.
2. The owner adds a second subscriber by email with a reason, and a third subscribes and then unsubscribes.
3. Add a subprocessor with an effective date 30 days out and draft its notice. Publishing without approval is refused.
4. Approve it: the notice is sent, and delivery is recorded per subscriber, including one bounce simulated at the network edge.
5. The unsubscribed address receives nothing.
6. The public list shows the pending subprocessor with its effective date, and after that date it shows as active.
7. Publish one Security update publicly and one only to approved customers: a signed-out browser sees only the public one.
8. Export the notice record with per-subscriber outcomes.

#### TRUST-005 — Customer-facing publication and confirmation notifications

*Tier:* Core · *Cites:* BASE-MAIL-001 · *Rules:* D-4

**Requirement.** Customer-facing sends require enabled owner publication authorization; visitor confirmations also require the enabled confirmation authorization at consent activation. Both start disabled (RL-10). The TRUST-003 notification and consent duties apply through these customer-facing doors. TRUST-003 retains owner-only reasoned, expiring, named-record read and submit grants, one-time links stored only as hashes, and audited uses. TRUST-001 and TRUST-002 keep their inherited duties.

**Acceptance.** Through the customer-facing notification and confirmation doors, against the Resend and SendGrid network edges:
1. Owner publication authorization starts disabled, and a customer-facing send is refused until it is enabled.
2. A notification carries the exact approved category content, the required postal address and one-click withdrawal, and reaches only the public and named-record recipients in scope.
3. Unconfirmed, withdrawn, expired, revoked and out-of-record recipients are excluded.
4. All five delivery outcomes are retained; signed events are admitted, replays deduplicated and forgeries refused, and a restart sends nothing twice.
5. A visitor request requires explicit confirmation; a GET, a duplicate request, a stale or reused link, a withdrawal and disabled owner authorization cannot establish new consent.
6. Consent history survives custody restore, and restored authorization stays inactive.
7. Request, confirmation and withdrawal end states, public and customer feeds and owner notice evidence are shown at 1440 and 390.

#### TRUST-004 — Cited visitor Q&A on the trust center

*Tier:* Core · *Rules:* D-8

**Requirement.** Visitors can ask questions in plain language on the trust page. Answers are drafted only from content published to that visitor's scope, plus approved answer-library entries (ANSWER-001) the owner has marked trust-shareable:
- **Scope.** A signed-out visitor is answered from public content. An approved visitor is also answered from the documents their TRUST-001 grant covers. The assistant never reveals restricted content without the grant, and never returns raw connector, personnel or other customers' data.
- **Citations.** Every answer cites the published statement, document page or library entry it relies on, and states the date of that source. Live status questions reflect TRUST-002 categories.
- **Unanswerable questions.** A question the visitor's scope cannot answer is not answered. The visitor is offered an access request for a restricted document or can route the question to the owner with their email. The owner's approved reply goes to the visitor and can be promoted into the library.
- **Control.** The owner can turn Q&A off and reviews a log of every question, answer and citation. Withdrawing publication or revoking a grant stops answers from that source immediately. Instructions inside a visitor's question never widen scope.

**Acceptance.** As signed-out and approved visitors on the trust page:
1. As a signed-out visitor, ask about encryption at rest: the answer cites the public statement and its date.
2. Ask a question answerable only from the restricted SOC 2 report: no restricted content appears, and an access request is offered.
3. As an approved visitor, ask the same question: the answer cites the report page.
4. Ask a question no source covers: nothing is drafted, and the question is routed to the owner, who approves a reply; the next visitor who asks gets the cited library answer.
5. Withdraw the report: the approved visitor's next answer no longer cites it.
6. Ask the assistant to ignore its rules and list other customers or unpublished documents: it refuses.
7. The owner's log shows every exchange.

#### ANSWER-002 — Portal and web-form questionnaire capture and fill-back

*Tier:* Core · *Rules:* D-4, D-8

**Requirement.** A browser extension for Chrome, Microsoft Edge and Brave, signed in to the owner's installation with a scoped token, scans a customer procurement portal or web-form questionnaire across all its pages and sections. It imports each question with its page, field identifier, answer type (text, choice, multi-select, yes/no, file upload) and allowed options into a questionnaire record. Drafting, citation and approval then follow ANSWER-001. Fill-back writes only the exact approved answer revision into the matching field, attaches only approved documents, and never submits the portal form on the user's behalf. Before filling, the extension re-scans the page. A field that was added, removed, re-typed or whose options changed since capture is not filled; it is listed for re-capture and review. An unapproved, stale (AGENT-005) or edited answer is refused. Installation and current bounds are in `docs/PORTAL-QUESTIONNAIRES.md`.

**Acceptance.** On a test portal of at least three pages with text, single-choice, multi-select and file fields:
1. Capture the questionnaire with the extension in Chrome, Edge and Brave. All fields import with page and type.
2. Draft and approve answers in Questionnaires, leaving one answer unapproved.
3. Change one choice field's options on the portal, then run fill-back: every approved, unchanged field fills with the exact approved text, the changed field and the unapproved answer are refused with reasons, and the form is not submitted.
4. Re-capture the changed field, approve its answer and complete the fill.
5. The questionnaire history shows capture time, page structure and every fill.

#### ANSWER-003 — Questionnaire collaboration, PDF capture and answer-library import

*Tier:* Core · *Rules:* D-1, D-6, D-7, D-8 · *Register:* R-10

**Requirement.** Large questionnaires are answered by several people, arrive as PDFs, and build on hundreds of answers a buyer already has. Three capabilities cover this:
- **Per-question collaboration.** Each questionnaire has a primary owner. The owner assigns individual questions or whole sections to teammates (control owners and contributors under AUTH-001) with due dates. Assignees are notified in Evidence, by email, and in Slack or Microsoft Teams (FOLLOWUP-001). They can answer in Evidence or directly from the Slack or Teams message. An answer from any channel arrives as a draft that must carry ANSWER-001 citations or be flagged, and it still needs the named reviewer's approval. Progress is shown per assignee, and overdue assignments escalate.
- **PDF questionnaire capture.** Upload a text PDF, or a scanned PDF read by OCR. Evidence extracts each question with its section, numbering, order and page reference. The owner reviews the extracted list, merging or splitting questions, before drafting. The original PDF is kept as an exhibit. Answers export as a DOCX, XLSX or PDF answer document in the original question order with question numbers.
- **Answer-library import.** Bulk-import past completed questionnaires (XLSX, CSV, DOCX or PDF) or a question-and-answer CSV, with column mapping, a dry run and duplicate detection, plus reference documents kept as exhibits. Imported entries are labeled imported with source file and date, and are searchable in the library. ANSWER-001 cannot reuse an imported answer as cited until it is re-cited to current sources or re-approved by a named reviewer.

**Acceptance.** Through Questionnaires, Slack and the answer library:
1. Split a full-length SIG Lite across three assignees with due dates.
2. One answers a question from a Slack message: the answer arrives as an uncited draft that is flagged until a citation is added, and it awaits reviewer approval.
3. Let one assignment pass its due date: it escalates.
4. Upload a 40-question PDF customer questionnaire: questions extract in order with section and page; merge one wrongly split question; draft and approve; export an answer document whose question order and numbering match the PDF.
5. Import a prior completed XLSX questionnaire: its answers appear in the library labeled imported and unverified, a draft cannot cite one until it is re-cited or re-approved, and after re-approval it can be reused.

### Portability and migration

#### MIGRATE-001 — Switch from Vanta, Drata and Secureframe

*Tier:* Core · *Rules:* D-1, D-4 · *Register:* R-6

**Requirement.** Guided migration separately supports Vanta, Drata and Secureframe exports and authorized APIs for available framework scope, mappings, controls, test history, policies/attestations, people, vendors/risks, audit requests, trust/questionnaire content and original exhibits. Preview counts, field mappings, unsupported records and absent export fields; resolve identity/owner conflicts before admission. Preserve original IDs, timestamps, source and audit periods as imported provenance, never fabricated live observations. Reconcile totals and bytes, undo admitted links without deleting source custody, and explicitly reauthorize connectors and external access. MIGRATE-001 carries OPEN-001’s incumbent-switching obligation: open-source availability alone does not prove a completed switch. A switch inside an open audit period follows MIGRATE-002. The export formats, record classes, refusal and unsupported rules follow `docs/MOVE-IN.md` and `docs/rules/migration.md`; a real tenant's export is field proof (R-6).

**Acceptance.** For each incumbent, through Move-in:
1. Use a representative export in the incumbent's published format through Move-in, preview it, resolve a duplicate identity, admit, export and undo.
2. Reconcile each record class separately, showing source count, admitted, unsupported and refused for each: frameworks, controls and mappings; test history; policies with approval history and attestations; people; vendors; risks; access-review decisions; audit requests; trust-center and answer-library content; original exhibits, by bytes and digest.
3. Reconnect one actual source and verify imported history stays distinct from fresh observations.
4. If an incumbent does not export a record type, the UI names it and offers an authorized API/manual mapping route without silently dropping it.

#### MIGRATE-002 — Switching in the middle of an audit period

*Tier:* Core · *Rules:* D-1, D-2, D-8

**Requirement.** A Type II window runs all year, so any switch falls inside a period, and the auditor needs evidence for the whole window. The owner records a cutover time per program. For an audit period that spans it, period reports, AUDIT-002 populations, samples, test history and auditor packs combine two kinds of record:
- **before cutover:** imported incumbent test history, exhibits and population records, labeled imported with the incumbent's name, original IDs and export date;
- **after cutover:** fresh source-observed and manual records.

The cutover boundary is shown explicitly in each report, in population exports (a provenance column and boundary metadata), on samples and in packs. Imported pre-cutover records can be sampled, and a request for one can be satisfied with imported evidence, with the auditor judging sufficiency; they never become source-observed. A pre-cutover interval the incumbent export does not cover shows as incomplete with its reason. It can be filled by a labeled POPULATION-001 upload, or by a back-fill read from a source that retains history (for example HRIS termination dates or repository merges), labeled source-observed with its retrieval time. The same person or event appearing on both sides of the boundary is reconciled once through a reviewable match. A gap or overlap between the last imported and first fresh observation of a test is shown, never filled. After cutover, GAP-001's rule that imported material cannot establish current proof applies unchanged. MIGRATE-001's imported test history and audit periods are the pre-cutover records.

**Acceptance.** Migrating from a Vanta export dated four months into a Type II period:
1. Migrate from a Vanta export dated four months into a Type II period and set the cutover.
2. Generate the terminations population across the whole period: pre-cutover rows show as imported, post-cutover rows as source-observed from the connected HRIS, the boundary is marked, and the count reconciles with no person missing or duplicated at the boundary.
3. Sample one row from each side and satisfy both requests, the pre-cutover one with imported evidence.
4. Remove one month of pre-cutover rows from the export and regenerate: that interval shows incomplete with its reason until back-filled from the HRIS.
5. Export the pack: every record carries its provenance and the boundary is visible.

#### PORTABLE-001 — Full-program transfer and Base replacement obligations

*Tier:* Core · *Cites:* BASE-DATA-001, BASE-BACKUP-001 · *Rules:* D-4, D-8

**Requirement.** The versioned complete-product archive extends CUSTODY-001 to every target program record: mappings/revisions, inventory, observations, policies/attestations/training, risks/vendors, remediation and delivery history, access/auditor decisions, trust/questionnaire approvals and the permanent anonymized action audit. Account for every table and blob explicitly, preserve unavailable entries and later erasure fences, and refuse unknown namespaces rather than truncate. Receiving identity, sessions, provider secrets and execution grants stay local; source schedules, writes, messages and external shares remain inactive until reauthorization. The domain archive is the recorded Evidence replacement for Base’s generic product transfer, not an assertion of full Base equivalence. Local export/restore and documented disaster recovery must work without the original hosted service. A source-lineage erasure journal records the known later erasure boundary: an older archive is refused when the destination or a supplied later journal knows an erasure, and a fresh destination lacking later evidence asks for the latest journal and labels recovery “erasure history unverified”. Restored schedules, mail, collections, writes and shares remain behind a persistent recovery barrier until the owner authorizes the intended capability; a connector also requires fresh credentials, and authorizing one connector grants no authority to other connectors. The archive format, streaming bounds and journal rules follow `docs/BACKUP-RESTORE.md` and `docs/rules/portable-archive.md`.

**Acceptance.** Through the console and the local archive command:
1. Use the console and local archive command to export a populated program containing every current record class, over 20,000 native resource rows and over 64 MiB of original file bytes; restore offline into an empty installation with a different owner.
2. Resume a multipart upload across a Worker restart; a final-digest failure admits no business records or originals.
3. Reconcile table/blob inventory, original history, unavailable bytes and erasure fences.
4. Verify no message, source mutation or external grant replays, then explicitly reauthorize one connector.
5. Reject an unknown table and a pre-erasure archive without the required later journal.

### Access, integrity and operation

#### AUTH-001 — Roles, SSO and scoped authorization

*Tier:* Core · *Cites:* BASE-ACCESS-001, BASE-ACCESS-002, BASE-ACCESS-004, BASE-ROLE-001, BASE-SIGNIN-001 · *Rules:* D-4, D-7 · *Register:* R-8, R-9

**Requirement.** Add administrator, compliance manager, control owner, contributor, employee, risk approver and auditor roles with engagement/team/record scope and separation of duties. Delegation is deny by default: a door that no role names stays owner-only, assignment-scoped controls bound control owners and contributors, the person who prepares a policy decision, residual-risk acceptance or tailoring decision cannot decide it, only the owner grants administrator, restricted record areas, provisioning tokens and invitations, and grants never travel in an archive (RL-102). Future scoped human roles are added only explicitly. Beyond BASE-SIGNIN-001, single sign-on works with Google Workspace, Microsoft Entra ID and Okta with SCIM provisioning/deprovisioning, enforces a required second factor on provider sign-in, and keeps audited break-glass owner access through the native sign-in. API tokens and service identities have explicit scopes and expiry; a collector credential or a prepare-only grant cannot approve, publish or change roles. WORK-003 tracker writes need mapped tracker identities/states and read-before-write conflict handling, and stay owner-only until a scoped human role names them. The role matrix follows `docs/ACCESS.md`; live Google Workspace and Entra ID tenants and a live Okta SCIM push are field proof (R-8, R-9).

**Acceptance.** Through native sign-in, each named SSO provider, SCIM and the role doors:
1. Sign in through native authentication and each named SSO provider; provision and deprovision a contributor via SCIM.
2. Attempt foreign-team reads, employee exports, self-approval and cross-origin writes; refuse them at HTTP doors.
3. Revoke a session/token and confirm all next requests fail while authorized control owners can submit only their scoped evidence.

#### SECURE-001 — Restricted evidence and declared external flows

*Tier:* Core · *Cites:* BASE-INPUT-002, BASE-INPUT-003, BASE-DATA-004 · *Rules:* D-4 · *Register:* R-12

**Requirement.** Sensitive documents, personnel records, findings and connector data stay private by default, with record-level need-to-know grants, explicit redaction/publication and verified attachment downloads. Encrypt provider credentials and sensitive persisted data under documented key custody; rotate keys with recovery and loss behavior documented. Declare each outbound provider/model, purpose, exact data classes, retention, region and account in Connections before enablement. Owner-selectable model providers use minimum necessary evidence, never grant authority from source text, and do not receive secrets. Audit access and suspected data disclosures. A sensitive record reaches a reviewer folder or auditor engagement only through an explicit, reasoned and revocable publication; an undeclared or secret-bearing model payload is refused before anything leaves and is audited without its content; a missing custody key fails explicitly; and restored authority stays inactive (RL-104). Storage-provider encryption of exhibit bytes is disclosed as such, not relabeled application sealing. Key custody and the declared-flow rules follow `docs/KEY-CUSTODY.md`.

**Acceptance.** Through uploads, the restricted-record doors and Connections:
1. Upload hostile HTML/SVG and a sensitive employee document, verify safe attachment handling, then try unauthorized record reads and publication.
2. Enable one model/connector only after reviewing its data flow, rotate its key and simulate unavailable custody.
3. Inspect logs and exports for secret exclusion and explicit failure; revoked access fails on the next read.

#### ERASE-001 — Explicit erasure, holds and restore fencing

*Tier:* Core · *Cites:* BASE-DATA-003, BASE-DATA-006 · *Rules:* D-4

**Requirement.** Authorized erasure of a person, exhibit, vendor, engagement or entire business removes, beyond BASE-DATA-003's records and attachments, their derivatives, model indexes, provider-side copies under our control and live grants. A reviewed legal hold names, beyond BASE-DATA-006's disclosure, who authorized it and when it is reviewed. Erasure overrides ordinary receipt immutability only through the dedicated audited workflow; ordinary editing still cannot delete proof. Durable receipts count deletions/anonymization by store, retain opaque audit references and fence old archives using the later source journal. External downloads and offline archives already held elsewhere cannot be recalled; buyers receive deletion requests/instructions for those custodians. Erasure needs an exact preview fingerprint and a typed confirmation; a hold names its authorizer, reason and review date, never releases automatically and is released only by an attributed person with a reason; a hold on a person, vendor, engagement or business covers every record classified under it, and entity erasure erases every record not under a hold (RL-8). Mirrored tracker comment text, including held text, belongs to this clause. Older archives are refused against the later lineage journal, as PORTABLE-001 specifies. The authority, classification and hold rules follow `docs/rules/erasure.md`.

**Acceptance.** Through Privacy:
1. In Privacy, preview and confirm each entity and business erasure with linked imports, mirrored tracker comment text (including held text), receipts, blobs and active shares.
2. Verify exact stored bytes/derivatives disappear, all grants fail, held items are disclosed and actor references anonymize.
3. Restore a pre-erasure archive with the later journal: erased content and authority cannot resurrect.
4. Interrupt a provider deletion and inspect pending work rather than a false completion.
5. A hold on an engagement blocks erasure of its exhibit.
6. A person erasure with one held exhibit erases the rest and its receipt discloses the held one.
7. A hold past its review date shows overdue and is still active.
8. A non-owner without the scoped role is refused every privacy door.

#### LOG-001 — Permanent accountable action audit

*Tier:* Core · *Cites:* BASE-OPS-005, BASE-AUDIT-001 · *Rules:* D-8

**Requirement.** An append-only product audit records authentication/authorization changes, control/scope revisions, observations, evidence access and replacement, import/undo, approvals, source mutations, sends, exports and erasures with actor or scoped agent, subject, time, reason, exact revision and durable outcome. No raw credentials or token-bearing URLs enter it. The audit travels in product archives and authorized reports. The reason, revision and per-door recording rules follow `docs/rules/audit-log.md`; actor anonymization on person erasure arrives with ERASE-001.

**Acceptance.** Through the public doors, the owner Audit view and its export:
1. Perform an import/undo, folder read/refusal, approval, source change, failed send and erasure through their public doors.
2. Inspect and export the audit, restart, then restore.
3. Every attempted sensitive action and its outcome remains attributable without secrets; an erased actor is anonymous and an interrupted send remains uncertain until resolved.

#### OPS-001 — Durable operation, health and recovery

*Tier:* Core · *Cites:* BASE-SECRET-002, BASE-OPS-001, BASE-OPS-002, BASE-OPS-004, BASE-BACKUP-001 · *Rules:* D-8

**Requirement.** Scheduled work uses durable claims, bounded execution, crash reconciliation and visible failed/unknown outcomes; restarts never manufacture observations or silently discard obligations. Operators see connector health, storage/queue limits, backup status and last successful collection. Limits refuse work explicitly rather than truncate evidence. Estimated operating costs and optional provider/module charges are itemized in USD before enablement. The scheduler budget, lease, cancellation and history rules follow `docs/rules/operations.md` and `docs/OPERATIONS.md`.

**Acceptance.** Through the documented commands, the health and operations pages and the scheduler:
1. Use documented setup/dev/build commands, omit a required setting, restart during a collection and notification, and interrupt storage.
2. Inspect health and durable outcomes, recover from a complete backup and apply an additive migration without changing historical evidence.
3. Attempt a documented size bound and inspect explicit refusal and the USD cost/configuration explanation.

#### MOBILE-001 — Responsive and accessible complete workflows

*Tier:* Core · *Cites:* BASE-ACCESSIBILITY-001, BASE-PUBLIC-003 · *Register:* R-13, R-14

**Requirement.** At 1440 and 390 pixels, owners, employees and auditors can complete their authorized jobs: readiness and source failures, remediation, evidence upload/download, attestations/training, access reviews, requests, trust access and questionnaire approval. Browser/mobile file and camera upload are supported with the same custody checks; task links reopen the exact authorized record. Mobile sessions and notifications obey the same privacy and revocation rules. A human screen-reader pass and a VPAT are field proof (R-13, R-14).

**Acceptance.** With realistic program data, on desktop and phone browsers:
1. Use desktop and phone browsers to complete each role’s journey, upload a phone file/photo, resolve an error and return from a task notification.
2. Inspect every end state at both widths.
3. Verify no hidden controls, color-only states or cross-role disclosures.

#### PUBLIC-001 — Preserve the approved installation and run surfaces

*Tier:* Core · *Cites:* BASE-ACCESS-003, BASE-DOCS-001

**Requirement.** The separate static run site retains its approved homepage, run installation instructions and repository Markdown guides without requiring JavaScript. The installed root remains Base’s Lobby, with setup-state-aware Finish setup or Sign in. Existing sign-in, setup, proof, folder, archive, move-in and agent surfaces keep the approved styling. This target contract does not itself change those screens or claim unbuilt workflows are present.

**Acceptance.** Through the built run site and the installed Lobby:
1. Build the run site, follow the homepage Run/docs links without JavaScript, and inspect installed Lobby before and after setup.
2. Existing browser journeys inspect the approved owner/reviewer flows at 1440 and 390.

#### OPEN-001 — Free and open source under the MIT license

*Tier:* Core · *Cites:* BASE-DATA-005, BASE-INSTALL-001 · *Rules:* D-8

**Requirement.** Evidence is free and open source under the MIT license: the repository's license and the package metadata declare MIT, and anyone may run, modify and redistribute it. Every capability that exists today is available in the open-source product with no seat, framework or connector cap, paid gate or upgrade prompt from Evidence's authors. Paid third-party services a buyer connects (hosting on the buyer's Cloudflare account, email delivery, model providers, KnowBe4, e-signature and the named SaaS sources) are billed by those providers, and Evidence names that provider cost in USD before the connection is enabled (OPS-001). MIGRATE-001 owns switching from Vanta, Drata and Secureframe; it is not affiliated with them, and it never claims to certify anyone (BOUNDARY-001).

**Acceptance.** From the public source:
1. Verify the repository's `LICENSE` is the MIT license and the package metadata declares MIT.
2. Install from the public source with no account or key from Evidence's authors and reach every product area, with all four core programs and 250 people, without a payment, upgrade or license prompt.
3. Begin enabling a paid provider connection and verify its cost is shown in USD as that provider's before activation.

#### OWN-001 — Run on your own computer or Cloudflare account, with your evidence in your own database

*Tier:* Core · *Cites:* BASE-INSTALL-001, BASE-DATA-004, BASE-DATA-005

**Requirement.** Beyond BASE-INSTALL-001, a local start needs no Evidence account, Cloudflare account or model key, and every control, test result, observation, policy, receipt and exhibit lives in that installation's own D1 database and R2 bucket, which the buyer holds: a local installation keeps them under its checkout across restarts, and a hosted one on the buyer's own Cloudflare account keeps them in the buyer's account. The complete archive (CUSTODY-001, PORTABLE-001) exports and restores without the original installation.

**Acceptance.** On clean machines and a sandbox Cloudflare account:
1. On a clean macOS and a clean Ubuntu machine, run the one-line start: Evidence opens its private link, first-run setup completes, and an uploaded receipt and a test result survive a stop and restart, held in the local D1 and R2 files under the checkout.
2. With every connector off, record every outbound request for an hour of use: none goes to a host run by Evidence's authors.
3. Deploy to a sandbox Cloudflare account: the D1 database and R2 bucket are in that account, and the deployment serves the restored archive of the local installation with every record and byte reconciled.

### Honest product boundaries

#### BOUNDARY-001 — US-first scope and independent specialist services

*Tier:* Core

**Requirement.** Evidence is the owned compliance automation and customer-assurance product, replacing the program work bought from Vanta, Drata and Secureframe and advancing beyond the Comp AI, Sprinto and Delve comparison set. US-first means USD commercial/cost disclosures, US business calendars, employee and 1099-contractor populations, and US-first framework applicability. It prepares SOC 2/ISO/HIPAA/PCI evidence; an independent US CPA issues a SOC 2 attestation, an accredited certification body decides ISO 27001, ISO 27701 and ISO 42001 certification, a PCI QSA or the merchant signs the AOC, a C3PAO assesses CMMC Level 2, a FedRAMP 3PAO and agency sponsor decide authorization, an authorized HITRUST assessor submits HITRUST assessments, and qualified assessors/counsel determine regulated obligations, including which US state privacy laws apply. No template, score, agent or portal guarantees certification or authorizes regulated data. Required BAAs/DPAs, regional controls and licensed framework content are explicit prerequisites to appropriate processing, not reasons to omit the program. Each program shows its data-processing prerequisites (the framework's agreements, licensed framework content, and regional controls for every named region outside the US) labelled as not verified by Evidence, names who decides and signs, discloses USD provider costs for hosting, mail and every connected provider, and exports an assessor handoff pack that asserts no certification. The specialist services Evidence integrates with are listed under Boundaries, and the US-region rule follows `docs/rules/boundary.md`.

**Acceptance.** On a US business with a HIPAA/PCI scope:
1. Onboard a US business, choose a HIPAA/PCI scope, inspect data-processing prerequisites and assessor handoff, review USD module/provider costs, and export an evidence pack for an independent assessor.
2. Follow linked remediation to Vector and source checks to the named specialist providers.
3. No UI/report claims certification, legal sufficiency or operation of an external system without source evidence.

### Agent surface

**Specialist: compliance analyst.** It keeps the company's compliance program current: it reads gaps and failing tests, gathers and files proof, carries failures to owned and re-tested remediation, keeps policies, vendors, access reviews and audits moving, and answers customer security reviews from cited proof, acting for the person who sponsors it.

Inherits BASE-AGENT-001 to BASE-AGENT-013. The company's policy decides every call; this section presets none.

**How Evidence computes each class.**
- *standard*: reads of the desk, readiness, tests, inventory and reports; drafts and proposals (folder proposals, document drafts, policy drafts, questionnaire drafts, tailoring and period investigations); proof uploads, mappings, scope, schedules, obligations, tickets' internal fields and reminders to people inside the business; closing a folder, withdrawing a publication and unsharing. Each stays inside the business and can be undone or superseded in the product; facts are the item count.
- *external*: anything that exposes evidence or reaches someone outside the business: issuing a reviewer folder, submitting evidence or sharing a test into an auditor engagement, publishing to the trust center, sending a notice, a supplier request or a questionnaire answer set, and writing a field in an outside tracker. Facts are the recipient count and the counterparty: *known* for an auditor engagement, vendor, customer or tracker on record, *new* for a reviewer label or recipient never seen before, and *public* for the public trust page.
- *commitment*: a sign-off others rely on: approving and publishing a policy revision, approving a program document, exporting or submitting an approved answer set, accepting a residual risk or a test exception, approving a vendor or a vendor-document review, deciding an access-review item, closing a finding on retest evidence and sending a subprocessor-change notice. Facts are the exact revision, the program or vendor and, for answers and notices, the recipients.
- *access*: granting or revoking roles, record areas, need-to-know grants, auditor engagements, trust document grants, API tokens and agent grants; facts are the people and whether the change widens or narrows.
- *security*: connecting, rotating and revoking source credentials, registering a private collector, granting forwarded events, declaring or enabling a model flow, re-sealing custody keys and changing sign-in settings; facts are the setting and the provider.
- *gated*: a provider's OAuth consent screen in the buyer's own account at GitHub, GitLab, Bitbucket, Azure DevOps, Google, Microsoft, Okta, a tracker or a CRM keeps that step for a person at the provider; facts are the provider and the step.
- *live*: executing a configuration or infrastructure change in the buyer's running systems (AGENT-003) or a production write by a repaired collector (AGENT-004); facts are the account, resources and actions.
- *sensitive*: reading restricted receipts, personnel, findings and connector-data records, and exporting the custody archive; facts are the record count and kind.
- *destructive*: confirming an erasure and releasing a hold that lets one proceed; facts are the item count and stores.

| Tool | Does | Core clauses | Risk class | Today |
| --- | --- | --- | --- | --- |
| `evidence.desk.read` | Read controls, requirements, receipts and period gaps | PROOF-001, GAP-001, CADENCE-001 | standard (+ sensitive) | `agent desk` |
| `evidence.proof.upload` | Upload an exhibit or replacement to a requirement | PROOF-001, CADENCE-001, POPULATION-001 | standard | none |
| `evidence.folders.prepare` | Prepare an evidence-folder proposal and list proposals | AGENT-001, REVIEW-001 | standard | `agent prepare-folder`, `agent proposals` |
| `evidence.folders.issue` | Issue or close a reviewer folder | REVIEW-001, AGENT-001 | external or standard | none |
| `evidence.programs.update` | Create programs, review applicability and editions, map and assign controls | PROGRAM-001, PROGRAM-002, PROGRAM-004 | standard | none |
| `evidence.documents.prepare` | Generate, edit and reconcile program documents | PROGRAM-003, PROGRAM-005, PROGRAM-006 | standard | none |
| `evidence.documents.approve` | Approve a program document revision | PROGRAM-003, PROGRAM-005, PROGRAM-006 | commitment | none |
| `evidence.controls.update` | Create and revise controls and requirements, import custom frameworks and decide mappings | CONTROL-001, CONTROL-002, LIBRARY-001 | standard | none |
| `evidence.library.accept` | Accept a shipped library revision | LIBRARY-004 | standard | none |
| `evidence.readiness.read` | Read readiness, catalogs, trends and board reports | READINESS-001, LIBRARY-001, LIBRARY-002, LIBRARY-003, LIBRARY-005 | standard | none |
| `evidence.connections.manage` | Connect, rotate, revoke and reconnect a source or private collector | CONNECT-001, CLOUD-001, CLOUD-002, CODE-001, IDENTITY-001, APPS-001, MONITOR-001, HRIS-001, DEVICE-001, VULN-001, VENDOR-002, AI-001 | security (+ gated) | none |
| `evidence.collection.run` | Schedule and run collection and grant forwarded events | COLLECTION-001, LIBRARY-003 | standard (+ security) | none |
| `evidence.resources.push` | Push resources and evidence documents | API-001 | standard | API v1 resources |
| `evidence.tests.update` | Define, tune, except and run tests | TEST-001, API-001, LIBRARY-002 | standard (+ commitment) | API v1 tests |
| `evidence.findings.import` | Import pentest findings and decide retest evidence | VULN-002, VULN-001 | standard (+ commitment) | none |
| `evidence.issues.configure` | Configure tracker selectors, task types and severity mappings | ISSUES-001, ISSUES-002, ISSUES-003 | standard | none |
| `evidence.inventory.update` | Group, assign, scope and retire inventory records and upload populations | INVENTORY-001, POPULATION-001 | standard (+ sensitive) | none |
| `evidence.remediation.update` | Assign, comment, attach changes, set SLA policies and request a re-test | REMEDY-001, REMEDY-002 | standard | none |
| `evidence.tickets.sync` | Create and link tracker tickets and set ticket granularity | WORK-001, WORK-002 | external | none |
| `evidence.tickets.write` | Write a mapped tracker assignee or status | WORK-003 | external | none |
| `evidence.followups.configure` | Configure reminders, digests and failure-notice channels | FOLLOWUP-001, FOLLOWUP-002 | standard | none |
| `evidence.risks.update` | Add, import, score, reassess and treat risks | RISK-001, RISK-002 | standard | none |
| `evidence.risks.accept` | Accept a residual risk or approve a test exception | RISK-001, TEST-001 | commitment | none |
| `evidence.vendors.update` | Profile vendors, review documents, record findings and confirm candidates | VENDOR-001, VENDOR-002, VENDOR-003 | standard (+ sensitive) | none |
| `evidence.vendors.request` | Send a supplier request link or questionnaire | VENDOR-001, VENDOR-002 | external | none |
| `evidence.vendors.approve` | Approve a vendor, a condition or a document review | VENDOR-001, VENDOR-003 | commitment | none |
| `evidence.policies.prepare` | Tailor templates and draft policy revisions | POLICY-001 | standard | none |
| `evidence.policies.publish` | Approve and publish an exact policy revision | POLICY-001, ATTEST-001 | commitment | none |
| `evidence.people.update` | Assign policies and training, record departures and hand over responsibilities | ATTEST-001, TRAIN-001, LIFECYCLE-001, LIFECYCLE-002 | standard (+ sensitive) | none |
| `evidence.access_reviews.run` | Start campaigns, decide items and evidence revocations | ACCESS-001 | standard (+ commitment) | none |
| `evidence.audits.manage` | Invite auditors, import request lists, submit evidence and share tests | AUDIT-001, AUDIT-002, AUDIT-003 | external or access | none |
| `evidence.trust.publish` | Publish statements, updates and subprocessor notices and send notifications | TRUST-001, TRUST-002, TRUST-003, TRUST-004, TRUST-005 | external (+ commitment) | none |
| `evidence.trust.grant` | Decide document access requests and named-record grants | TRUST-001, TRUST-002, TRUST-003 | access | none |
| `evidence.questionnaires.prepare` | Upload, capture, assign and draft answers and import the answer library | ANSWER-001, ANSWER-003, AGENT-005 | standard | none |
| `evidence.questionnaires.submit` | Export or submit an approved answer set | ANSWER-001, ANSWER-003, AGENT-005 | external · commitment | none |
| `evidence.archive.export` | Export the custody archive | CUSTODY-001, PORTABLE-001 | sensitive | none |
| `evidence.access.grant` | Grant and revoke roles, areas, record grants and tokens | AUTH-001, SECURE-001 | access | none |
| `evidence.custody.manage` | Declare model flows, re-seal keys and publish restricted records | SECURE-001 | security (+ external) | none |
| `evidence.privacy.erase` | Preview and confirm erasure and place and release holds | ERASE-001 | destructive · sensitive | none |
| `evidence.audit.read` | Read and export the action audit | LOG-001 | standard (+ sensitive) | none |
| `evidence.operations.status` | Read health, jobs, limits, backups and USD costs | OPS-001 | standard | none |
| `evidence.periods.investigate` | Investigate an audit period and record a findings disposition | AGENT-002 | standard | none |
| `evidence.fixes.execute` | Execute a narrow configuration fix and re-test | AGENT-003 | security · live | none |
| `evidence.collectors.repair` | Diagnose a collector and activate a reviewed repair | AGENT-004 | security (+ access) (+ live) | none |
| `evidence.tailoring.prepare` | Prepare tailored policy, risk and obligation changes and decide them | AGENT-006 | standard (+ commitment) | none |
| `evidence.exhibits.check` | Check an exhibit against its requirement and decide a finding | AGENT-007 | standard (+ external) | none |
| `evidence.ai_inventory.update` | Triage AI tools and decide bounded use cases | AI-001 | standard (+ commitment) | none |

**Resources.** `evidence://controls/{control}`, `evidence://requirements/{requirement}/receipts/{receipt}`, `evidence://programs/{program}/documents/{document}/revisions/{revision}`, `evidence://tests/{test}/observations/{observation}`, `evidence://obligations/{obligation}`, `evidence://inventory/{record}`, `evidence://vendors/{vendor}`, `evidence://policies/{policy}/revisions/{revision}`, `evidence://engagements/{engagement}/requests/{request}`, `evidence://questionnaires/{questionnaire}`, `evidence://trust/statements/{statement}`. **Events.** `observation.failed`, `observation.passed`, `obligation.opened`, `obligation.verified`, `receipt.added`, `collection.failed`, `folder.issued`, `request.decided`, `policy.published`, `vendor.request.answered`, `trust.notice.sent`, `person.departed`, `approval.pending`, `approval.decided`, `review.flagged`, `policy.adopted`. **Prompts.** `close_gaps` (GAP-001, PROOF-001), `carry_failure` (REMEDY-001, REMEDY-002, WORK-001), `prove_period` (AGENT-002), `answer_questionnaire` (ANSWER-001, AGENT-005), `diligence_vendor` (VENDOR-001, VENDOR-003), `prepare_audit` (AUDIT-001, AUDIT-003).

**Not tools, and why.** IMPORT-001, MIGRATE-001 and MIGRATE-002 (the import door), DEVICE-002 (the monitor runs on a device), ANSWER-002 (the extension runs in a person's own browser), MOBILE-001 (a person's screens at two widths), PUBLIC-001 (the run site and Lobby are installation facts), OPEN-001 and OWN-001 (licence, cost and where it runs are installation facts) and BOUNDARY-001 (the program prerequisites and specialist handoffs are installation facts).

**Limits.** Capacity limits only: request rate, body, upload and archive sizes, documented on `/docs/agents`. Thresholds on recipients, items destroyed and publications, and provider spend caps, are the company's policy.

**Handoffs.** Listens for Willow `person.departed`, Vector `issue.closed`, Uptime `monitor.changed` and Envelope `worker.terminated`. Emits `observation.failed`, `obligation.opened`, `obligation.verified` and `trust.notice.sent` for the engineering (Vector), operations (Uptime) and sales (Orbit) specialists.

#### SURFACE-001 — The registry equals this table and the Base harness passes

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-001, BASE-AGENT-002, BASE-AGENT-003, BASE-AGENT-004, BASE-AGENT-012, BASE-AGENT-013

**Requirement.** Evidence serves the Base MCP door with the tools, resources, events and prompts in this section, each tool calling the same server action as the owner UI. The existing agent desk and folder-preparation commands move onto that door under their table names.

**Acceptance.**
1. `tools/list` names exactly the tools in the table, each with its declared classes in `_meta`, and their Core clause ids plus the not-a-tool reasons cover every Core clause.
2. The Base conformance harness runs BASE-AGENT-001 to BASE-AGENT-013 on Evidence's seeded program under the all-autonomous and the held policies, and passes.
3. On the shared fixture, each tool and its UI action give the same record state and audit event type.
4. `resources/templates/list` names the resources above, and a receipt read as a contributor returns exactly what that contributor sees in the UI.
5. The existing agent desk, folder-preparation and proposal commands answer through the MCP door under their table names, and their current doors stay aliases.
6. `/docs/agents` lists every tool, class, resource, event type and prompt in this section.

#### SURFACE-002 — External calls carry their recipients and counterparty

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-006

**Requirement.** Every call that exposes evidence or reaches someone outside the business carries the external class, with the recipient count and counterparty the server computes from the engagement, vendor, customer, tracker or reviewer records on file.

**Acceptance.**
1. Issuing a reviewer folder carries external with one recipient; the counterparty is new for a reviewer label never used before and known for one matching an engagement on record.
2. Submitting evidence or sharing a test into an auditor engagement carries external with that engagement's auditors as known recipients.
3. Publishing a trust statement or update carries external with counterparty public; publishing only to approved customers carries known with their count.
4. A supplier request, a questionnaire export and a tracker field write each carry external with a known counterparty for a vendor, customer or tracker on record and new otherwise.
5. Closing a folder, withdrawing a publication and unsharing a test carry standard.
6. A reviewer label, request body or record text claiming the recipient is internal leaves the computed class and counterparty unchanged.

#### SURFACE-003 — Commitments carry their exact revision

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-006, BASE-AGENT-008

**Requirement.** Every sign-off others rely on carries the commitment class with the exact revision it binds, and Evidence's own records of those sign-offs name who prepared and who decided them.

**Acceptance.**
1. Publishing a policy revision, approving a program document, exporting an approved answer set, accepting a residual risk or a test exception, approving a vendor and deciding an access-review item each carry commitment with the exact revision and its program or vendor.
2. Closing a pentest finding on retest evidence and sending a subprocessor-change notice carry commitment, the notice with its recipient count.
3. A commitment an agent completes is shown as the agent acting for its sponsor in the period pack, the questionnaire citation manifest, the trust notice record and the audit export.

#### SURFACE-004 — Access, security, gated and live calls

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-005, BASE-AGENT-006

**Requirement.** Calls that change standing authority, protective settings or the buyer's running systems carry the access, security or live class with facts the server computes, and steps a provider keeps for a person are gated before they run.

**Acceptance.**
1. Granting a role, record area, need-to-know grant, auditor engagement or trust document grant carries access with the people and widens; revoking one narrows.
2. Connecting, rotating or revoking a source credential, registering a private collector, granting forwarded events and declaring or enabling a model flow carry security with the setting and provider.
3. Connecting a source whose provider shows its OAuth consent screen in the buyer's account is gated, naming the provider and the step.
4. Executing a configuration fix carries security · live with the account, resources and actions; a collector repair that broadens a scope adds access that widens.

#### SURFACE-005 — Sensitive reads and destructive erasure

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-003, BASE-AGENT-006

**Requirement.** Reads of restricted records and archive exports carry the sensitive class, and erasure carries destructive, with facts computed from the records and stores touched.

**Acceptance.**
1. Reading a sensitive receipt or a personnel, findings or connector-data record carries sensitive with record count and kind; reading an ordinary receipt is standard.
2. Exporting the custody archive carries sensitive with the record and original-file counts.
3. Confirming an erasure carries destructive · sensitive with the item count and stores; releasing a hold that lets one proceed carries destructive.

#### SURFACE-006 — Evidence events for the compliance analyst

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-010

**Requirement.** Evidence emits the event types in this section for its own records, so an agent can follow a failure from observation to verified closure and a departure to handover without polling.

**Acceptance.**
1. A failing observation emits `observation.failed` and `obligation.opened` with the test, resource and obligation URIs, and a verified re-test emits `obligation.verified`.
2. A recorded departure emits `person.departed`, and each flagged item is reachable from its resource URI.
3. A failed collection emits `collection.failed` naming the connection and the unknown coverage.

#### SURFACE-007 — The compliance analyst's seeded week through MCP

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-007, BASE-AGENT-013

**Requirement.** A stranger agent given only the seed URL runs a seeded compliance week through MCP under two company policies, one of them autonomous for every class.

**Acceptance.**
1. Before setup is answered, the first call returns `policy_unset` with the setup link, and setup lists every class this section uses with no answer pre-selected.
2. Under the all-autonomous policy, the agent reads the week's gaps, uploads proof, carries two failing tests to obligations and tickets, sends one supplier request, drafts and submits one questionnaire answer set and issues one reviewer folder, with no call waiting and none refused.
3. Under the held policy, the same week completes with each external and commitment step waiting for the test person's approval and running once approved.
4. Under the held policy with external blocked, the supplier request, the answer-set submission and the folder issue are refused, and every other step completes.

## Push further

### Agents accountable to the compliance job

#### AGENT-002 — Prove operation across the audit period

*Tier:* Core · *Rules:* D-2, D-3

**Requirement.** An agent correlates cloud configuration changes, identity/security events, deployment history and control revisions across a selected audit period. It flags controls that pass now but failed earlier, missing windows, contradictory sources and unobserved assets, and proposes attributable findings rather than a fabricated pass. Changing control meaning or approving an exception stays its own separate act, whoever prepared it, and the auditor decides evidence sufficiency. Original observations, source times and periods remain inspectable. The correlation, window, contradiction and bound rules follow `docs/rules/period-agent.md`.

**Acceptance.** From a control's audit-period report:
1. From a period report ask the agent to investigate a control that passes its latest snapshot but had a documented mid-period privilege/merge violation and a missing event window.
2. Follow its citations to original sources; both the failure and unknown interval appear.
3. Reject its proposed exception and verify no mapping, pass or auditor decision changes.

#### AGENT-003 — Investigate, fix narrowly and re-test the real system

*Tier:* Core · *Rules:* D-3, D-8

**Requirement.** For a failed control, an agent investigates the linked source evidence, affected assets, configuration and repository history; proposes a minimal configuration/IaC change with rationale, risk, diff and rollback; and executes it through a separate constrained writer, never collection credentials. Executing the change alters the buyer's running systems and protective settings, so the call carries the security and live classes, with the exact versioned change and its bounds (account, resources, actions, expiry and spend) as facts; the company's policy decides it, within the bounds of the writer's grant. It independently reads back and re-tests the real system, closes only verified work, and escalates residual failures or exhausted authority. Reject/revoke prevents the next action. Retain the failed observation, decided change, execution outcome, rollback and fresh proof in one chain.

**Acceptance.** Under the held company policy, against a sandbox control:
1. Fail a real sandbox control, ask the agent to investigate and propose a change, reject one revision and approve the next with one-resource authority.
2. Attempt an out-of-scope write and revoke an in-flight grant: prevent further unauthorized work.
3. Execute the permitted fix, read back from the real provider, independently re-test and verify closure without erasing the original failure.
4. A failed fix stays open with escalation and rollback evidence.

#### AGENT-004 — Maintain collectors without manufacturing evidence

*Tier:* Core · *Rules:* D-2, D-8

**Requirement.** An agent detects expired scopes, schema drift, stale timestamps, dropped assets and missing source coverage; diagnoses the provider/account failure and prepares a reconnect or reviewed read-only connector change. It may implement a missing connector in a sandbox and compare outputs against the authorized actual source. Activating connector code, accounts and scopes carries the security class (accounts where it creates one), broadening a scope carries access that widens, and a production write carries live; the company's policy decides each. No fabricated screenshots, backdating or silent exclusions can repair a gap.

**Acceptance.** Under the held company policy, against a sandbox connector:
1. Break a sandbox connector scope/schema, remove an asset from a page and stale its source timestamp.
2. Ask the agent for a diagnosis and connector patch, review the diff and approve read-only scopes, then compare output with the actual source inventory.
3. Original gaps remain, and no production activation or unsupported pass happens before approval.

#### AGENT-005 — Keep customer promises current

*Tier:* Core · *Rules:* D-4

**Requirement.** An agent tracks dependencies from approved trust statements and questionnaire answers to controls, exhibits, policies, audit periods and customer contract commitments. Changed/failed/stale sources invalidate affected answers for reuse and prepare a cited revision for its security or legal owner; whether that person or an agent's call decides it is the company's policy for its commitment class. Publishing a revised promise or sending it to a customer reaches people outside the business and binds it, so an agent's call that does so carries the external and commitment classes, which the company's policy decides; whoever decides, the decision binds the exact version and recipients. The agent can chase internal review under the follow-up rules, and nothing silently sends a new security promise. Dependencies are exact owner-selected source relationships (`docs/CUSTOMER-PROMISES.md`).

**Acceptance.** Through answers, trust statements and their exports:
1. Approve an answer and trust statement linked to a passing control and contract obligation, then fail the control and change the source policy.
2. Inspect invalidation, affected customer commitments and cited revision.
3. Attempt to reuse/export/send the stale answer; require a fresh authorized decision and retain the prior external version and recipient history.

#### AGENT-006 — Tailor policies, risks and structured obligations

*Tier:* Core · *Rules:* D-3 · *Register:* R-12

**Requirement.** Using authorized architecture/inventory, approved policies, customer contracts and selected regulatory text, an agent proposes tailored policy changes, risk assessments and structured control obligations with source passages, applicability assumptions, deadlines and conflicts. It distinguishes a contract promise from a framework requirement and never presents interpretation as legal advice. A prepared change takes effect only through a decision on its exact revision, and every downstream effect is bound to that revision; assigning work, altering scope and publishing policy carry the commitment class, which the company's policy decides, and model text never grants authority (RL-101). It uses AUTH-001's scoped reviewer authorization and SECURE-001's declared-flow custody, preserves exact-source citations and uncertainty, and inherits CONTROL-002's individual mapping decisions. The preparation, interpretation and decision rules follow `docs/rules/tailoring.md`.

**Acceptance.** Under the held company policy, from selected sources and the asset inventory:
1. Ask the agent to interpret a US customer security addendum and selected framework material alongside the actual asset inventory.
2. Inspect clause citations, proposed controls, policy/risk diffs and one ambiguous obligation.
3. Reject a proposed interpretation and approve another: only the approved exact revision enters the program and downstream work.
4. Approve two proposed mappings and reject one individually: only the two approved exact revisions become framework mappings, and the rejected proposal changes nothing.

#### AGENT-007 — Check uploaded and captured evidence before the auditor sees it

*Tier:* Core · *Rules:* D-1, D-8

**Requirement.** When an exhibit is uploaded to a requirement (PROOF-001), an agent checks it against the requirement text, its control, the period and earlier accepted exhibits. It reports one of likely meets, missing element, outdated or wrong system, with citations to the exhibit's page or region and to the requirement wording. Through the Evidence browser extension (ANSWER-002), a signed-in owner or control owner can capture a screenshot of a named web-app settings page. The capture records the URL, page title, time and capturing person, and is stored as a manually-asserted exhibit labeled browser-captured, never source-observed; the same check then runs on it. A check never changes an exhibit, receipt or origin and never marks a requirement satisfied. Sharing a finding with an auditor reaches someone outside the business and carries the external class; accepting or dismissing a finding is the company's policy for its class. Open findings appear in readiness before an engagement is shared (AUDIT-003).

**Acceptance.** On a quarterly access-review requirement and a held-out exhibit set:
1. Upload three exhibits to a quarterly access-review requirement: one dated before the period, one missing the reviewer sign-off and one complete. The agent reports outdated and missing element for the first two and likely meets for the third, and each citation resolves to the cited page and requirement wording.
2. Dismiss one finding and accept another: the receipt bytes, origin and requirement state are unchanged, and nothing is marked satisfied.
3. Capture a SaaS admin MFA settings page with the extension: the exhibit is manually-asserted and labeled browser-captured with URL and time, and it is checked.
4. Against a held-out set of 20 exhibits with an independent reviewer key, the agent's verdicts match at least 90% of the key, and zero exhibits the key marks deficient are reported as likely meets.

#### AI-001 — AI inventory and governance

*Tier:* Core · *Rules:* D-5, D-8

**Requirement.** Inventory AI tools, model providers, internal AI use cases, data classes, business owners, access, evaluation evidence and approved-use restrictions, discovered from these named authorized sources:
- **OAuth grants to AI apps** in Google Workspace, Microsoft Entra ID and Okta, classified against a shipped, versioned catalog of AI apps, with granted scopes and users;
- **the OpenAI organization Admin API:** members, projects, API keys and service accounts;
- **the Anthropic Admin API:** organization members, workspaces and API keys;
- **AI SDK dependencies** (for example `openai`, `@anthropic-ai/sdk`, `anthropic`, `langchain` and `@google/generative-ai`) found in dependency manifests by CODE-001;
- **AI vendors** among VENDOR-002 spend sources.

Each inventory record cites the source records that surfaced it. Link AI-specific risks, policies and control tests to the same program; flag shadow tools, unowned API keys and changed data access for triage. An AI provider receives evidence or runs an agent job only after its model/vendor approval and a documented evidence-sharing policy (SECURE-001's declared flow); governance observations never imply certified model safety.

**Acceptance.** Through Connections and the AI inventory:
1. Exercise every named source. Grant an unapproved AI app in each of Google Workspace, Entra ID and Okta; add a member and an API key in an OpenAI organization and in an Anthropic organization; add an AI SDK to a connected repository; and record an AI vendor charge in a connected spend source. Each produces an inventory record citing its source.
2. Review one tool's data access and owner, link a risk and acceptable-use policy, and approve only a bounded use case.
3. Change its permissions and revoke one API key at the provider, rerun governance checks, and inspect the reopened review and the key's revoked state on the next read.
4. An unapproved provider cannot receive evidence or execute an agent job.

## Field proof register

| ID | Proof | Clauses | State | Date | Receipt |
| --- | --- | --- | --- | --- | --- |
| R-1 | Live AWS organization, Google Cloud organization and Azure tenant accounts: connect, discover child accounts, fail and fix a setting at the provider and apply the AWS Terraform snippet | CLOUD-001, LIBRARY-002 | not run | | |
| R-2 | Live Google Workspace, Microsoft Entra ID, Okta and JumpCloud directory tenants with admin, employee, guest and service accounts | IDENTITY-001 | not run | | |
| R-3 | The live authorized collection journey on every hosted collector, including GitHub, GitLab, Bitbucket Cloud and Azure DevOps accounts with real merges, deployments and revocations | COLLECTION-001, CODE-001 | not run | | |
| R-4 | Live accounts for each of the thirteen tracker destinations with real tickets, comments, field writes and callbacks | WORK-001, WORK-002, WORK-003 | not run | | |
| R-5 | A live Slack workspace, Microsoft Teams channel and production mail key delivering reminders and failure notices | FOLLOWUP-001, FOLLOWUP-002 | not run | | |
| R-6 | A real customer export or authorized API read from live Vanta, Drata and Secureframe tenants | IMPORT-001, MIGRATE-001 | not run | | |
| R-7 | A real KnowBe4 reporting account completion read through an authorized reporting API key | TRAIN-001 | not run | | |
| R-8 | Live Google Workspace and Microsoft Entra ID sign-in tenants, and a live Okta SCIM push to a public installation | AUTH-001 | not run | | |
| R-9 | Live Okta sandbox: SSO sign-in, SCIM provisioning and deprovisioning, and second-factor refusal | AUTH-001 | passed | 2026-10-26 | `tests/live/receipts/okta-sso.json` |
| R-10 | Licensed full-length SIG Lite and CSA CAIQ v4 content, used under a Shared Assessments and CSA licence for the questionnaire benchmark | ANSWER-001, ANSWER-003 | not run | | |
| R-11 | Live SendGrid delivery of a visitor confirmation and a subprocessor notice, received with SPF, DKIM and DMARC passing | TRUST-003 | passed | 2026-10-25 | `tests/live/trust-sendgrid.mjs` |
| R-12 | A live model provider call for policy tailoring through the declared flow, with sealed key, verbatim citations and refusal without a declaration | AGENT-006, SECURE-001 | passed | 2026-10-26 | `tests/live/receipts/anthropic-tailoring.json` |
| R-13 | A human screen-reader pass with VoiceOver and NVDA over the owner, employee and auditor journeys | MOBILE-001 | not run | | |
| R-14 | A VPAT for the owner, employee, auditor and trust-center surfaces | MOBILE-001 | not run | | |

## Boundaries

- The product stays independently usable and MIT-licensed; shared Base code or sibling integrations do not combine products. One installation serves one business and its scoped teams, employees, customers and auditors.
- Evidence prepares evidence and never certifies, attests or signs: an independent US CPA, an accredited certification body, a PCI QSA or the merchant, a C3PAO, a FedRAMP 3PAO and agency sponsor, a HITRUST assessor and qualified counsel decide (BOUNDARY-001). Evidence never signs an attestation or AOC on anyone's behalf.
- The named MDMs manage endpoints and the named EDRs protect them; the named scanners and code-security tools find vulnerabilities; HRIS, identity systems and the SaaS apps themselves operate staff and accounts; hosting platforms run production; independent testers perform penetration tests, whose findings Evidence imports (VULN-002); approved executor services perform heavy scans. General project work stays in Vector; incident response stays in the buyer’s tracker and incident tooling, whose security issues and incident records Evidence reads as evidence (ISSUES-001); the named observability tools run monitoring and alerting, whose configuration Evidence reads (MONITOR-001); and general file collaboration stays in [Chest](https://github.com/just-every/run-chest). Related independent RunEditRun siblings: [Pegboard](https://github.com/just-every/run-pegboard) (work and project management) and [Porthole](https://github.com/just-every/run-porthole) (observability). Evidence integrates their records and verifies compliance obligations rather than absorbing neighboring products.
- A passing proof-custody test cannot stand in for a passing compliance/control test, and a fingerprint proves unchanged stored bytes, not the truth of an exhibit or the operation of a control.
- Provider tests run against official-schema network-edge fakes; no live provider, model, SSO, migration or regulated-data verification is claimed beyond the passed rows of the Field proof register.
- Closing a reviewer folder or revoking a grant cannot recall a copy already downloaded.

## Homepage claims

Each capability claim on the approved homepage (`src/site/landing/`, rebuilt on the owner-approved page-s1 structure of 17 October 2026, in page order) maps to the clauses that promise it. Names, companies, dates and counts inside the drawings are example data, not claims. "Try the demo" links the hosted demo and is not a capability claim.

| # | Section | Claim | Clauses |
| --- | --- | --- | --- |
| 1 | Hero | "tests your controls around the clock" | TEST-001, LIBRARY-003 |
| 2 | Hero | "collects the proof" | COLLECTION-001, CLOUD-001, IDENTITY-001, CODE-001, PROOF-001 |
| 3 | Hero | "fixes what drifts" | REMEDY-001, REMEDY-002, AGENT-003 |
| 4 | Hero | "hands your auditor everything they ask for" | AUDIT-001, AUDIT-003, REVIEW-001 |
| 5 | Hero | "100% free, open source alternative to Vanta, Drata and Secureframe" | OPEN-001, MIGRATE-001 |
| 6 | Hero | Board: SOC 2 criteria on controls (CC6.1 Logical access, CC7.2 Monitoring) | LIBRARY-001, PROGRAM-001 |
| 7 | Hero | Exhibit A: "MFA enforced for all 42 users · Okta" | IDENTITY-001, TEST-001 |
| 8 | Hero | Exhibit B: "S3 buckets encrypted · AWS · 12 of 12" | CLOUD-001, TEST-001 |
| 9 | Hero | Exhibit C: laptop disk encryption, 1 failing → fixed, re-tested | DEVICE-001, DEVICE-002, REMEDY-001 |
| 10 | Hero | "SOC 2 Type II 94% ready" | READINESS-001 |
| 11 | Hero | Checklist: "Policies · Access reviews · Vendor risk · Trust center" | READINESS-001, POLICY-001, ACCESS-001, VENDOR-001, TRUST-001 |
| 12 | Hero | AWS, GitHub, Google Workspace and Okta connections | CLOUD-001, CODE-001, IDENTITY-001 |
| 13 | Hero | Jamf tile; "Device systems · Endpoints" | DEVICE-001 |
| 14 | Hero | "HR systems · People" | HRIS-001, POPULATION-001 |
| 15 | First SOC 2 | The SOC 2 Type II year: an Apr 1 – Sep 30 observation window "every control tested daily", with readiness before and after | PROGRAM-001, READINESS-001, GAP-001, TEST-001 |
| 16 | First SOC 2 | "rer setup · first scan: 31 gaps" (Evidence runs on your own computer) | OWN-001, READINESS-001 |
| 17 | First SOC 2 | "15,738 daily results kept" (86 controls × 183 days) | TEST-001, PROOF-001 |
| 18 | First SOC 2 | "Fieldwork · Harbor & Lane CPAs"; "Report issued · no exceptions" (the auditor's work, from Evidence's workspace) | AUDIT-001, BOUNDARY-001 |
| 19 | Day one | "Connect your cloud, code, identity, HR and device systems once" | CONNECT-001, CLOUD-001, CODE-001, IDENTITY-001, HRIS-001, DEVICE-001 |
| 20 | Day one | "The first scan tests every SOC 2 control and names what fails" (86 controls · 55 passing · 31 to fix) | TEST-001, LIBRARY-001, READINESS-001 |
| 21 | Day one | Scan rows: AWS "CloudTrail off in 2 regions", Okta "MFA not enforced for 5 users" | CLOUD-001, IDENTITY-001 |
| 22 | Day one | Scan row: GitHub "No branch protection on 3 repos" | CODE-001 |
| 23 | Day one | Scan row: Jamf "4 laptops unencrypted" | DEVICE-001 |
| 24 | Day one | Scan row: Policies "Not yet written" | POLICY-001 |
| 25 | Day one | Scan row: Rippling "3 leavers still active in Okta" | HRIS-001, LIFECYCLE-001 |
| 26 | Day one | "Connected in 11 minutes: AWS, GitHub, Okta, Jamf, Rippling, Google Workspace" | CONNECT-001, CLOUD-001, CODE-001, IDENTITY-001, DEVICE-001, HRIS-001 |
| 27 | Fixing | "Each failing test becomes a task for the person who can fix it, in Slack or Jira" (owner and due date in #security) | WORK-001, FOLLOWUP-001, FOLLOWUP-002, REMEDY-001 |
| 28 | Fixing | "When the fix lands, Evidence runs the test again" ("Re-tested Mar 11 · 14 of 14 protected"; gaps 31 → 0) | REMEDY-001, REMEDY-002 |
| 29 | Policies | "Start from templates, approve each policy once" (v1 approved by the CEO; 18 policies) | POLICY-001 |
| 30 | Policies | "every person signs" (42 of 42 signed; RV reminded, then signed) | ATTEST-001, FOLLOWUP-001 |
| 31 | Policies | "and finishes training" (42 of 42 trained) | TRAIN-001 |
| 32 | Policies | "New hires get the same list on day one" (JL signed and trained day one) | LIFECYCLE-001 |
| 33 | Observation window | "Evidence tests every control around the clock and keeps each day's result with its time and source" | TEST-001, PROOF-001, LIBRARY-003 |
| 34 | Observation window | Day record: Okta CC6.1, AWS A1.2 and CC7.2, every day for 183 days | IDENTITY-001, CLOUD-001, TEST-001 |
| 35 | Observation window | Day record: GitHub CC8.1 change management | CODE-001, TEST-001 |
| 36 | Observation window | Day record: Jamf CC6.7 laptop encryption | DEVICE-001 |
| 37 | Observation window | "1 failure, fixed the same day · every result kept with its source" | TEST-001, PROOF-001, REMEDY-001 |
| 38 | Evidence agent | "The agent traces a failed test to its cause, asks for one narrow fix and tests the real system again" (PR #482 → PR #487) | AGENT-003 |
| 39 | Evidence agent | "The original failure stays on the record" ("Failure E-2291 kept · linked to its fix and re-test") | TEST-001, PROOF-001, AGENT-003 |
| 40 | Interlude | "CC7.2 Monitoring · 183 of 183 days tested"; "SOC 2 Type II · 100% ready" | READINESS-001, GAP-001 |
| 41 | Fieldwork | "Your auditor gets a workspace for your audit period" | AUDIT-001, AUDIT-003 |
| 42 | Fieldwork | "Each request links to tested proof with its source and time" (121 of 121 provided) | AUDIT-001, AUDIT-002 |
| 43 | Fieldwork | Requests from Okta, GitHub (25-PR sample) and the CC7.2 failure record | IDENTITY-001, CODE-001, AUDIT-002, PROOF-001 |
| 44 | Fieldwork | Requests from Rippling (period-end employee list) and Jamf (183 daily results) | HRIS-001, DEVICE-001, POPULATION-001 |
| 45 | Fieldwork | Background checks from Checkr ("6 of 6 cleared") | LIFECYCLE-001 |
| 46 | Fieldwork | Uploaded board minutes and penetration-test report as PDF | PROOF-001, VULN-002 |
| 47 | Trust center | "Publish your report in a trust center" (Larkspur Trust Center) | TRUST-001 |
| 48 | Trust center | "Evidence answers security questionnaires from verified proof, and every answer cites its source"; "Every answer cites its proof." | ANSWER-001 |
| 49 | Trust center | "209 answered from evidence · 3 sent to Dana Lee" | ANSWER-001, ANSWER-003 |
| 50 | ISO 27001 | "SOC 2, ISO 27001 and HIPAA share controls, so one passing test counts everywhere it applies" | PROGRAM-002, LIBRARY-005 |
| 51 | ISO 27001 | "Add framework · ISO 27001:2022 · 71 of 93 controls already tested", A.5.15 ← CC6.1, A.8.24 ← CC6.7, a new control with an owner | PROGRAM-001, PROGRAM-002, READINESS-001 |
| 52 | Moving in | "Coming from Vanta, Drata or Secureframe? Import controls, policies, evidence and vendors" | MIGRATE-001, IMPORT-001 |
| 53 | Moving in | "check every count before you switch" (86 controls, 18 policies, 1,412 evidence files, 37 vendors) | MIGRATE-001, IMPORT-001 |
| 54 | Limits | "Evidence is not an auditor. A licensed CPA firm still tests your controls and signs your report." | BOUNDARY-001 |
| 55 | Closing | "Open source compliance for SOC 2, ISO 27001 and HIPAA"; "Free and open source, MIT licensed" | PROGRAM-001, OPEN-001 |

## Status

Judged from the code and tests at commit `dd2c24078e57bfbccb54bb40c6dedf3a8cf18fc5` (21 October 2026).

| Clauses | Done | Partial | Missing | Total |
| --- | ---: | ---: | ---: | ---: |
| Published | 4 | 4 | 0 | 8 |
| Target and push further | 35 | 26 | 28 | 89 |
| All | 39 | 30 | 28 | 97 |

| Clause | Title | Kind | Status | Evidence | Gap |
| --- | --- | --- | --- | --- | --- |
| `PROOF-001` | Immutable exhibits and attributable receipts | published | done | `src/evidence/upload.ts`; `src/evidence/storage.ts`; `src/evidence/http.ts`; `tests/evidence.mjs` |  |
| `GAP-001` | Honest period-specific proof coverage | published | partial | `src/evidence/model.ts`; `src/evidence/storage.ts`; `tests/evidence.mjs` | Point 1's imported-only proof state is not asserted in the cited evidence: it is asserted only in `tests/import.mjs` (line 62), which this clause does not cite. The daily, weekly, monthly and quarterly periods, the superseded period, unavailable bytes and the historical period are asserted. |
| `COLLECTION-001` | Scheduled source collection with visible failures | published | partial | `tests/helpers/collection-schedule-journey.mjs`; `tests/github.mjs`; `tests/cloud.mjs`; `tests/clouds.mjs`; `tests/identity.mjs`; `tests/training.mjs`; `tests/helpers/collection-journey.mjs`; `tests/helpers/collection-schedule-browser.mjs`; `tests/ops.mjs`; `tests/private-collector.mjs` | Fresh judgement pending: the forwarded-event points (4 to 7) carry RL-2's riders and have not been judged against the collection journeys. Independently verified provider modification and event times remain unknown where a provider does not report them. The live authorized journey is field proof (R-3). |
| `REVIEW-001` | Selected expiring evidence folders | published | done | `src/evidence/review/http.ts`; `src/evidence/review/storage.ts`; `tests/review.mjs`; `tests/review-browser.mjs` |  |
| `ANSWER-001` | Cited security-questionnaire completion | published | partial | `src/evidence/answer/`; `tests/agent.mjs`; `tests/helpers/answer-journey.mjs`; `tests/period-agent-browser.mjs`; `tests/helpers/assurance-browser.mjs` | Delivered: CSV, first-sheet XLSX and table DOCX templates, exact policy/observation excerpts or explicit flags, named exact answer-set/recipient approval, source invalidation, template export, readiness drilldown and archive parity; approved SOC-report passages and recursively current prior approved answers retain exact revisions, source pages/periods and stale-parent/expiry refusal; human-confirmed yes/no choices retain the supporting passage, mapping reason and exact decision, with buyer cells holding only the declared value and a separately approved citation/flag manifest. Remaining: other non-text formats and automatic choice drafting, and the full-length SIG Lite and official CAIQ benchmark with an independently held-out reviewer key and the required 90% answerable-question coverage (licensed content is R-10). No answer-quality benchmark or model inference is claimed. |
| `IMPORT-001` | Reviewed Drata archive admission and undo | published | partial | `src/evidence/import/http.ts`; `src/evidence/import/plan.ts`; `tests/import.mjs`; `docs/DRATA-IMPORT.md` | Point 2's original artifacts after a restart are not asserted: the cited journey checks originals after undo and archive restore, and import history after a restart, but never reads the originals after a restart. |
| `CUSTODY-001` | Complete custody archive and empty-target restore | published | done | `tests/archive.mjs` |  |
| `AGENT-001` | Agent folder proposals and exact decisions | published | done | `src/evidence/agent/http.ts`; `src/evidence/agent/storage.ts`; `tests/agent.mjs`; `docs/AGENT-COMMANDS.md` |  |
| `PROGRAM-001` | Framework programs and applicability | target | partial | `tests/program.mjs` | Point 2's owners surviving the export are not asserted: the program export is checked for its edition history, exclusions, unresolved obligations and the no-certification statement, but not for its accountable lead or owners. |
| `PROGRAM-003` | Framework-required program documents | target | done | `tests/program.mjs`; `tests/helpers/program-documents-journey.mjs`; `tests/program-documents-browser.mjs` |  |
| `PROGRAM-005` | ISO 27001 Statement of Applicability and management-system records | target | done | `tests/program.mjs`; `tests/helpers/program-documents-journey.mjs`; `tests/program-documents-browser.mjs` |  |
| `PROGRAM-006` | PCI DSS scope, SAQ selection and worksheets | target | done | `tests/program.mjs`; `tests/helpers/program-documents-journey.mjs`; `tests/program-documents-browser.mjs` |  |
| `PROGRAM-004` | Extended and regulated programs | target | partial | `src/evidence/library/extended/`; `src/evidence/program/extended.ts`; `src/evidence/program/extended-view.ts`; `src/evidence/program/documents/privacy.ts`; `migrations/core/0058_extended_programs.sql`; `tests/program.mjs`; `tests/helpers/extended-programs-journey.mjs`; `tests/extended-programs-browser.mjs`; `docs/PROGRAMS.md` | HITRUST CSF requirement statements and control references are not built (licensed; readiness is by HITRUST assessment domain). The shipped programs and the USDP citation carry are listed in `docs/rules/extended-programs.md`. |
| `LIBRARY-001` | Shipped control library mapped to every core requirement | target | done | `scripts/library-check.mjs`; `src/evidence/library/`; `src/evidence/program/library.ts`; `src/evidence/tests/engine.ts`; `src/evidence/cloud/`; `src/evidence/identity/`; `src/evidence/policy/`; `tests/program.mjs`; `tests/github.mjs`; `tests/cloud.mjs` |  |
| `LIBRARY-002` | Connector test catalogs and how-to-remediate guidance | target | partial | `scripts/library-check.mjs`; `src/evidence/library/`; `src/evidence/program/library.ts`; `src/evidence/tests/engine.ts`; `src/evidence/cloud/`; `src/evidence/identity/`; `src/evidence/policy/`; `tests/program.mjs`; `tests/github.mjs`; `tests/cloud.mjs` | Point 2 is not asserted for the Vercel deployment-protection test (no Vercel connector exists until CLOUD-002) or for applying the AWS Terraform snippet, which the fixture never applies (a live account is R-1). The build-time remediation checks, the failing AWS S3 test, its How to remediate panel and its Terraform snippet are asserted. |
| `LIBRARY-003` | Test cadence and stale intervals | target | done | `scripts/library-check.mjs`; `src/evidence/library/`; `src/evidence/program/library.ts`; `src/evidence/tests/engine.ts`; `src/evidence/cloud/`; `src/evidence/identity/`; `src/evidence/policy/`; `tests/program.mjs`; `tests/github.mjs`; `tests/cloud.mjs` |  |
| `LIBRARY-004` | Reviewable library revisions | target | done | `scripts/library-check.mjs`; `src/evidence/library/`; `src/evidence/program/library.ts`; `src/evidence/tests/engine.ts`; `src/evidence/cloud/`; `src/evidence/identity/`; `src/evidence/policy/`; `tests/program.mjs`; `tests/github.mjs`; `tests/cloud.mjs` |  |
| `LIBRARY-005` | One observation counts in every framework it maps to | target | done | `scripts/library-check.mjs`; `src/evidence/library/`; `src/evidence/program/library.ts`; `src/evidence/tests/engine.ts`; `src/evidence/cloud/`; `src/evidence/identity/`; `src/evidence/policy/`; `tests/program.mjs`; `tests/github.mjs`; `tests/cloud.mjs` |  |
| `PROGRAM-002` | Reusable mappings and accountable ownership | target | done | `src/evidence/program/control.ts`; `src/evidence/program/storage.ts`; `tests/program.mjs` |  |
| `CONTROL-001` | Custom controls and testing intent | target | done | `tests/evidence.mjs`; `tests/helpers/control-journey.mjs`; `tests/helpers/framework-journey.mjs`; `tests/browser.mjs`; `tests/helpers/control-browser.mjs`; `tests/helpers/framework-browser.mjs` |  |
| `CONTROL-002` | Custom framework import from CSV or XLSX | target | done | `tests/evidence.mjs`; `tests/helpers/control-journey.mjs`; `tests/helpers/framework-journey.mjs`; `tests/browser.mjs`; `tests/helpers/control-browser.mjs`; `tests/helpers/framework-browser.mjs` |  |
| `READINESS-001` | Readiness, trend and executive reports | target | partial | `src/evidence/program/readiness.ts`; `src/evidence/program/board.ts`; `src/evidence/program/board-view.ts`; `src/evidence/program/denominator-view.ts`; `tests/readiness.mjs`; `tests/helpers/readiness-browser.mjs`; `tests/report.mjs` | Point 6's 100% after the remaining three requirements are made ready is asserted only inside `assertReadiness` in `tests/helpers/readiness-fixture.mjs` (line 97), which this clause does not cite. The period comparison, drilldown, export reconciliation, filtered and failed reads, 94%, 92% and the no-certified wording are asserted. |
| `CADENCE-001` | Annual, semi-annual and anchored evidence renewal | target | partial | `src/evidence/reviews/`; `tests/cadence.mjs`; `tests/training.mjs`; `tests/access.mjs` | The cited evidence (`tests/cadence.mjs`, `tests/training.mjs`, `tests/access.mjs`) asserts the anchors, reminders, overdue state and one-off override on policy and vendor reviews, but not point 1's eight-month-old pentest report, point 3's semi-annual audit-window periods, point 6's imported annual report or point 7's historical periods; points 1, 3 and 7 are asserted in `tests/program.mjs` (lines 133, 155 and 160), which this clause does not cite. |
| `CONNECT-001` | Least-privilege integration custody and custom collectors | target | done | `src/evidence/connect/`; `src/evidence/collector/`; `scripts/private-collector.mjs`; `scripts/private-collector/git.mjs`; `tests/private-collector.mjs`; `tests/github.mjs`; `tests/helpers/collector-browser.mjs`; `tests/browser.mjs` |  |
| `API-001` | Public REST API for pushed resources, custom tests and program state | target | done | `tests/api.mjs` |  |
| `CLOUD-001` | AWS, Google Cloud and Microsoft Azure | target | done | `src/evidence/cloud/`; `tests/cloud.mjs`; `tests/clouds.mjs` |  |
| `CLOUD-002` | Heroku, Vercel, DigitalOcean, Cloudflare, Netlify, Supabase, MongoDB Atlas and Snowflake | target | missing |  | No implementing path |
| `CODE-001` | GitHub, GitLab, Bitbucket Cloud and Azure DevOps change assurance | target | partial | `tests/github.mjs`; `tests/helpers/github-history-journey.mjs`; `tests/helpers/github-members-journey.mjs`; `tests/helpers/github-dependencies-journey.mjs`; `tests/helpers/collection-schedule-browser.mjs`; `tests/helpers/gitlab-journey.mjs`; `tests/helpers/bitbucket-journey.mjs`; `tests/helpers/azuredevops-journey.mjs`; `tests/helpers/github-findings-journey.mjs`; `tests/helpers/code-manifests-journey.mjs`; `docs/CODE-MANIFESTS.md` | Remaining: a dedicated screen, recursive paths, other formats and scheduled capture of private originals; GitLab, Bitbucket and Azure DevOps normalized vulnerability/secret findings into VULN-001; historical pre-merge outcomes when the source cannot establish them. Bitbucket gaps: manifest paths/formats beyond the four manual root paths, normalized vulnerability/secret findings, unknown reviewed approval revisions and membership/MFA attributes. GitLab gaps: manifest paths/formats beyond the four manual root paths, normalized vulnerability/secret findings, historical approval revisions/times and individual MFA/last-sign-in attributes. Azure DevOps gaps: manifest paths/formats beyond the four manual root paths, normalized vulnerability/secret findings, historical reviewer revisions/times and unexposed Graph activity/admin/MFA attributes. The live journey is field proof (R-3); no provider verification is claimed. |
| `IDENTITY-001` | Google Workspace, Microsoft 365, Entra ID, Okta and JumpCloud | target | done | `src/evidence/identity/`; `tests/identity.mjs`; `tests/access.mjs` |  |
| `APPS-001` | App-level account connectors for access reviews and leaver checks | target | missing |  | No implementing path |
| `MONITOR-001` | Monitoring and alerting evidence from observability tools | target | missing |  | No implementing path |
| `HRIS-001` | BambooHR, Gusto, Rippling, Justworks, Deel HR and ADP Workforce Now personnel sources | target | missing |  | No implementing path: a labeled CSV roster route exists under POPULATION-001 |
| `DEVICE-001` | MDM and EDR posture: Jamf, Intune, Kandji, JumpCloud, Addigy, NinjaOne, CrowdStrike, SentinelOne and Defender for Endpoint | target | missing |  | No implementing path |
| `DEVICE-002` | Owned read-only device monitor for computers without MDM | target | missing |  | No implementing path |
| `VULN-001` | Vulnerability findings from scanners, code and cloud-native sources | target | missing |  | No implementing path |
| `VULN-002` | Penetration-test findings with retest-verified closure | target | done | `src/evidence/vuln/`; `src/evidence/upload.ts`; `src/evidence/program/readiness.ts`; `src/evidence/archive/program.ts`; `migrations/core/0038_pentest.sql`; `tests/vulns.mjs` |  |
| `ISSUES-001` | Security issues from the team's own trackers | target | missing |  | No implementing path |
| `ISSUES-002` | Incidents and incident tasks from trackers and incident tools | target | missing |  | No implementing path |
| `ISSUES-003` | Selector revisions and tracker offboarding and procurement tasks | target | missing |  | No implementing path |
| `INVENTORY-001` | Unified assets, people and ownership | target | done | `src/evidence/inventory/http.ts`; `src/evidence/inventory/storage.ts`; `src/evidence/resources.ts`; `tests/inventory.mjs`; `tests/inventory-browser.mjs`; `tests/github.mjs`; `tests/cloud.mjs`; `tests/identity.mjs` |  |
| `POPULATION-001` | Labeled CSV populations for unsupported systems | target | done | `src/evidence/population/`; `src/evidence/archive/populations.ts`; `tests/population.mjs`; `tests/helpers/population-browser.mjs`; `tests/browser.mjs`; `tests/access.mjs` |  |
| `TEST-001` | Continuous control tests and exception discipline | target | partial | `src/evidence/tests/engine.ts`; `src/evidence/tests/catalogue.ts`; `src/evidence/tests/http.ts`; `tests/api.mjs` | The cited evidence (`tests/api.mjs`) does not assert point 1's at-least-hourly runs, point 2's interrupted collection, or point 3's expired exception and unfilled unobserved period. It asserts the mapped test, the failing resource and all results, the expiring exception, the revised criteria, and that a later pass and a revised denominator keep the earlier failure. |
| `REMEDY-001` | Failed test to verified remediation | target | partial | `tests/work.mjs` | The cited evidence (`tests/work.mjs`) does not assert point 1's Remediate action or attached change, or point 3's regression reopening with both observations retained; the reopening is asserted in `tests/api.mjs` (lines 129-130), which this clause does not cite. The failing control's obligation, the owner and due date, closure that stays open on a failing re-test and the verified fix are asserted. |
| `REMEDY-002` | Remediation SLAs and automatic re-test | target | done | `src/evidence/remedy/storage.ts`; `src/evidence/work/sync.ts`; `src/evidence/tests/engine.ts`; `src/evidence/program/board.ts`; `tests/report.mjs`; `tests/work.mjs` |  |
| `WORK-001` | Two-way remediation tickets in Vector and twelve external trackers | target | done | `src/evidence/work/`; `tests/work.mjs`; `tests/trackers.mjs`; `tests/trackers-browser.mjs`; `docs/TRACKERS.md`; `tests/helpers/tracker-write-journey.mjs`; `tests/helpers/basecamp-webhook-journey.mjs` |  |
| `WORK-003` | Evidence-origin writes to mapped tracker assignees and statuses | target | partial | `src/evidence/work/`; `tests/work.mjs`; `tests/trackers.mjs`; `tests/trackers-browser.mjs`; `docs/TRACKERS.md`; `tests/helpers/tracker-write-journey.mjs`; `tests/helpers/basecamp-webhook-journey.mjs` | Point 1's rule that editing Evidence's accountable owner or compliance state does not stand in for a tracker write, and point 2's expected snapshot in Sync history, are not asserted; the write, read-back, conflict refusal with both values, reason and time, unknown identities, uncertain outcomes and refusal of unsigned and token requests are. Live tracker accounts are R-4. |
| `WORK-002` | Per-test or per-item tickets, with tracker status on tests | target | done | `src/evidence/work/granularity.ts`; `tests/work.mjs` |  |
| `FOLLOWUP-001` | Email, Slack and Microsoft Teams follow-up | target | partial | `src/evidence/followup/`; `tests/followup.mjs`; `tests/policy.mjs`; `tests/cadence.mjs`; `tests/training.mjs`; `tests/access.mjs` | Point 1's SendGrid provider is not asserted: the cited journeys exercise Slack, Teams and the default (Resend) mail provider. The escalation across the calendar boundary, the restart, delivery uncertainty, reconnect, pause and the weekly digest are asserted. Live workspaces and a production mail key are R-5. |
| `FOLLOWUP-002` | Failure notices with an owner and a due date in Slack, Teams or email | target | partial | `src/evidence/remedy/storage.ts`; `src/evidence/followup/opened.ts`; `src/evidence/followup/send.ts`; `src/evidence/followup/channels.ts`; `tests/failure-notices.mjs`; `tests/followup.mjs`; `tests/work.mjs` | Delivered: notice at obligation open (owner, control-owner/escalation fallback that says so), grouped per recipient with per-item due dates, first remediation step, private obligation link and WORK-001 ticket key/link, per cycle and recipient with recorded outcome, quiet-hours deferral, pause, new notice on regression, closure announced, and private-page Acknowledge/Reassign with a recorded reason. Remaining: Acknowledge and Reassign from inside the Slack or Teams message (points 2 and 3), and in-place message update (point 6); a new message is posted instead. Live Slack and Teams workspaces are field proof (R-5). |
| `RISK-001` | Risk register and treatment lifecycle | target | done | `src/evidence/risk/storage.ts`; `src/evidence/risk/http.ts`; `tests/risk.mjs` |  |
| `RISK-002` | Shipped risk library, register import and configurable scoring | target | done | `src/evidence/risk/`; `tests/risk.mjs`; `tests/helpers/risk-browser.mjs` |  |
| `VENDOR-001` | Vendor inventory and security diligence | target | done | `tests/risk.mjs`; `tests/helpers/vendor-journey.mjs`; `tests/vendor-browser.mjs`; `tests/cadence.mjs` |  |
| `VENDOR-003` | Vendor document review with cited findings | target | partial | `tests/helpers/vendor-review-journey.mjs`; `tests/risk.mjs`; `tests/vendor-browser.mjs` | Remaining: scanned/OCR and other unsupported binary document formats, documents or questionnaire transcripts beyond the stated reader/proposal bounds, and broader owner-authorized representative-source proof beyond the synthetic corpus. Readable PDF, UTF-8 text and the native submitted questionnaire source are proved; no OCR or independent supplier verification is claimed. |
| `VENDOR-002` | Vendor discovery and risk-based follow-through | target | missing |  | No implementing path |
| `POLICY-001` | Policy library, approval and version control | target | partial | `src/evidence/policy/`; `src/evidence/attest/`; `tests/policy.mjs`; `tests/cadence.mjs` | Point 5's build-time template check is asserted in `scripts/library-check.mjs` (line 70), which this clause does not cite. The tailoring, exact approval, rejection, publication, readiness listing, replacement and review-deadline failure are asserted. |
| `ATTEST-001` | Employee policy attestations | target | done | `src/evidence/attest/`; `src/evidence/me/http.ts`; `tests/policy.mjs` |  |
| `TRAIN-001` | Shipped security training and KnowBe4 evidence | target | partial | `tests/training.mjs`; `tests/helpers/training-browser.mjs` | Point 3's real KnowBe4 sandbox completion is unproved: no authorized KnowBe4 reporting API key is held (R-7). The controlled KnowBe4 network edge is not a live sandbox receipt. |
| `LIFECYCLE-001` | Joiner, mover and leaver compliance | target | missing |  | No implementing path: departures end sign-in and close attestations; checklists, HRIS events and background checks not built |
| `LIFECYCLE-002` | Ownership handover when a person leaves | target | done | `src/evidence/handover/`; `src/evidence/attest/storage.ts`; `src/evidence/program/readiness.ts`; `src/evidence/program/control.ts`; `tests/handover.mjs` |  |
| `ACCESS-001` | Quarterly access-review campaigns | target | partial | `src/evidence/access/`; `migrations/core/0044_access_cadence.sql`; `tests/access.mjs` | Point 3's complete decision export is not asserted: the export is read for the whole frozen population (9 items) and for one decision (the guest revoke with its reason and decider), and its CSV for the row count and revocation evidence; the employee retain, privileged-service change and uploaded-list decisions and the exclusion are never read from either. The quarterly campaign, own-access and other-owner refusals, delegation, unresolved and verified revocations, the re-uploaded list, the attached-exhibit receipt and the next quarterly period are asserted. |
| `AUDIT-001` | Period-specific auditor workspace and request lists | target | done | `tests/review.mjs`; `tests/helpers/engagement-journey.mjs`; `tests/engagement-browser.mjs`; `tests/helpers/engagement-browser.mjs`; `tests/handover.mjs`; `tests/readiness.mjs` |  |
| `AUDIT-002` | Type II populations, sampling and non-occurrence | target | missing |  | No implementing path |
| `AUDIT-003` | Auditor review of continuous test evidence for the period | target | done | `tests/review.mjs`; `tests/helpers/audit-sharing-journey.mjs`; `tests/engagement-browser.mjs`; `tests/helpers/audit-remediation-journey.mjs` |  |
| `TRUST-001` | Published and permissioned trust center | target | partial | `src/evidence/review/http.ts`; `tests/review.mjs` | Scoped expiring reviewer downloads are implemented; trust publication, customer access requests, NDA integrations and domains are missing. |
| `TRUST-002` | CRM-driven access, click-through NDA and live control status | target | missing |  | No implementing path |
| `TRUST-003` | Trust-center updates, subscribers and subprocessor-change notices | target | done | `tests/trust.mjs`; `tests/helpers/trust-journey.mjs`; `tests/trust-browser.mjs`; `tests/engagement-browser.mjs`; `tests/helpers/engagement-browser.mjs`; `tests/live/trust-sendgrid.mjs` |  |
| `TRUST-005` | Customer-facing publication and confirmation notifications | target | done | `tests/trust.mjs`; `tests/helpers/trust-journey.mjs`; `tests/trust-browser.mjs`; `tests/helpers/engagement-browser.mjs` |  |
| `TRUST-004` | Cited visitor Q&A on the trust center | target | missing |  | No implementing path |
| `ANSWER-002` | Portal and web-form questionnaire capture and fill-back | target | partial | `public/portal-extension/`; `src/evidence/answer/portal.ts`; `src/evidence/answer/portal-documents.ts`; `tests/agent.mjs`; `tests/helpers/answer-journey.mjs`; `docs/PORTAL-QUESTIONNAIRES.md` | Native Chromium scanner and applier proof exists, but installed-extension journeys exercising browser permissions, session storage and scripting in Chrome, Microsoft Edge and Brave have not yet run. No three-browser installation or acceptance claim is made. The current extension supports standard visible native fields, explicit manual page navigation and bounded captures; embedded frames, custom controls and framework-specific change-event integration remain unsupported and are refused where detectable. |
| `ANSWER-003` | Questionnaire collaboration, PDF capture and answer-library import | target | missing |  | No implementing path |
| `MIGRATE-001` | Switch from Vanta, Drata and Secureframe | target | done | `src/evidence/import/`; `src/evidence/import/bundle/`; `tests/import.mjs`; `tests/helpers/migrate-journey.mjs`; `tests/browser.mjs`; `tests/helpers/move-in-browser.mjs`; `docs/MOVE-IN.md` |  |
| `MIGRATE-002` | Switching in the middle of an audit period | target | missing |  | No implementing path |
| `PORTABLE-001` | Full-program transfer and Base replacement obligations | target | done | `src/evidence/archive/service.ts`; `src/evidence/archive/portable-export.ts`; `src/evidence/archive/portable-restore.ts`; `tests/archive.mjs`; `tests/helpers/portable-journey.mjs`; `tests/review-browser.mjs`; `tests/helpers/portable-browser.mjs`; `tests/vulns.mjs`; `tests/work.mjs`; `tests/import.mjs`; `tests/agent.mjs`; `tests/population.mjs`; `tests/identity.mjs`; `tests/risk.mjs`; `tests/github.mjs`; `tests/private-collector.mjs`; `tests/readiness.mjs`; `docs/BACKUP-RESTORE.md` |  |
| `AUTH-001` | Roles, SSO and scoped authorization | target | partial | `src/evidence/authz/`; `src/auth.server.ts`; `src/evidence/http.ts`; `src/evidence/door.ts`; `docs/ACCESS.md`; `tests/roles.mjs`; `tests/live/okta-sso.mjs`; `tests/live/receipts/okta-sso.json`; `tests/email-link.mjs` | Delivered: administrator, compliance manager, control owner, contributor and risk approver roles with business, team, control and record-area scope, separation of duties, session and grant revocation, SCIM provisioning and deprovisioning, MFA enforcement, audited break-glass and Okta sign-in against a live sandbox (R-9). Remaining: the Google Workspace and Microsoft Entra ID sign-in legs are proved only at a provider fake (live tenants and a live Okta SCIM push are R-8), and the clause has not been judged since RL-102 adopted the role default. |
| `SECURE-001` | Restricted evidence and declared external flows | target | partial | `src/evidence/secure/`; `src/evidence/connect/custody.ts`; `src/evidence/upload.ts`; `src/evidence/http.ts`; `docs/KEY-CUSTODY.md`; `tests/secure.mjs`; `tests/helpers/interpret-journey.mjs` | Fresh judgement pending: all acceptance points are asserted through public doors, and the clause has not been judged since RL-104 adopted the restricted-record and flow default. Exhibit bytes rely on storage-provider encryption and are not application-sealed, and actual provider retention, region and key-loss evidence is still required (RL-104). |
| `ERASE-001` | Explicit erasure, holds and restore fencing | target | partial | `src/evidence/erase/`; `tests/archive.mjs`; `tests/helpers/erasure-journey.mjs`; `tests/vendor-browser.mjs`; `tests/helpers/promise-journey.mjs`; `tests/trust-browser.mjs` | Delivered: owner-only standalone-exhibit erasure with exact preview and typed ERASE, exact-subject and business-wide holds, share revocation, pending work and retry, byte absence and restore fencing; engagement holds that cascade to exhibits under selected controls and submitted exhibits, stay active when overdue and fence concurrent confirmations and later submissions; overdue reviews on the owner desk and Privacy with one notice to the active original authorizer; append-only exhibit classifications that attach a person, vendor or engagement without granting access; and classifications, hold history and pending-deletion fences that survive custody restore. Promise-linked exhibits refuse standalone execution until their retained derivatives are classified; no completed erasure is claimed. Not yet built: person, vendor, engagement and business execution, cascading holds for records beyond submitted or explicitly classified exhibits, partial erasure with disclosed retention, the AUTH-001 privacy and legal role, linked-import retirement, mirrored tracker comment text (including held text), actor anonymization in LOG-001 and deletion of provider copies beyond the native R2 store. A restored hold whose original authorizer has no active local identity stays overdue on the desk without sending to a substitute. |
| `LOG-001` | Permanent accountable action audit | target | partial | `src/evidence/door.ts`; `src/evidence/audit/`; `src/evidence/audit/auth.ts`; `src/evidence/followup/send.ts`; `src/evidence/followup/resolve.ts`; `src/evidence/import/http.ts`; `src/evidence/review/storage.ts`; `src/evidence/agent/storage.ts`; `migrations/core/0046_audit_context.sql`; `tests/import.mjs`; `tests/followup.mjs`; `tests/review.mjs`; `tests/agent.mjs`; `tests/policy.mjs`; `tests/work.mjs` | Point 1's erasure and point 3's anonymous erased actor are not asserted: no cited journey performs an erasure, and person erasure with actor anonymization is not built (ERASE-001). The import, undo, folder read and refusal, approval, source change and failed-send entries, export, restart, restore, secret exclusion and uncertain-send resolution are asserted. |
| `OPS-001` | Durable operation, health and recovery | target | partial | `SEED-COMMAND-CONTRACT.md`; `src/auth.server.ts`; `src/evidence/ops/`; `src/evidence/scheduler.ts`; `migrations/core/0048_operations.sql`; `docs/OPERATIONS.md`; `tests/ops.mjs`; `tests/ops-browser.mjs`; `tests/open.mjs`; `tests/browser.mjs`; `tests/evidence.mjs`; `tests/archive.mjs`; `tests/email-link.mjs` | Point 1's documented setup, dev and build commands are not exercised in a cited file: the cited journeys start the runtime harness directly (the production build runs in Verify through `scripts/verify.mjs`, which this clause does not cite). The named-setting refusal, restarts during collection and notification, storage interruption, health, durable outcomes, backup restore, additive migration, size refusal and USD explanation are asserted. |
| `MOBILE-001` | Responsive and accessible complete workflows | target | partial | `tests/browser.mjs`; `tests/review-browser.mjs`; `src/evidence/view.ts`; `public/desk.css`; `public/review.css` | Existing owner/reviewer custody flows have 1440/390 browser journeys; new program/employee workflows and mobile camera validation are unproven. The human screen-reader pass and VPAT are field proof (R-13, R-14). |
| `PUBLIC-001` | Preserve the approved installation and run surfaces | target | partial | `tests/site.mjs`; `tests/browser.mjs` | Point 2's reviewer flows at 1440 and 390 are asserted in `tests/review-browser.mjs`, which this clause does not cite; the built site, no-JavaScript landing, Lobby before and after setup and the owner flows are asserted. |
| `OPEN-001` | Free and open source under the MIT license | target | done | `LICENSE`; `package.json`; `src/evidence/costs.ts`; `docs/PROVIDER-COSTS.md`; `tests/open.mjs`; `tests/helpers/open-browser.mjs`; `tests/browser.mjs` |  |
| `OWN-001` | Run on your own computer or Cloudflare account, with your evidence in your own database | target | partial | `tests/live/own-macos.py`; `tests/live/own-daytona.py`; `tests/live/own-hosted.mjs`; `tests/archive.mjs`; `tests/helpers/portable-journey.mjs`; `README.md`; `RUN-LOCALLY.md`; `deploy.json` | Ubuntu stop and restart and the complete one-hour outbound capture remain unproved, and the live hosted archive manifest still returned 503 after the native batching changes, so complete live validation, restore and every-record and original-byte reconciliation remain unproved. Fresh checkout and CLI home on an existing macOS do not establish the full clean-machine point. The run receipts are in CHANGELOG.md. |
| `AGENT-002` | Prove operation across the audit period | push-further | done | `src/evidence/agent/period-analysis.ts`; `src/evidence/agent/period-http.ts`; `src/evidence/agent/period-storage.ts`; `src/evidence/agent/period-archive.ts`; `tests/agent.mjs`; `tests/helpers/period-agent-journey.mjs`; `tests/period-agent-browser.mjs` |  |
| `AGENT-003` | Investigate, fix narrowly and re-test the real system | push-further | missing |  | No implementing path |
| `AGENT-004` | Maintain collectors without manufacturing evidence | push-further | missing |  | No implementing path |
| `AGENT-005` | Keep customer promises current | push-further | done | `tests/trust.mjs`; `tests/helpers/promise-journey.mjs`; `tests/trust-browser.mjs`; `tests/agent.mjs` |  |
| `AGENT-006` | Tailor policies, risks and structured obligations | push-further | partial | `src/evidence/agent/tailoring-storage.ts`; `src/evidence/agent/tailoring-interpret.ts`; `src/evidence/agent/tailoring-http.ts`; `src/evidence/authz/reviewers.ts`; `tests/agent.mjs`; `tests/helpers/tailoring-journey.mjs`; `tests/helpers/interpret-journey.mjs`; `tests/live/receipts/anthropic-tailoring.json`; `tests/helpers/assurance-browser.mjs`; `tests/period-agent-browser.mjs` | Fresh judgement pending: deterministic cited preparation, model interpretation through the declared SECURE-001 flow, exact-hash decisions, atomic downstream records, CONTROL-002 inheritance and the reviewer role check are delivered, and the clause has not been judged since RL-101, RL-102 and RL-104 adopted the defaults it runs on. |
| `AGENT-007` | Check uploaded and captured evidence before the auditor sees it | push-further | missing |  | No implementing path |
| `AI-001` | AI inventory and governance | push-further | missing |  | No implementing path |
| `BOUNDARY-001` | US-first scope and independent specialist services | target | done | `src/evidence/program/boundary.ts`; `src/evidence/program/http.ts`; `src/evidence/costs.ts`; `src/evidence/library/`; `tests/program.mjs`; `tests/work.mjs`; `tests/cloud.mjs`; `tests/population.mjs`; `tests/followup.mjs` |  |
| `SURFACE-001` | The registry equals this table and the Base harness passes | target | missing |  | No MCP door exists yet: Evidence's agent doors today are the prepare-only desk and folder commands and the REST API, and no tool declares a risk class. |
| `SURFACE-002` | External calls carry their recipients and counterparty | target | missing |  | No MCP door exists yet: Evidence's agent doors today are the prepare-only desk and folder commands and the REST API, and no tool declares a risk class. |
| `SURFACE-003` | Commitments carry their exact revision | target | missing |  | No MCP door exists yet: Evidence's agent doors today are the prepare-only desk and folder commands and the REST API, and no tool declares a risk class. |
| `SURFACE-004` | Access, security, gated and live calls | target | missing |  | No MCP door exists yet: Evidence's agent doors today are the prepare-only desk and folder commands and the REST API, and no tool declares a risk class. |
| `SURFACE-005` | Sensitive reads and destructive erasure | target | missing |  | No MCP door exists yet: Evidence's agent doors today are the prepare-only desk and folder commands and the REST API, and no tool declares a risk class. |
| `SURFACE-006` | Evidence events for the compliance analyst | target | missing |  | No MCP door exists yet: Evidence's agent doors today are the prepare-only desk and folder commands and the REST API, and no tool declares a risk class. |
| `SURFACE-007` | The compliance analyst's seeded week through MCP | target | missing |  | No MCP door exists yet: Evidence's agent doors today are the prepare-only desk and folder commands and the REST API, and no tool declares a risk class. |
