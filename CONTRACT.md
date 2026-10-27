# Evidence target product contract

Target date: **16 October 2026**. Evidence is an owned security compliance automation and customer-trust product for a US security or operations lead at a 20–250 person business. A buyer can replace Vanta, Drata or Secureframe for framework readiness, continuous control testing, policy and employee compliance, remediation, risk/vendor management, auditor collaboration and customer security reviews. Comp AI, Sprinto and Delve are the comparison set for the next step: agents carry a failed control to a narrowly authorized fix and fresh source proof, while preserving the original failure.

## Product target

| | |
| --- | --- |
| Category | Security compliance automation and customer trust (SOC 2, ISO 27001, HIPAA, PCI DSS) |
| Incumbents a buyer switches from | Vanta, Drata, Secureframe, Comp AI, Sprinto, Delve |
| First buyer | A US security or operations lead at a 20–250 person business preparing for SOC 2, ISO 27001, HIPAA or PCI DSS readiness, or moving its program off Vanta, Drata or Secureframe; one installation for the business, costs in USD |

The primary journey: Exercise the capabilities and acceptance journeys below.

## How to read this contract

- This follows the RER contract standard.
- Core, Agent surface and Later are reported separately.
- Done means every acceptance point has recorded proof.
- Field proof is kept in its register.
- ACCEPTANCE.md and the homepage claims document are generated from this file.

## Shared duties (Base)

| Base duty | Duty | Delta clauses | Base journey |
| --- | --- | --- | --- |

## Published clauses

- `PROOF-001`: *Tier:* Core
- `GAP-001`: *Tier:* Core
- `COLLECTION-001`: *Tier:* Core
- `REVIEW-001`: *Tier:* Core
- `ANSWER-001`: *Tier:* Core
- `IMPORT-001`: *Tier:* Core
- `CUSTODY-001`: *Tier:* Core
- `AGENT-001`: *Tier:* Core

### Immutable proof and collection

#### PROOF-001 — Immutable exhibits and attributable receipts

**Requirement.** An owner creates Control → Requirement → Exhibit → Receipt through `/app`. The server reads stored bytes before issuing a receipt, records server time and authenticated actor, ignores forged digest/origin fields, appends explicit same-requirement replacements, and retains original bytes and facts. Each read verifies size and SHA-256. Source-observed, manually-asserted and imported remain distinct; a fingerprint proves unchanged stored bytes, not truth or operation of a control. The detailed receipt rules below remain binding.

**Acceptance.**
1. Use `/app/controls` and the requirement upload form, attempt forged receipt facts, replace an exhibit, reload its original receipt and download both versions.
2. Attempt a double replacement, oversized upload and changed/missing object: refuse unsafe writes/downloads and retain facts.
3. `tests/evidence.mjs` exercises these production HTTP doors.

#### GAP-001 — Honest period-specific proof coverage

**Requirement.** `/app` and `/api/desk` derive covered, due soon, overdue, missing, superseded-only or unavailable bytes per requirement and selected UTC cadence period. Imported history cannot establish current proof. Storage failure is unavailable, never green. Historical completeness describes recorded assertions and remains separate from observed control effectiveness. The detailed period rules below remain binding. Semi-annual, annual and anchored renewal periods are CADENCE-001; they add periods and never change these four.

**Acceptance.**
1. At the desk select daily, weekly, monthly and quarterly periods, advance across their deadlines and inspect a superseded period, imported-only proof and changed/missing R2 bytes.
2. Reopen a completed historical period and confirm the original state logic.
3. `tests/evidence.mjs` exercises these cases through `/api/desk` and receipt downloads.

#### COLLECTION-001 — Scheduled source collection with visible failures

**Requirement.** Owner-authorized collectors run without an open browser on configurable schedules and source events. Every run records account/asset coverage, connector and control revision, source and receipt timestamps, audit period, cursor, completeness and a terminal outcome. Source-observed evidence requires a successful authorized read; manual uploads and imported artifacts cannot impersonate it. Pagination, partial permissions, throttling, expired grants, dropped assets and schema drift create explicit gaps. Bounded backoff resumes collection without duplicate receipts or fabricated catch-up observations.

**Acceptance.**
1. Connect a real authorized sandbox via the Connections UI, schedule collection, close the browser, change the source and inspect the next run.
2. Revoke a required scope, throttle a page and interrupt a run; reconnect and resume.
3. The run history and period report preserve missing coverage, failure and recovery separately; only actual source reads issue observed receipts.
4. **Current partial slice (22 October 2026):** The twelve hosted collectors are GitHub, GitLab, Bitbucket Cloud, Azure DevOps, AWS, Google Cloud, Azure, Okta, Google Workspace, Entra ID, JumpCloud and KnowBe4.
5. Whole-credential rejection and owner revocation immediately append unknown test evaluations, and current readiness refuses withdrawn or not-yet-reread renewed authority without rewriting earlier observations.
6. Owners set elapsed schedules of 5–60 minutes in whole multiples of five (default 60), measured in UTC since the last attempt, on the next five-minute Cron tick.
7. Backoff takes precedence.
8. Schedule changes are audited and preserve provider configuration. A missed interval creates no catch-up observation. Private Git keeps its computer's own scheduler and refuses hosted scheduling and source-event grants. Every attempt retains its interval, account/provider, connector revision, accepted library revision, enabled test criteria/revisions, linked control definitions and installation audit-period revisions. Later definition, mapping, library and program changes never reinterpret earlier snapshots. Successful and partial authorized reads have a source-read start; every terminal attempt has its receipt time, outcome and original gaps. These are collector clocks, not invented provider modification times: an unreported source-event time stays unknown, and a forwarded reported time stays explicitly unverified. Owner-only connection and control period reports retain earlier failures and later recovery separately, plus elapsed windows without an attempt. Historical rows without captured context stay unavailable. Consumed security fields are validated against the provider's documented response shapes. GitHub checks the requested organization and selected repository identity (case-insensitive canonical names), refuses foreign-owner repository listings, and validates repository/protection/alert fields. Azure checks list envelopes and identities, safe same-resource continuations, storage/SQL/network fields, enabled log destinations and all three Defender plan tiers. Google Cloud checks lists, project identity, IAM/audit configuration, storage/IAM, service accounts/keys, SQL and firewalls. Directory readers check identity, lifecycle, admin/MFA/timestamp/group facts. KnowBe4 admits completions only for exact completed states, valid identities and dates and complete non-duplicated enrollment pages. AWS checks STS/IAM/credential reports, S3, CloudTrail, EBS, security-group CIDRs/ports, RDS and GuardDuty. Class-specific malformed, denied, incomplete or repeated pages remain explicit historical gaps with known affected subjects unknown. A disabled API and explicit empty collections stay distinct from missing facts. Azure SQL refuses more than 50 servers before reading a subset; AWS refuses truncated bucket/account scopes. Current catalog/manual-replacement semantics are unchanged. Hosted paged reads retain durable continuations before the next network request. GitHub retains alert numbers and same-endpoint cursors (64 KiB); the other readers retain only declared source fields, compressed into the existing custody-preserved run record (8 MiB decoded and within the row's remaining 240,000-character metadata budget). An incomplete read may resume for at most one hour, with its original source-read time. Authority, selected scope/configuration and control/test/library/audit-period context changes require fresh reads. Completed top-level inventories and class lists refresh on retry; completed nested account lookups can be reused only within the same incomplete read. Unsafe/repeated continuations or storage bounds refuse completeness; unusable/expired checkpoints require fresh authorized reads. No cached fact acquires a fabricated fresh timestamp. Original failed/throttled runs and checkpoints survive recovery and inactive restore. The source-provider tests use official-schema network-edge fakes; no live provider validation is claimed. **Source-event default approved with riders (ct, 22 October 2026 23:45Z):** Forwarded events use `/v1/connections/{id}/events`, an expiring `resource-push` API token and a separate owner-only, per-connection grant with a recorded reason. New connections deny events. Store only the token digest, show the token once and never export it. Expiry or failed registration destroys token authority; restoration leaves it inactive (WORK-001). Native provider webhook provisioning is not claimed. The event is an unverified hint: only its fingerprint, authenticated token reference, received time and optional explicitly unverified reported time enter the durable queue; no payload becomes evidence and an event never issues an evidence receipt. Only an actual authorized source read produces source-observed evidence; API-001 pushed records remain source-reported. The next scheduler run performs a real authorized read even before the elapsed interval is due, honoring source backoff. Duplicate event ids for the same token and connection share one queue entry; replay and duplicate deliveries are idempotent. Restart reconciles an already committed collection before another read; pending events cannot revive restored token or connection authority. Removing a grant, revocation and expiry prevent pending dispatch. Owner pages show original event queue records and collection outcomes. API-001, AUTH-001, SECURE-001 and later source providers under CODE-001, CLOUD-002, APPS-001, MONITOR-001, HRIS-001 and DEVICE-001 inherit these event-authentication, no-payload-evidence, audit and restore obligations. The grant and its reason are audited. COLLECTION-001 remains PARTIAL for the remaining acceptance and named Gaps below.

### Audit folders and questionnaires

#### REVIEW-001 — Selected expiring evidence folders

**Requirement.** Owners select controls, an inclusive date range and expiry at `/app/folders`. A one-time bearer link exposes only the scoped read-only projection, checked on every request and again before disclosure. Closing is terminal; unknown, changed, closed, expired and out-of-scope requests receive the same plain 404. Tokens never appear in stored owner lists, events or archives. Originals inside a folder scope remain visible even after redacted replacement; inspect the full list before sharing. The detailed reviewer rules below remain binding.

**Acceptance.**
1. Issue a folder through `/api/folders`, open its `/review/{token}` page and download only in-period exhibits.
2. Try a crossing-period receipt, foreign control, write, altered token, expiry during a read and closed folder.
3. Owner event history retains allowed/refused attempts without raw links.
4. `tests/review.mjs` and `tests/review-browser.mjs` cover these doors.

#### ANSWER-001 — Cited security-questionnaire completion

**Requirement.** Upload XLSX, CSV, DOCX and PDF questionnaires (PDF capture, per-question collaboration and answer-library import are ANSWER-003; portal questionnaires are ANSWER-002), preserve question IDs, sections and required answer format, and draft answers only from authorized approved policies, control observations, audit reports and prior approved answers. Every material assertion cites exact source revision and relevant period; unsupported or contradictory questions stay flagged. A named security/legal reviewer approves the exact answer set and recipient before export or submission. Export preserves the buyer’s template; reusable answers expire or invalidate when sources change. Each draft reports counts of cited, uncited-but-flagged and conflicting answers. An answer is either cited to sources that support every assertion in it or flagged; it is never drafted uncited.

Before shipping, this clause adds questionnaire completion records to the READINESS-001 checklist, with reconciled counts and record drilldown.

**Acceptance.**
1. Against a populated program (approved policies, passing and failing tests, a SOC 2 report), upload a full-length SIG Lite (XLSX) and CSA CAIQ v4 (XLSX), plus a CSV and a DOCX customer questionnaire, in Questionnaires, and generate cited drafts.
2. A held-out reviewer key, prepared independently, lists for each question whether the populated sources can answer it and which source supports it.
3. Then check: - the draft reports cited, flagged and conflicting counts that reconcile to the question total; - at least 90% of the questions the key marks answerable are drafted with citations; - 100% of citations resolve to the source revision and period they name, and support the claim per the key; - zero answers are uncited or assert beyond their sources; - every question the key marks unanswerable is flagged.
4. Inspect citations, edit and approve an exact version.
5. Modify a source after approval and attempt reuse/submission: require a new decision.
6. Export and reopen the original formats without losing question placement, IDs or flagged gaps.

### Import, custody and approvals

#### IMPORT-001 — Reviewed Drata archive admission and undo

**Requirement.** The owner dry-runs the documented Drata ZIP/HTML-manifest shape, reviews every proposed mapping and unsupported item, explicitly admits a Base journal and can undo active native links while original artifacts and immutable custody remain. Imported history never proves a live control operated. Original archive bytes and source provenance remain available; the supported shape and synthetic-fixture boundary in `docs/DRATA-IMPORT.md` are explicit.

**Acceptance.**
1. Through Move-in, inspect a documented-shape Drata ZIP, review mappings and refuse unsafe/malformed artifacts, admit with a journal, then undo active links.
2. Inspect retained originals and import history after undo, restart and archive restore.
3. `tests/import.mjs` exercises these routes; a real customer export remains separately required under MIGRATE-001.

#### CUSTODY-001 — Complete custody archive and empty-target restore

**Requirement.** At `/app/archive` the owner inventories, streams, dry-runs and restores the current Evidence domain archive, including all controls, requirements, immutable receipts, actor provenance, available verified exhibits, closed reviewer-folder history, import custody/original ZIPs and agent snapshots/decisions. The archive records unavailable bytes honestly, validates all entries before business admission and requires empty product data/bucket. Restoration grants no source-owner, reviewer or agent authority. The versioned format, size bounds and distinction from Base generic transfer below remain binding.

**Acceptance.**
1. Export through `/api/archive/export`, inspect the manifest, dry-run and restore into empty real D1/R2; compare every portable record and byte.
2. Try altered digests, traversal, missing/unlisted files, unavailable bytes and a nonempty target.
3. Refusal preserves the target; successful restore leaves grants inactive.
4. `tests/archive.mjs` and `tests/review-browser.mjs` exercise HTTP/CLI custody journeys.

#### AGENT-001 — Prepare-only proposals with exact human approval

**Requirement.** Expiring/revocable prepare-only agent credentials read the permitted desk and prepare an evidence-folder proposal. Only an authenticated owner session approves the exact current proposal snapshot; changed or stale snapshots require a new decision. Immutable decisions survive restart and archive transfer without reviving agent authority. Preparation does not grant sharing or source-write power. See `docs/AGENT-COMMANDS.md`.

**Acceptance.**
1. Issue a prepare token, inspect gaps and propose a folder through agent commands/API.
2. Attempt direct sharing, owner-only mutation, approval with an agent token and stale-snapshot approval; refuse each.
3. Have the owner approve the current snapshot, revisit its immutable decision and revoke the token.
4. `tests/agent.mjs` exercises these doors.

## Target clauses

### Program and readiness

#### PROGRAM-001 — Framework programs and applicability

*Tier:* Core

**Requirement.** A US security or operations lead at a 20–250 person business can run SOC 2 Type I and Type II, ISO 27001, HIPAA and PCI DSS programs. Each program records its framework edition, licensed requirement references where necessary, legal entity, in-scope products, teams, regions, systems, audit period, assessor, accountable lead and milestone dates. An applicability review records exclusions and rationale; changing editions creates a reviewable mapping change, never a retroactive pass. Each core program is created pre-mapped to the shipped control library (LIBRARY-001) and produces its framework-required documents (PROGRAM-003); extended and regulated programs are PROGRAM-004.

**Acceptance.**
1. From the program-setup UI, create each of the four core programs for a US SaaS business, choose two scoped products and different periods, review applicability with an assessor, then upgrade one framework edition.
2. Reopen the program and export it: owners, exclusions, edition history and unresolved obligations survive; excluded work is visible and no certification is asserted.

#### PROGRAM-003 — Framework-required program documents

*Tier:* Core

**Requirement.** Each core program generates, versions and exports the deliverables its assessor asks for, each with an accountable owner, approver, effective date, annual (or owner-set shorter) review deadline and full revision history:
- **SOC 2:** a system description following the AICPA description criteria (services, principal service commitments and system requirements, infrastructure, software, people, data, procedures, subservice organizations with carved-out/inclusive treatment, complementary user entity controls, and changes during the period). Draft sections pre-fill from connected inventory, approved policies and program scope; every pre-filled statement cites its source record and revision, and unsupported sections stay marked for the owner. Export as DOCX and PDF.
- **ISO 27001:2022:** a Statement of Applicability listing every Annex A control with included/excluded state, justification, implementation status and linked controls/evidence. Also records for the clause 6.1 risk assessment and treatment plan, a clause 9.2 internal-audit program (independent auditor, scope, findings, nonconformities and corrective actions) and a clause 9.3 management review (required inputs, decisions and actions).
- **HIPAA:** a Security Rule risk analysis per 45 CFR 164.308(a)(1)(ii)(A), covering ePHI systems and flows, threats and vulnerabilities, likelihood/impact, current safeguards and a remediation plan linked to RISK-001. Also the HIPAA policy set and the business associate agreement inventory from VENDOR-001.
- **PCI DSS v4.0.1:** cardholder-data-environment scope with data-flow and network diagrams attached as exhibits, guided SAQ type selection (A, A-EP, B, B-IP, C, C-VT, P2PE, D-Merchant, D-Service Provider) with recorded answers, a requirement-by-requirement worksheet for the chosen SAQ, and a handoff package for the Attestation of Compliance that the merchant or QSA signs.

Reconcile every document with live program state. An SoA exclusion must match the PROGRAM-001 applicability decision, a control marked implemented must have a current passing test or accepted evidence, and a drift between document and program flags the document as needing review. Evidence never signs an attestation or AOC on anyone's behalf. PROGRAM-003 also carries the RISK-002 document integration: starting the HIPAA risk analysis and adding the shipped library scenarios inside that document.

**Acceptance.**
1. For each core program, generate its documents from a populated program through Program → Documents, edit and approve a revision, and export it (system description as DOCX and PDF, SoA as XLSX and PDF, risk analysis and SAQ worksheet as PDF).
2. Then reconcile each document with program state.
3. The SOC 2 description cites the inventory and policy revisions it pre-filled from.
4. The SoA lists all 93 Annex A:2022 controls, and its exclusions match applicability.
5. Record an internal audit with one nonconformity and corrective action, and one management review.
6. Switching the SAQ answers changes the selected type and worksheet.
7. Start the HIPAA risk analysis and add its RISK-002 library scenarios inside the document.
8. Fail a test mapped to a control the SoA marks implemented: the SoA flags drift and needs review, and the approved prior revision stays retrievable. Also (ct 22 Oct 2026): the SAQ A worksheet lists only SAQ A's requirement ids and names its SAQ revision; a not-applicable or CCW response without its explanation blocks approval. **Current semantics (22 October 2026):** Program → Documents lists the documents of the program's framework (SOC 2 system description; ISO Statement of Applicability, clause 6.1 risk assessment and treatment plan, clause 9.2 internal-audit programme and clause 9.3 management review; HIPAA risk analysis, policy set and business associate agreement inventory; PCI cardholder-data-environment scope, SAQ selection and worksheet, and Attestation of Compliance handoff). The owner generates each once; every generation, owner edit, input change and reconciliation writes a new immutable revision from live program state, and an approval names an approver from People, an effective date and a review deadline (the accountable owner's cycle: 12 months by default, 1 to 12 months by owner choice), kept beside the revision it approved. Pre-filled statements cite their source record and exact revision (program scope revision, inventory resource counts with the latest update, published policy version, vendor and vendor-document digest, risk and treatment records); a section that records cannot support stays marked for the owner and blocks approval until the owner writes it. Every document exports as PDF, DOCX and XLSX (a real WordprocessingML, SpreadsheetML or PDF file) with a document-control table and the statement that Evidence does not sign, attest or certify; each export is audited with its revision. A document's facts are compared with live state: a difference flags the approved document as needing review, naming each item (an SoA exclusion that no longer matches the applicability decision, a control marked implemented that no longer has current proof and passing tests, a changed inventory count or policy version, a BAA that changed state), and a reconciliation writes a new revision; the approved revision stays retrievable and exportable. Implementation status in the SoA is derived, never typed: implemented needs every mapped control's proof current and any mapped test passing now. The HIPAA risk analysis adds the shipped ePHI scenarios from inside the document as RISK-001 risks the owner can change; its BAA inventory and ePHI flows come from VENDOR-001. The SAQ type is selected from recorded answers (the most demanding channel decides); Each SAQ worksheet lists, requirement by requirement, the PCI DSS v4.0.1 requirement ids that SAQ's current revision assesses (Evidence's mapping, named with the SAQ revision it was read from), in Evidence's wording with that revision's response choices and the explanation each choice needs; other requirements are not shown. The PCI SSC text is licensed and not shipped: the merchant or QSA confirms the worksheet against the licensed SAQ, and the worksheet and AOC handoff say so. A new SAQ revision arrives as a reviewable library revision that flags approved worksheets for review. The January 2025 SAQ A revision is library revision 3; the installation keeps its earlier accepted SAQ revision until its owner reviews and accepts that change. Response choices follow the selected revision, with explanations required for not applicable, CCW, not tested (SAQ D only) and not in place; Evidence checks presence and the merchant or QSA judges adequacy. Diagram exhibits are retained originals with their digest. ISO audits and management reviews are recorded with their independence statement, nonconformities and corrective actions, and required clause 9.3 inputs. Document tables and exhibits join the custody archive. PROGRAM-004 inherits the document model, drift review and no-attestation obligations; AUDIT-001 and TRUST-001 inherit exports as the assessor's source.

#### PROGRAM-004 — Extended and regulated programs

*Tier:* Core

**Requirement.** The same versioned program, library and readiness model runs these programs:
- **US Data Privacy (USDP):** one consolidated control set covering the CCPA as amended by the CPRA and every enacted comprehensive US state privacy law, at minimum Virginia, Colorado, Connecticut, Utah, Texas, Oregon, Montana, Iowa, Delaware, New Hampshire, New Jersey, Nebraska, Tennessee, Minnesota, Maryland, Indiana, Kentucky and Rhode Island. Each requirement carries its per-state citations and effective dates. The applicability review records each state's thresholds (for example California's annual-revenue and consumer/household thresholds, and other states' consumer-count and sale-of-data thresholds) against the business's own figures, and only states that apply generate obligations; the others stay visible as excluded with the recorded figures. The program produces consumer-rights request records, privacy-notice and opt-out (including universal opt-out signal) evidence, data-protection assessment records and a self-attestation document. Newly enacted or amended state laws arrive as reviewable library revisions.
- **ISO/IEC 27701** (the 2019 extension to ISO 27001 and the 2025 standalone edition), with PII controller and processor controls and the privacy information management system records it requires.
- **Further privacy, AI, government and sector programs:** GDPR (for US businesses with EU customers, including Article 30 records of processing, DPIA records and data-subject request evidence); ISO/IEC 42001:2023; NIST AI RMF 1.0; NIST CSF 2.0; NIST SP 800-53 Rev. 5 (Low/Moderate baselines); CMMC 2.0 Level 1 and Level 2 (NIST SP 800-171 Rev. 2) with an SPRS score worksheet; FedRAMP readiness (Moderate baseline); and HITRUST CSF readiness.

Each ships requirements (with licensed text where required), pre-mapped library controls, the program's required document records, and declared assessment or authorization dependencies (an accredited ISO certification body for ISO 27701, a C3PAO, a FedRAMP 3PAO and agency sponsor, a HITRUST assessor; USDP is self-attested, with counsel confirming state applicability). Cross-mapping reuses evidence already collected for core programs.

**Current semantics (22 October 2026):** The extended programs run on the program, library and readiness model unchanged: each is a program of a shipped framework edition, created from program setup on a business that already runs SOC 2, with every requirement mapped to library controls (the core controls it shares with SOC 2, ISO 27001, HIPAA and PCI DSS, plus shipped privacy, AI and CUI controls) so readiness reports zero unmapped requirements and shows, from the shared controls, the evidence reused from each other program. Readiness names the external body that decides or authorizes (a certification body, C3PAO, HITRUST assessor, counsel); no program asserts certification or attestation. **USDP:** a requirement is one consolidated obligation in one state (`CA.ACCESS`), carrying that state's act, duty-level statutory section and effective date (a phased provision has its own date); the section note distinguishes rulemaking authority, conditional duties and a retained checklist practice broader than the cited law, and counsel confirms exceptions and implementation dates (`docs/USDP-CITATIONS.md`); the business records annual revenue, the share of revenue from selling personal data, small-business and sensitive-data status and consumers per state, each state's threshold is evaluated on those figures, and only states that apply keep their obligations included: the others are excluded with the recorded figures in the rationale. A change of figures proposes the resulting state changes, and a state's obligations are added or excluded only when the owner accepts that change with a reason (audited with the figures revision). A newly enacted or amended state law arrives as a shipped library revision (revision 4 carries Connecticut's SB 1295 threshold change): it changes nothing until the owner accepts the library revision, and then proposes the state change for the same owner review. The self-attestation is a program document whose officer's statement is the owner's to write. **CMMC Level 2:** the SPRS worksheet is 110 less the DoD Assessment Methodology v1.2.1 weight of every included requirement not implemented, where implemented means mapped, proof current, no failing or unknown test and no missing policy (a plan of action never substitutes; 3.12.4 is unscored but blocks a valid score; MFA for remote and privileged users only, and encryption that is not FIPS-validated, each deduct 3). **ISO/IEC 27701:** the 2025 standalone edition (clauses 4 to 10, Table A.1 controller, Table A.2 processor and Table A.3 shared controls) is the current edition and the 2019 extension maps through its 2025 successors, so moving a program from 2019 to 2025 is a reviewable edition change whose exclusions carry to their successors; the controller and processor controls are separately applicable by the roles chosen for the program, and any requirement can be excluded with a rationale. NIST SP 800-53, FedRAMP and NIST SP 800-171 requirements map to library controls by control family (with requirement-level exceptions), and readiness reflects those shared controls. The required records of the privacy programs are program documents (consumer-rights requests, privacy-notice and opt-out evidence, data protection assessments, Article 30 records of processing, DPIA and data-subject request records, PIMS processing records), and the government, AI and sector programs keep a system security plan and plan of action (CMMC, NIST SP 800-53), an AI system register and impact assessment records (ISO/IEC 42001, NIST AI RMF), a statement of applicability, profile or readiness summary whose implementation column is derived from live proof and tests, all with immutable revisions, named approval, exports and custody-archive parity. Program figures live in the program's own revision snapshots. PORTABLE-001, AUDIT-001 and TRUST-001 inherit the extended programs and their documents.

**Acceptance.**
1. For each named extended program, create it on a business that already runs SOC 2 through program setup, review applicability, and open readiness.
2. Readiness reports zero requirements without a mapped control, shows the evidence reused from SOC 2, and names the external assessment dependency.
3. Exclude one requirement with a rationale: it stays visible as excluded.
4. Export the program.
5. For CMMC Level 2, readiness also shows the computed SPRS score, and changing one control's state changes the score.
6. For USDP, enter business figures that meet California's and Texas's thresholds but not Montana's: readiness shows California and Texas obligations, Montana stays visible as excluded with the recorded figures, and raising the figures above Montana's threshold adds its obligations as a reviewable applicability change; the self-attestation exports with the applicable states listed.
7. For ISO/IEC 27701, readiness shows the reuse from ISO 27001 and keeps controller and processor controls separately applicable.

#### LIBRARY-001 — Shipped control library, test catalog and cadence

*Tier:* Core

**Requirement.** Evidence ships a versioned common control library pre-mapped to every requirement of each core program: the SOC 2 Trust Services Criteria (2017, revised points of focus 2022) for Security plus the optional Availability, Confidentiality, Processing Integrity and Privacy categories; ISO 27001:2022 clauses 4–10 and Annex A; the HIPAA Security Rule and the Breach Notification Rule; and PCI DSS v4.0.1. Each shipped control carries at least one automated test or a named evidence requirement, plus linked policy templates (POLICY-001). Each named cloud, identity, code, HRIS and device connector ships a published test catalog covering every evidence class its clause lists:
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

A platform that does not expose an evidence class lists it in its catalog as unsupported, together with the manual evidence requirement that replaces it; an unsupported class never counts as passing.

Every connector that exists today (AWS, Google Cloud and Azure under CLOUD-001; Okta, Google Workspace, Entra ID and JumpCloud under IDENTITY-001; GitHub under CODE-001 and CONNECT-001) ships its catalog and is enumerated by the build-time check. Each later clause that adds a connector ships its catalog, per-provider remediation steps (with a Terraform snippet or a stated absence of a Terraform provider) and build-time check entries before it ships: CLOUD-002 (hosting, edge and managed data, including the Vercel deployment-protection test), APPS-001 (app accounts), VULN-001 (vulnerability), ISSUES-001 (security issues and incidents), MONITOR-001 (monitoring and alerting), HRIS-001 (HRIS) and DEVICE-001 (device).

Each catalog entry states the criteria, evaluated resource type, mapped controls and cadence, plus remediation steps for every provider it runs against: the console steps, the equivalent CLI or API call and, for cloud and hosting configuration tests on a platform with a Terraform provider, a Terraform snippet that sets the passing configuration. A platform without a Terraform provider has its entry say so. A test's Results page shows these steps in a How to remediate panel for the provider of each failing resource, and the guidance on its REMEDY-001 obligation is drawn from them, pinned to the library revision. Scheduled configuration tests run at least once per hour per connected account, and population and period tests at least daily. Each catalog entry and the readiness view show the last-run time, and a missed run appears as a stale interval, never as a carried-forward pass. Library updates arrive as reviewable revisions and never retroactively change results.

Library revisions work as follows. Every installation starts at shipped library revision 1. Each later shipped revision is a change set of control-to-requirement mappings, listed under Control library (`/app/library`, `/api/library`) with the programs on this installation it would affect. Program mappings, readiness, the control page and newly adopted controls follow the installation's accepted revision until the owner accepts a later one with a reason (audited as `library.revision-accepted`). Accepting revision N applies every change set up to N; an accepted revision is never rolled back. Every test run records the library revision in force when it ran; that record is append-only, travels in archives, and is never rewritten by a later acceptance. Runs in archives that predate library revisions restore as revision 1, the only revision shipped then. Shipped revisions carry control-to-requirement mapping changes, for PROGRAM-003 SAQ source-revision and assessed-requirement-id scope changes, and for PROGRAM-004 US Data Privacy state-law changes (a changed threshold, shown on USDP programs for owner review once the revision is accepted). SAQ changes name the affected programs for owner review and use the same audited acceptance; accepting one flags affected approved worksheets through their source-revision facts. A revision that changes catalogue criteria or remediation steps must carry them in its change set before it ships. An obligation's How to remediate panel names the library revision of the item's latest observation.

Acceptance runs against fakes built from each provider's documented API at the network edge, as CLOUD-001 does. Applying the Terraform snippet in a live sandbox account is labelled in the Gap.

**Acceptance.**
1. Create each core program on a fresh installation: readiness reports zero unmapped requirements, and every mapped control shows a test or an evidence requirement.
2. A build-time catalog check enumerates every program requirement and every listed connector evidence class, and fails on any requirement with no control, any control with neither test nor evidence requirement, or any evidence class with neither a shipped test nor an explicit unsupported entry naming its replacement evidence requirement.
3. The same check fails on any test entry with no remediation steps for a provider it runs against, and on any cloud or hosting configuration test with neither a Terraform snippet nor a stated absence of a Terraform provider.
4. Fail an AWS S3 public-access test and a Vercel deployment-protection test: each Results page shows the How to remediate panel for its own provider, the AWS entry includes a Terraform snippet, and applying that snippet in the sandbox makes the next run pass.
5. Connect one cloud account and leave it for two hours: at least two runs per configuration test appear.
6. Pause the scheduler for an hour: that interval shows as stale.
7. Accept a library revision: earlier observations keep the revision they were evaluated under.
8. Run SOC 2, ISO 27001 and HIPAA programs on one installation and let one connected test mapped to a shared library control (for example an MFA test on the logical-access control) pass once: each program's readiness shows every requirement mapped to that control as passing from that single observation, with one observation and no copied evidence in the store. Fail the same test: all three programs show those requirements failing from the same observation.

#### PROGRAM-002 — Reusable mappings and accountable ownership

*Tier:* Core

**Requirement.** One versioned control can satisfy explicitly mapped requirements in several frameworks without duplicating evidence. Every mapping states the implementation, test, evidence requirements, scope and accountable human, with delegated contributors and due dates. Scope changes, accepted exceptions and mapping changes retain actor, reason and effective period; no scope reduction silently improves a historical result.

**Acceptance.**
1. In the program UI map an access-review control to SOC 2, ISO 27001 and HIPAA, assign an owner and contributor, attach period evidence once, and inspect all three mappings.
2. Remove an asset from scope with a reason: earlier denominators and the changed-definition label remain in the audit-period report.

#### CONTROL-001 — Custom controls and testing intent

*Tier:* Core

**Requirement.** Owners create and revise custom controls, framework requirements, evidence requirements, cadence (the GAP-001 calendar periods and the semi-annual, annual and anchored periods of CADENCE-001), applicability, test intent and evaluation criteria alongside shipped templates. Revisions take effect prospectively; prior observations retain the exact revision evaluated. Custom mappings are first-class and exportable.

A custom framework, such as a customer security addendum or an internal framework, can also be imported from a CSV or XLSX file through a reviewed import. Owners map columns for requirement ID, title, description, section and an optional mapping to library control IDs. A dry run shows what will be admitted, and row-level validation refuses invalid rows (a duplicate requirement ID, a missing title or an unknown control ID) without admitting them. The confirmed import becomes a revision of that custom framework, labeled with the file, importer and time, and the original file is kept as an exhibit. Imported requirements without a mapping stay visible as unmapped in readiness; AGENT-006 may propose mappings, which an owner approves one by one. Re-importing a revised file shows added, changed and removed requirements for review before anything changes. A removed requirement keeps its history and earlier observations, and is never deleted.

CONTROL-001 is complete for today's owner-created definitions, mappings and reviewed imports. AGENT-006 inherits the individual mapping-proposal decisions before its agent interpretation capability ships: approve two proposed mappings and reject one, with only the two approved exact revisions becoming mappings. CONTROL-001 does not claim an agent proposal exists today. A control's applicability, test intent and evaluation criteria are owner-written definition text; automated tests retain their own versioned structured criteria. Every new run captures both the control/evidence definition and its actual evaluated test criteria. Prior runs without a captured control definition are labeled unavailable, never reconstructed. Requirement and control edits apply from server UTC time; schedule revisions retain CADENCE-001's anchors. Import confirmation explicitly excludes the displayed invalid rows and admits only valid rows; unchanged, added, changed and removed comparisons use stable requirement IDs and exact normalized field/mapping values.

**Acceptance.**
1. Create a custom production-access control through the control form, add two evidence requirements and a custom framework mapping, revise its test intent after a failed observation, then view both revisions in the historical report.
2. The earlier failure keeps its original meaning.
3. Import an 80-row XLSX customer security addendum through the framework import: the dry run refuses one duplicate requirement ID and one unknown control ID and admits nothing until confirmed.
4. Confirm: 78 requirements appear, those mapped in the file show their controls, and readiness counts the rest as unmapped.
5. Before AGENT-006 ships its mapping proposals, approve two and reject one: only the two approved exact revisions become mappings.
6. Re-import a revised file with three changed rows and one removed: the review lists exactly those four changes, and after confirmation the removed requirement remains in history with its earlier observations.

#### READINESS-001 — Readiness, trend and executive reports

*Tier:* Core

**Requirement.** The readiness view separates recorded proof completeness, automated test effectiveness, policy/personnel completion, risks, exceptions and auditor decisions. Filter by framework, product, owner, period and severity; drill from each total to its denominator and source. Board/auditor exports include scope, open obligations, overdue work, per-item SLA status (REMEDY-002), collection freshness, test last-run times and trend history. Missing, stale, unsupported and untested work remains visible; any score explains its calculation and does not label a business certified. Each program shows one readiness percentage: the share of its in-scope requirements that are ready (mapped, proof current, every mapped test passing and every required policy approved and current), shown with the counts it was computed from and the program's checklist areas (policies, access reviews, vendor risk, trust center and the others the program uses), each with its own count. Unknown, stale and untested requirements count as not ready, so 100% means every in-scope requirement is ready today, never that the business is certified.

READINESS-001 is complete for every capability that exists today. Before shipping, AUDIT-003 adds auditor-decision flags and their source/comment drilldown; TRUST-001 adds trust publication/access checklist records; ANSWER-001 and ANSWER-003 add questionnaire and assignment checklist records; AUDIT-001 adds engagement/request counts. These unavailable areas show 0 recorded, never complete, until their own clauses implement them.

The percentage is floor(100 × ready / included), with no percentage for an empty scope. Every mapped control needs current proof and fresh passing observations for every enabled mapped test at its current revision; unknown, stale, untested and unsupported work is not ready, and an exception never grants a pass. A test observation becomes stale after 1.5 times its cadence; a source read becomes stale after 1.5 times its test cadence plus one hour. Policies must be approved, published and within their review deadline. Checklist counts use mapped in-scope requirement references (policy counts use requirements calling for policies). Framework and product select whole programs by exact recorded membership, since current program scope has no finer product assignment; owner, test severity and category filter requirement details, and opened-from/to are inclusive UTC remediation bounds. Detail filters never change the whole-program score. The first successful scheduler snapshot of each UTC day retains exact scope, requirement/source denominators, owners, tests, policies, personnel completion, risks, exceptions and remediation; current/prior audit periods use their last recorded snapshot and inclusive, equally long UTC date windows. Older totals-only snapshots have no reconstructed denominator; absent snapshots remain unavailable. Installation-wide risk and personnel records are labeled separately from program-specific test and requirement counts.

**Acceptance.**
1. From readiness, compare current and prior audit periods with a stale connector, failed test, accepted exception and missing policy attestation.
2. Follow every displayed total to records, export the report, and reconcile counts and period boundaries.
3. A filtered or failed read cannot create a passing result.
4. On a SOC 2 Type II program with 50 in-scope requirements, 47 of them ready: readiness shows 94% with "47 of 50 requirements ready" and its calculation, and the checklist lists policies, access reviews, vendor risk and trust center with their own counts.
5. Let one passing test's collector go stale: the percentage drops to 92%.
6. Make the remaining three requirements ready: it shows 100%, and no page or export uses the word certified.

### Evidence provenance and continuous observation

#### CADENCE-001 — Annual, semi-annual and anchored evidence renewal

*Tier:* Core

**Requirement.** Evidence requirements, policy and vendor reviews, training campaigns and access-review campaigns can recur semi-annually or annually, in addition to the four GAP-001 calendar periods. Typical annual and semi-annual evidence includes the penetration test, BCP/DR test, incident-response tabletop, risk assessment, board or management security review, vendor reassessment and semi-annual access reviews of low-risk systems. Each such requirement chooses one anchor:
- **Effective date (default):** the next due date is the exhibit's effective date plus the period. The effective date is an owner-asserted receipt fact (for example the pentest report date), recorded separately from the server upload time, so uploading an eight-month-old report leaves four months of coverage, not twelve.
- **Fiscal year:** periods start on an owner-set fiscal-year start month.
- **Audit window:** periods align to the program's audit period start (PROGRAM-001).
- **One-off custom renewal date:** overrides the next due date for the current cycle only, with actor and reason recorded; later cycles return to the anchor.

The covered → due soon → overdue states and their precedence (unavailable bytes, superseded-only, missing) follow the GAP-001 rules. Due soon begins at an owner-set reminder lead (default: the final 20% of the period, as for the other periods), and FOLLOWUP-001 sends deduplicated reminders to the requirement owner at the lead and at the deadline. Imported material still cannot establish current proof. Changing a requirement's period or anchor takes effect prospectively, and historical periods keep the definition they were evaluated under. The daily, weekly, monthly and quarterly logic is unchanged.

**Acceptance.**
1. Create an annual penetration-test requirement and upload today a report whose effective date is eight months ago: the requirement shows covered with a due date four months out (effective date plus twelve months), not twelve.
2. Advance the test-harness clock: it moves covered → due soon (one reminder sent and not repeated on restart) → overdue at the deadline, with a deadline reminder.
3. Create a semi-annual access-review requirement anchored to an audit window that starts 1 February: periods run February–July and August–January.
4. Anchor an annual risk assessment to a July fiscal year.
5. Set a one-off custom renewal date on the pentest requirement: it moves the current deadline only, and the next cycle returns to the effective-date anchor.
6. Upload an imported annual report: it stays imported and does not establish current proof.
7. Reopen a historical quarterly period and an annual period from before a period change: each keeps its original state.

#### CONNECT-001 — Least-privilege integration custody and custom collectors

*Tier:* Core

**Requirement.** The Connections UI exposes exact scopes, account/tenant binding, covered and unsupported resources, latest successful read and reconnect instructions. Read-only OAuth/provider apps or scoped role grants are the collection default. Secrets are encrypted under installation-local custody, redacted from UI/logs/archives and rotated or revoked without resurrecting old authority. Buyers can install a reviewed custom read-only connector or private-network collector for on-premises systems using the same observation protocol, or push source-reported resources and evidence through the public API (API-001). Provider registration, permissions review and deployment are engineering deliverables, not manual-upload substitutes. The installable private-network door is the fixed read-only Git collector (`docs/PRIVATE-COLLECTOR.md`): an owner reviews and registers its exact profile, it reports only repository label, branch/head counts, commit ID/time and bare state, and its receiving credential is retained as SHA-256 only, displayed once, connection-bound, rotatable and revocable. Only successful reads become source-observed; unsupported hosted policies stay unknown with manual evidence required, unreadable sources retain their denominator as unknown, and restored collectors remain inactive until fresh owner authorization. Source read timestamps must be within one hour, with at most five minutes of clock skew; repeated/older reads are refused. Existing observation cadence makes reads older than 1.5 times the test cadence plus one hour unknown; failures do not refresh a pass.

**Acceptance.**
1. Authorize, rotate, revoke and reconnect a provider through Connections; attempt cross-tenant use and export/restore.
2. Validate that secrets never appear and restored connectors remain inactive.
3. Install one owner-reviewed private collector, inspect unsupported resources and a lost connection, and reconcile its read-only output with the actual private source.
4. `tests/private-collector.mjs` runs the installed CLI against an actual private local Git repository and exercises registration, scoped receiving credentials, loss/recovery, staleness, rotation/revocation and inactive archive restore.
5. `tests/github.mjs` covers native provider credential custody, and the CONNECT-001 browser journey covers owner review, installation, failure/recovery and revocation at 1440 and 390.

#### API-001 — Public REST API for pushed resources, custom tests and program state

*Tier:* Core

**Requirement.** A versioned, documented public REST API (OpenAPI 3.1 specification published with each release) uses scoped, expiring, revocable API tokens bound to one installation and named scopes. Tokens can be read-only, resource-push or evidence-push; a token never approves or publishes. Its operations are:
- **Push resources.** Idempotent upsert by caller-supplied `uniqueId` within a declared custom resource type and schema (`PUT /v1/resources/{type}`), with deletion and full-sync semantics that mark absent resources as removed rather than silently dropping them.
- **Push evidence documents.** Attach evidence to a requirement.
- **Define and run custom tests.** Custom tests over pushed or connected resources declare criteria, mapped controls and cadence, and produce TEST-001 observations.
- **Read state.** Read programs, controls, requirements, test results, remediation obligations, policies, people and vendors, with cursor pagination and changed-since filters.

The API resource identity remains (`type`, `uniqueId`) across token replacement; provider-observed resources are instead qualified by their connection. Every pushed record is labeled source-reported through the named token and its owner, distinct from source-observed collection and from manual assertions. A test result over pushed data says so. Rate limits return explicit 429 responses with a retry time. Every call is audited under LOG-001. Breaking changes require a new version, and a deprecated version keeps working for at least 12 months.

**Acceptance.**
1. Issue a resource-push token in Settings → API.
2. With a script, push 50 resources of a custom `internal_service` type, then push the same payload again: there are no duplicates and the update timestamps are unchanged.
3. Run a full sync that omits one resource: it is marked removed, and its history remains.
4. Define a custom test requiring `mfa_enforced=true`.
5. One resource fails, and the readiness view shows the result labeled source-reported via the token.
6. Read the program, test and remediation state through the API and reconcile it with the UI.
7. A token from another installation, a write outside the token's scopes and a revoked token are each refused with no partial write.
8. A schema-invalid payload is rejected per item with reasons.

#### CLOUD-001 — AWS, Google Cloud and Microsoft Azure

*Tier:* Core

**Requirement.** Native AWS, Google Cloud (GCP) and Microsoft Azure connections inventory in-scope accounts/projects/subscriptions and collect IAM/MFA, public storage, encryption, logging, backup and network-configuration evidence. Scheduled tests from the published CLOUD catalog (LIBRARY-001), at least hourly, expose exact resources and applicable exclusions, including organizational child accounts; an inaccessible account cannot disappear from the denominator.

**Acceptance.**
1. For each provider, connect an authorized sandbox through Connections, discover a child account/project/subscription, and run every catalog test, covering IAM/MFA, public storage, encryption, logging, backup and network classes, with at least one failing resource.
2. Change a setting in the real provider, re-test, and revoke one read permission.
3. The failing resource, missing coverage, original observations and recovery are individually visible.

#### CLOUD-002 — Heroku, Vercel, DigitalOcean, Cloudflare, Netlify, Supabase, MongoDB Atlas and Snowflake

*Tier:* Core

**Requirement.** Native read-only connections to the hosting, edge and managed-data platforms that small SaaS companies run production on inventory their teams, projects, apps, zones, clusters, databases and warehouses. Each platform ships a published LIBRARY-001 catalog, run at the CLOUD-001 cadence, for the evidence classes it exposes:
- **Heroku:** team members and MFA/SSO enforcement; Heroku Postgres continuous protection, rollback and backup schedules; Private Spaces and trusted IP ranges; automated certificate management and HTTPS; audit trail.
- **Vercel:** team members and SAML enforcement; deployment protection on preview and production; audit log; HTTPS and certificate state; public exposure of preview deployments.
- **DigitalOcean:** team members and two-factor enforcement; Droplet backups; managed-database backups and trusted sources; cloud firewalls; Spaces bucket ACLs and public objects.
- **Cloudflare:** account members and two-factor enforcement; SSL/TLS mode, minimum TLS version and Always Use HTTPS per zone; WAF and managed rules; audit logs.
- **Netlify:** team members and SAML enforcement; deploy-preview password or SSO protection; HTTPS; audit log.
- **Supabase:** organization members and MFA enforcement; point-in-time recovery and backups; row-level security on exposed tables; network restrictions; SSL enforcement.
- **MongoDB Atlas:** organization and project users and MFA; IP access list (including an open 0.0.0.0/0 entry); encryption at rest with customer keys where configured; cloud backup and snapshots; database auditing.
- **Snowflake:** users with MFA or key-pair authentication; network policies; Time Travel and fail-safe retention; access history and login history; account-level encryption settings.

An evidence class a platform does not expose is listed as unsupported in its catalog, with the manual evidence requirement that replaces it, and never counts as passing. As in CLOUD-001, an inaccessible team, project or account cannot disappear from the denominator.


Before shipping a new source/provider, inherit INVENTORY-001: connection-qualified source identity, every retained source row, reviewed canonical grouping without destructive People merges or automatic email/serial matching, per-source ownership/criticality/scope/lifecycle, honest unknown/unmatched states and reconciled scope export. Ownership grants no auth; inventory exclusion never removes test subjects without the separate explicit test-scope decision. Assert these obligations through this source’s public doors.

**Acceptance.**
1. For each of the eight platforms, connect an authorized sandbox through Connections and run every catalog test with at least one deliberately failing resource.
2. Examples: a Heroku Postgres database without continuous protection, an unprotected Vercel preview, a DigitalOcean Space with a public object, a Cloudflare zone with minimum TLS 1.0, an unprotected Netlify deploy preview, a Supabase table without row-level security, an Atlas IP access list open to 0.0.0.0/0, and a Snowflake user without MFA.
3. Fix each in the real platform and observe a pass, with both observations retained.
4. Revoke one read permission per platform: the affected resources show missing coverage and stay in the denominator.
5. The catalog lists each unsupported class with its manual requirement, and the LIBRARY-001 build-time check fails if any class has neither a test nor that entry.

#### CODE-001 — GitHub, GitLab, Bitbucket Cloud and Azure DevOps change assurance

*Tier:* Core

**Requirement.** GitHub and GitLab provider apps, a Bitbucket Cloud app (repositories, branch restrictions, merge checks and required approvals, Bitbucket Pipelines deployments) and an Azure DevOps (Azure Repos and Pipelines) connection collect repository inventory and privacy, branch protection, required reviews/checks, merge and deployment history, membership and MFA/two-step enforcement, departed members, dependency manifests and vulnerability evidence. Dependency and secret-scanning alerts feed VULN-001, and dependency manifests feed AI-001's AI SDK discovery. Scope includes private repositories explicitly granted by the owner. Audit-period evidence links a production change to its review/check outcome and source revision; missing event history is unknown.


Before shipping a new source/provider, inherit INVENTORY-001: connection-qualified source identity, every retained source row, reviewed canonical grouping without destructive People merges or automatic email/serial matching, per-source ownership/criticality/scope/lifecycle, honest unknown/unmatched states and reconciled scope export. Ownership grants no auth; inventory exclusion never removes test subjects without the separate explicit test-scope decision. Assert these obligations through this source’s public doors.

**Acceptance.**
1. Connect each of GitHub, GitLab, Bitbucket Cloud and Azure DevOps, select two repositories and run branch-protection/branch-policy, reviewed-change, membership-MFA and repository-privacy tests.
2. Merge an authorized reviewed change (through a Bitbucket Pipelines deployment for Bitbucket), remove protection on one repository, make one repository public and revoke access to the other.
3. Inspect source links, event period coverage, failure and unknown states without exposing repository secrets.
4. **Current GitHub slice (22 October 2026):** Owner-selected repositories retain merged pull requests with their head and merge revisions, all returned approval/rejection/dismissal events with the review's own commit and timestamp, check runs and commit statuses on the exact head revision, and deployments with source outcome and time.
5. A deployment links to a change only on the exact merge revision and when it occurred after that merge.
6. Current check results never establish their historical state at merge; unmatched deployments, missing history, unavailable classes and empty histories remain explicitly unknown.
7. The bounded reader admits at most 20 merged changes and 20 deployments per repository, 50,000 bytes of retained history per repository and 80,000 across a connection; an excess is a named gap, never clean assurance.
8. Source paging uses COLLECTION-001's authority-bound durable journal. Original history stays with the collection/control/audit-period snapshot and survives custody restore without reactivating authority. Only consumed metadata is retained, excluding PR bodies, check output, deployment payloads and arbitrary provider fields. GitHub memberships, administrator membership and the authorized two-factor-disabled list feed Identities and Inventory; organization enforcement is a separate fact from individual enrollment. A login never creates or matches a person. Owner-approved People matches establish departure comparisons; any unmatched membership keeps that coverage unknown. A denied membership read retains known accounts as unread, while a fresh source removal retains its prior versions. The GitHub-generated SPDX 2.3 dependency export feeds package inventory, including AI SDK names for AI-001; its unknown manifest revision, absent original manifest files and historical completeness remain labeled. Package presence is not AI-tool approval. Dependency, secret-scanning and membership reads remain read-only. No live-provider verification is claimed. **Current GitLab and Bitbucket slices (22 October 2026):** GitLab binds the authorized group’s immutable id; a replacement group cannot inherit the old authority. Selected projects collect private/internal/public visibility, protected default branches, applicable approval-rule minimums, required successful non-skipped pipelines, merged requests, current approvers, detailed exact-head pipelines, deployments and package metadata. The required-review number is the maximum applicable rule minimum, a lower bound rather than a sum of overlapping rules. Current approvers do not establish a reviewed commit or approval time. A deployment status without a source update time stays current-only; its creation time is never substituted. Inherited membership is reviewably matched to People and compared with departures; individual MFA enrollment and last sign-in stay unknown, separately from group enforcement. Unsupported licensed vulnerability/secret classes retain their manual replacements. Bitbucket binds the immutable workspace id, keeps each selected repository’s privacy and branch restrictions, and counts approval/build requirements only when merge checks are enforced. A branching-model matcher the reader cannot resolve is an explicit gap. Merge time comes from the unique MERGED activity event, never a later pull-request update; source precision and offsets are retained, and sub-millisecond ordering cannot invent a deployment-after-merge link. Approval activity has an unknown reviewed revision. Commit statuses use the exact source head. Pipelines deployments retain exact release revisions, actual pipeline readback and its separate outcome (including contradictions), and owner-reviewed production-environment mappings. Classification needs the latest exact source snapshot and a reason, applies prospectively, and never rewrites an old report. Workspace memberships retain unknown active/MFA state; explicit People matches govern departure comparisons. A parsed package.json feeds SDK inventory at its exact source revision, without scripts or arbitrary fields; other formats and original bytes beyond the separate manual root-path custody door remain unproved. Both providers inherit COLLECTION-001 schedules, source-event permissions, durable cursors, original failed outcomes, audit-period context and inactive restore, and INVENTORY-001’s retained source rows and owner decisions. **Original-manifest custody default adopted (23 October 2026; ct approval pending):** A separate owner-only, per-connection, credential-bound audited grant explicitly acknowledges retaining private originals and including them in owner-requested custody exports. Denied by default; rotation, revocation and restore cannot carry authority forward. The manual owner API reads the four named root paths at a once-resolved immutable commit in each of 1–20 selected repositories, with GET-only fixed-origin reads and no followed source URL. Each nonempty UTF-8 original (at most 128 KiB) retains exact bytes, SHA-256, size, repository, commit, path, source link, read time and its consent decision. Recognized credential markers, source-credential reflections, invalid encoding and mismatching source hashes refuse admission; the filter is not comprehensive secret detection. Every request rechecks authority and commit admission checks it atomically. Absent files and unreadable/unsafe/bounded reads remain explicit; no original creates a passing test or AI approval. Downloads are private owner-only inert attachments and byte-checked. Retained originals and ordered grants survive custody restore while source and write authority remain inactive. AUTH-001, SECURE-001 and ERASE-001 inherit delegated authority, encryption/retention, export and authorized erasure obligations. See `docs/CODE-MANIFESTS.md`. There is no dedicated screen, recursive traversal or scheduled original capture; other formats remain unproved. This privacy/custody default needs ct approval, so CODE-001 stays PARTIAL. **Current source-finding slice (c31):** GitHub dependency and secret-scanning alert metadata feed the owner Vulnerabilities source-finding list, `/api/vulnerabilities/source-findings` and Inventory as connection-qualified `code.finding` records. Filtered alert counts and detailed feed counts are separate source answers; disagreement retains both counts and makes the catalogue result unknown. Each class validates the official source identity, state and timestamps before any durable checkpoint; dependency records retain severity, package, ecosystem, CVE and GHSA metadata. Literal secrets, locations, advisory prose and resolution comments are excluded. Reads are bounded to 500 findings per class/repository and 1,000 per connection, with an explicit gap on excess. Earlier source versions remain; an unreadable, malformed or no-longer-returned alert stays unknown rather than being removed or verified closed. Failed, unfinished, revoked, restored or stale source coverage is unknown in the source list. Fixed, dismissed and resolved are provider statements only; the manual penetration-test retest/closure path is unchanged. VULN-001 inherits this source register for its future triage, SLA and independent retest lifecycle. Other providers’ normalized finding feeds remain unbuilt. **Current Azure DevOps slice (22 October 2026):** Owner-selected Azure Repos use immutable project and repository ids, with a separately bound organization address and human-readable labels. Privacy, enabled blocking policies scoped to the selected default branch, required reviewer lower bounds and required build/status checks are collected. The creator vote is excluded from the reviewer lower bound when the policy allows it. Completed changes retain head and merge revisions; current reviewer votes never invent an approval time or reviewed commit. Exact-head statuses remain distinct from historical merge assurance. A classic Pipelines deployment links only after its release artifact and actual build both identify the selected repository and exact merge revision; deployment and build outcomes stay separate. Unavailable completion times and unmatched production changes are unknown. Production classification requires the latest observed environment snapshot, owner review and a reason, applies prospectively and never rewrites older history. Graph subjects require explicit People matches; unexposed activity, administrator and MFA facts remain unknown. A package.json read at an exact commit feeds package/SDK inventory without scripts or arbitrary fields. Selected reads, paging, events, failures, context, period reports, inventory and inactive custody restore use the same current-door obligations as the other code providers. No live-provider verification is claimed. **Bitbucket grant exception approved with riders (ct, 22 October 2026 23:45Z):** Bitbucket requires `repository:admin` (or `admin:repository:bitbucket`) even for a GET of branch restrictions. Its write-capable scope is a named exception to CONNECT-001's read-only default, permitted only for restriction reads; prefer a read-only scope as soon as Bitbucket offers one. The connection screen discloses the write-capable scope. Connections are denied until the owner explicitly acknowledges that write-capable provider scope and records a reason in the audit; rotation renews that consent. The credential is sealed, bound to its workspace, used only for GET requests to the fixed Bitbucket API origin, never followed across authenticated redirects, destroyed on revocation and inactive after restore. No provider write is implemented or claimed. AUTH-001, SECURE-001 and future Bitbucket capabilities inherit the separate consent, audit and no-replay obligations. Acceptance includes GET-only calls with any non-GET call refused, and an audited owner consent reason before credential use and again on rotation. These are mapped by the Bitbucket authority journey in the Status Evidence cell. CODE-001 remains PARTIAL until its remaining acceptance is proved. Bitbucket gaps: manifest paths/formats beyond the four manual root paths, normalized vulnerability/secret findings, unknown reviewed approval revisions and membership/MFA attributes. GitLab gaps: manifest paths/formats beyond the four manual root paths, normalized vulnerability/secret findings, historical approval revisions/times and individual MFA/last-sign-in attributes. Azure DevOps gaps: manifest paths/formats beyond the four manual root paths, normalized vulnerability/secret findings, historical reviewer revisions/times and unexposed Graph activity/admin/MFA attributes. All retain the named live-account Gap.

#### IDENTITY-001 — Google Workspace, Microsoft 365, Entra ID, Okta and JumpCloud

*Tier:* Core

**Requirement.** Google Workspace, Microsoft 365 / Entra ID, Okta and JumpCloud directory connections collect user/group, privileged-role, MFA, lifecycle and sign-in evidence for compliance checks and access reviews. Reconcile identities across sources using reviewable matches; suspended accounts, service identities, guests and contractors remain explicit populations. Accounts held directly in SaaS apps, outside the IdP, come from APPS-001.

**Acceptance.**
1. For each named identity service connect a tenant via Connections, ingest an admin, employee, guest and service account, and test MFA and inactive-user access.
2. Disable one real account and deny one scope.
3. Reconcile duplicates with a human decision and inspect fresh source readback and incomplete coverage.

#### APPS-001 — App-level account connectors for access reviews and leaver checks

*Tier:* Core

**Requirement.** Read-only connectors pull accounts directly from the SaaS apps themselves, not only from the IdP, because local accounts created outside SSO, in-app admin roles and app-level MFA are what quarterly reviews and leaver checks catch. The named apps are Slack, Salesforce, Atlassian (Jira and Confluence Cloud), Zoom, Notion, HubSpot, Zendesk, 1Password, Datadog and PagerDuty. Each connector collects every account with its app identifier and email, its account type (owner, admin, member, guest, or service/bot), app roles and privileges, status (active, suspended or deactivated), sign-in method (SSO or local password) and, where the app exposes them, app-level MFA state and last activity. An attribute an app does not expose shows as "not exposed", never as passing. Each app's accounts feed four places:
- **Inventory (INVENTORY-001):** account, role and MFA facts, matched to people through reviewable matches; unmatched accounts stay visible.
- **Access reviews (ACCESS-001):** the app's frozen population, with no upload.
- **Leaver verification (LIFECYCLE-001):** every connected app where the leaver holds an account is a monitored account on the checklist, closed only by a source readback showing it deactivated or removed. Apps without a connector appear as manual check-offs that close only with an attached exhibit or a re-uploaded account list (POPULATION-001), labeled manual.
- **Tests (LIBRARY-001 app-account catalog):** a departed person still has an active account, an admin without MFA, a local login bypassing required SSO, a guest with a privileged role, and an account inactive beyond the owner-set window.

Connectors never deactivate accounts. Revocation happens in the app, or through AGENT-003's separately approved writer.


Before shipping a new source/provider, inherit INVENTORY-001: connection-qualified source identity, every retained source row, reviewed canonical grouping without destructive People merges or automatic email/serial matching, per-source ownership/criticality/scope/lifecycle, honest unknown/unmatched states and reconciled scope export. Ownership grants no auth; inventory exclusion never removes test subjects without the separate explicit test-scope decision. Assert these obligations through this source’s public doors.

**Acceptance.**
1. For each of the ten named apps, connect a sandbox workspace through Connections and ingest an admin, a member and a guest.
2. Each appears in Inventory with role, status and MFA state (or "not exposed"), matched to its person.
3. Terminate in a connected HRIS a person who holds an account in every app: the leaver checklist lists each app as a monitored account and stays open, and the departed-user test fails for each app while its account is active.
4. Deactivate the account in each app: the next source readback closes that item, and the checklist closes only when all ten are verified.
5. Add an unconnected app: it appears as a manual check-off and closes only with an attached exhibit.
6. Start a quarterly access review: its frozen population includes each connected app's accounts and roles without any upload.

#### MONITOR-001 — Monitoring and alerting evidence from observability tools

*Tier:* Core

**Requirement.** Read-only connectors collect the production monitoring and alerting configuration that SOC 2 CC7.2, ISO 27001:2022 A.8.16, the HIPAA audit-controls standard and PCI DSS Requirement 10 call for, from the tools teams actually alert from:
- **Datadog:** monitors, downtimes and mutes, notification handles and Cloud SIEM detection rules (under a monitor read scope separate from APPS-001's account read);
- **New Relic:** alert policies, conditions, muting rules and notification destinations;
- **Grafana Cloud:** alert rules, contact points, notification policies and silences;
- **Sentry:** issue and metric alert rules with their actions;
- **PagerDuty:** services, escalation policies and on-call schedules;
- **[Uptime](https://github.com/just-every/run-uptime):** monitors and notification routes, read through the sibling product's API.

AWS CloudWatch alarms, Google Cloud Monitoring alerting policies and Azure Monitor alert rules come through CLOUD-001's logging and monitoring class and feed the same tests.

Each monitor is recorded with its source ID and link, name, query or target, service and environment tags, notification targets, state, mute or silence status with start and end times, and last triggered time. Owners map monitors to in-scope production services in Inventory (INVENTORY-001) by tag rule or explicit selection; the mapping is a reviewable revision. Notification targets resolve to people, on-call schedules or channels, and a target that resolves to a deactivated person or a deleted schedule counts as not routed. The MONITOR tests in the LIBRARY-001 catalog run at least daily, and on-call coverage is evaluated over the coming 14 days. A muted monitor fails after the owner-set window (default 7 days) unless an approved, expiring exception covers it. Connectors never create, change or mute a monitor. An unreadable source makes its tests unknown, never passing.

**Acceptance.**
1. Connect a sandbox for each of the six named sources through Connections and map two production services.
2. Service A has an availability monitor and an error-rate monitor in Datadog routed to a PagerDuty schedule; service B has only an availability monitor in New Relic.
3. The coverage test passes for A and fails for B, naming the missing monitor type.
4. Add a Grafana Cloud error-rate alert for B: the next run passes.
5. Mute A's error-rate monitor and advance the test-harness clock eight days: the mute test fails.
6. Approve a seven-day exception: it passes until the exception expires.
7. Deactivate in the IdP the only person a Sentry alert routes to: the routing test fails for that alert.
8. Leave a six-hour gap in the PagerDuty schedule next week: the on-call test fails, naming the uncovered hours. Map an Uptime monitor to service B: it counts toward B's availability coverage. Revoke the Datadog grant: A's Datadog-backed tests show unknown, not passing, and earlier observations remain.

#### HRIS-001 — BambooHR, Gusto, Rippling, Justworks, Deel HR and ADP Workforce Now personnel sources

*Tier:* Core

**Requirement.** BambooHR, Gusto, Rippling, Justworks, Deel HR and ADP Workforce Now integrations synchronize the employee and contractor roster (W-2 and 1099), manager, department, employment type, start and termination dates as authoritative lifecycle inputs. Buyers review source conflicts rather than merging people silently. Compensation, SSNs and bank data are unnecessary and excluded from the requested scope. Payroll is the separate [Envelope](https://github.com/just-every/run-envelope) sibling seed. An HRIS without a connector uses the labeled CSV roster route (POPULATION-001), never an unlabeled roster.

Before shipping, a leaver this clause imports records its departure through the People departure door, so LIFECYCLE-002 flags, requests and escalates the handover of everything the person holds.


Before shipping a new source/provider, inherit INVENTORY-001: connection-qualified source identity, every retained source row, reviewed canonical grouping without destructive People merges or automatic email/serial matching, per-source ownership/criticality/scope/lifecycle, honest unknown/unmatched states and reconciled scope export. Ownership grants no auth; inventory exclusion never removes test subjects without the separate explicit test-scope decision. Assert these obligations through this source’s public doors.

**Acceptance.**
1. Connect each of the six named HRIS, import a joiner, mover and leaver, then correct a start date and terminate an account in the real source.
2. The People UI shows source priority, conflict review, correct obligations and no collected payroll or tax identifiers.
3. In a Rippling sandbox, terminate a person who still has an active Okta account: on the next HRIS sync the departed-user identity test fails, naming that person, their Okta account and the Rippling termination date, and a REMEDY-001 obligation opens.
4. Deactivate the account in Okta: the next identity read passes, and both observations are retained.

#### DEVICE-001 — MDM and EDR posture: Jamf, Intune, Kandji, JumpCloud, Addigy, NinjaOne, CrowdStrike, SentinelOne and Defender for Endpoint

*Tier:* Core

**Requirement.** The MDM sources Jamf, Microsoft Intune, Kandji (now Iru), JumpCloud, Addigy and NinjaOne supply managed-device inventory, ownership, encryption, screen-lock, OS/patch and management status. The EDR sources CrowdStrike Falcon, SentinelOne Singularity and Microsoft Defender for Endpoint supply agent presence, sensor health and last-seen time, protection or policy mode, and active-threat state per device. Correlation exposes unmanaged or unmatched endpoints, devices with an MDM record but no healthy EDR sensor, and missing collection; compliance tests do not replace MDM or EDR operation.


Before shipping a new source/provider, inherit INVENTORY-001: connection-qualified source identity, every retained source row, reviewed canonical grouping without destructive People merges or automatic email/serial matching, per-source ownership/criticality/scope/lifecycle, honest unknown/unmatched states and reconciled scope export. Ownership grants no auth; inventory exclusion never removes test subjects without the separate explicit test-scope decision. Assert these obligations through this source’s public doors.

**Acceptance.**
1. Connect each of the six MDM sources, match a device to a person, change encryption or patch state in a sandbox and run a fresh test.
2. Connect each of the three EDR sources, and for each put one sensor into an unhealthy or disabled state: the sensor-health test fails for that device, then passes after recovery.
3. A missing device feed, a device with no EDR sensor or an unmatched endpoint stays a gap; the original failed posture and correction remain attributable.
4. In a Jamf sandbox, turn FileVault off on a Mac matched to a person: the disk-encryption test fails on that device within the next hourly run and opens a REMEDY-001 obligation for the device's owner with its REMEDY-002 due date.
5. Turn FileVault back on: the obligation closes only after the passing re-test, and the failing and passing observations both stay on record.

#### DEVICE-002 — Owned read-only device monitor for computers without MDM

*Tier:* Core

**Requirement.** Evidence ships its own signed, read-only device monitor for macOS (13 and later, notarized package), Windows (10 and 11, signed MSI) and Linux (Ubuntu 18.04 and later and Debian 10 and later, signed .deb package), for businesses without an MDM or for devices outside it. Employees install it from their onboarding checklist, and administrators can deploy it silently with an enrollment token. It reports through the same observation protocol and person↔device matching as DEVICE-001 at least every hour while the device is online. It checks:
- full-disk encryption: FileVault, or BitLocker on the system drive;
- an approved password manager installed;
- active antivirus/endpoint protection (XProtect/third-party on macOS, Microsoft Defender or third-party on Windows);
- screen lock after 60 minutes or less of inactivity, with a password required on wake;
- OS version within the owner's supported window.

On Linux it checks full-disk encryption (LUKS/dm-crypt on the root volume), screen lock where a GNOME or KDE session exposes it, and OS version. Checks it cannot read on a Linux device report unknown and open that device's manual evidence requirement; unknown never counts as passing.

The monitor holds no write authority. It does not collect browsing history, file contents, keystrokes or location, and it states exactly what it reads. A device that stops reporting becomes stale after the owner-set window (default 14 days) and then unknown. Uninstalling or tampering is reported when observable. Stale, uninstalled and never-reporting devices are never counted as passing.

**Acceptance.**
1. Install the monitor on a real macOS and a real Windows device through the employee checklist, and confirm each device matches its person.
2. For each of the four required checks, put the device into the failing state (encryption off, no password manager, protection disabled, lock above 60 minutes), observe a failing result within the next reporting interval, fix it and observe a pass, with both observations retained.
3. Disconnect one device past the stale window, then uninstall the monitor from the other: each shows stale or unknown and the device test does not pass.
4. Inspect the declared data list; the payload contains nothing beyond it.
5. Install the .deb on a real Ubuntu device with LUKS and a real Debian device without it: Ubuntu passes encryption and Debian fails it.
6. Set the Ubuntu GNOME lock above 60 minutes and observe a fail, then a pass after fixing it.
7. The checks the Linux monitor cannot read show unknown with the manual requirement open, and neither device passes on them.

#### VULN-001 — Vulnerability findings from scanners, code and cloud-native sources

*Tier:* Core

**Requirement.** Integrations ingest findings from Tenable, Qualys, Snyk, GitHub Dependabot (with GitHub code-scanning and secret-scanning alerts), AWS Inspector (EC2, ECR and Lambda), Google Cloud Artifact Registry (Artifact Analysis) and Security Command Center, Microsoft Defender for Cloud, Semgrep, Aikido and Wiz. Every finding, whatever its source, gets one lifecycle:
- asset linkage (host, image, function, repository or cloud resource) and source severity normalized to critical/high/medium/low, with CVE/CWE where given;
- deduplication across sources that retains every source ID and history;
- first-detected and last-seen times, accepted time-bounded exceptions, and verified resolution only through a fresh source read. Scanner silence or a deleted finding is not proof of remediation.

**SLA due dates are fixed at detection.** Each finding's remediate-by date is its first-detected time plus the vulnerability SLA for its severity in force at that moment (REMEDY-002), and the finding records the SLA policy revision used. A later SLA policy change applies only to findings first detected after the change and never moves an existing due date. An approved exception pauses the clock. A finding that recurs after verified resolution reopens with its original source IDs and history, and the recurrence is recorded. Findings approaching or past their due date alert their owner through FOLLOWUP-001, and per-finding SLA status appears in readiness, the remediation queue and board/auditor exports. Penetration-test findings follow the same lifecycle through VULN-002. Security issues that people raise, such as bug-bounty reports, customer-reported issues and internal findings, come from the team's own tracker through ISSUES-001. Evidence delegates scanning compute to the authorized scanner.

Before shipping, this clause carries REMEDY-002's per-finding SLA policy revision at first detection, fixed original due date, bounded exception clock and source-observed recovery. Readiness, board/auditor exports and the vulnerability-remediation population must reconcile every finding's SLA and elapsed remediation history without rewriting earlier observations. It also adds a connected scanner's fresh read as retest evidence that closes a VULN-002 penetration-test finding awaiting verification.

**Acceptance.**
1. Connect each of the ten named sources via Connections and ingest at least one finding from each.
2. Ingest a Dependabot alert and an AWS Inspector ECR finding for the same CVE on the same service: they deduplicate into one finding retaining both source IDs.
3. Link it to a control and remediation task, accept a time-bounded exception and let it expire.
4. Change the critical-severity SLA from 15 to 7 days: every existing finding keeps its due date, and the next new critical finding gets 7 days.
5. Correct the sandbox issue and perform a fresh source read: only verified resolution closes the compliance obligation, with original findings retained.
6. Reintroduce the issue: the finding reopens with its history.

#### VULN-002 — Penetration-test findings with retest-verified closure

*Tier:* Core

**Requirement.** Owners import penetration-test and other manual assessment findings through a reviewed CSV/XLSX import with column mapping and a dry run. The mapped fields are title, severity, affected asset, description, CVE/CWE, tester, report date and recommended fix, and row-level validation refuses invalid rows without admitting them. The original report (PDF) is kept as an immutable exhibit. Each finding carries manual provenance (tester, report and date), links to the assets it affects, and gets the VULN-001 SLA due date from the report date under the policy then in force. An owner marking a finding fixed leaves it awaiting verification. It closes only on retest evidence: a tester's retest letter or report attached and approved by a named reviewer, or a connected scanner's fresh read showing it resolved. Pentest findings appear in readiness, the AUDIT-002 vulnerability-remediation population and auditor packs, and the annual penetration-test requirement (CADENCE-001) is satisfied by the report.

The import admits every valid row and refuses each invalid one; confirming needs the fingerprints of both dry-run files, and the report must be a PDF. The report is kept as an immutable receipt on the penetration-test requirement of the adopted library control OPS-05, with the report date as its effective date, so an import needs a program that includes OPS-05. A finding's due date is its report date (first detected, UTC) plus the vulnerability SLA for its severity in force at 00:00 UTC on that date, counted in calendar days; a later policy change never moves it. A finding is past due once the UTC date is after its due date, and closed within SLA when it closes on or before its due date. An affected asset links to an inventory resource whose unique id or display name equals it exactly; otherwise it stays as text, labelled not matched. The named reviewer is the signed-in person who approves the retest evidence, recorded by name on the decision; a rejection needs a reason and reopens the finding. Retest letters are kept with their digest and travel in the custody archive (version 8).

VULN-002 is complete for every capability that exists today: the reviewed import, manual provenance, fixed SLA due dates, retest-letter closure, readiness counts, the vulnerability-remediation population export (`/app/vulnerabilities/population.csv`) and the report as the OPS-05 receipt, which review folders already share. Before shipping, VULN-001 adds closure by a connected scanner's fresh read showing the finding resolved; AUDIT-002 draws its vulnerability-remediation population and samples from these findings with their provenance; and AUDIT-001 and AUDIT-003 put the findings, their SLA status and retest decisions in the period's auditor pack.

**Acceptance.**
1. Import a 12-row pentest findings CSV with its PDF report through Vulnerabilities → Import.
2. The dry run refuses one row with a missing severity and admits nothing until confirmed.
3. Confirm: 11 findings appear labeled manual with tester, report date and SLA due dates.
4. Mark one fixed without retest evidence: it stays awaiting verification.
5. Attach a retest letter and have the reviewer approve: it closes, with the original finding and report retained.
6. The AUDIT-002 vulnerability-remediation population lists the pentest findings with their provenance.

#### ISSUES-001 — Security issues and incidents from the team's own trackers

*Tier:* Core

**Requirement.** Evidence reads the security issues and incidents a team already tracks, read-only, so they become source-observed evidence with SLA and incident tests and Type II populations, without CSV exports. Owners configure one or more selectors per source and per task type. Each WORK-001 destination is a source, with these selectors:
- **Jira Cloud,** including Jira Service Management projects: a label (default `security`) or a JQL query;
- **Linear:** a label, optionally limited to teams;
- **GitHub Issues and GitLab Issues:** a label, or an issue search query, across the organizations CODE-001 connects;
- **Azure Boards:** a tag or a WIQL query;
- **Asana, Shortcut, ClickUp and Vector:** a tag or label within chosen projects, workspaces or boards;
- **YouTrack:** a tag or a search query;
- **Freshservice:** a tag, or its native incident ticket type;
- **monday.com:** a status or label column value on chosen boards;
- **Basecamp:** a chosen project and to-do list.

PagerDuty and incident.io are incident sources, selected by service, severity or priority.

Reads use a read scope. Where WORK-001 already holds a write grant to the same tracker, ingestion uses only its read scopes, and an ingestion-only connection never holds write scope. Evidence never writes to a tracker through ISSUES-001.

**Task types.** Each selector feeds one task type:
- **security issue;**
- **incident management:** the incident record itself;
- **incident resolution:** the corrective follow-up, such as root cause, post-incident review and remediation tasks, linked to its incident through tracker links, sub-issues or parent issues;
- **offboarding (optional):** feeds the LIFECYCLE-001 leaver checklist as a tracker-recorded completion, which never replaces an account or device readback;
- **vendor procurement (optional):** opens a review-required VENDOR-001 intake for the vendor named.

Incident management and incident resolution are kept distinct throughout. An issue matching several selectors is recorded once per task type under the same source ID.

**What each record keeps:** source, source ID and link, title, task type, the selector revision it matched, created time, resolved time and every reopened time, assignee and status, and severity. Severity comes from the tracker's priority through an owner-reviewed mapping per source, with a label fallback (for example `sev1`); a source with no priority field uses the selector's default severity. Each record is labeled source-observed from the tracker, with its retrieval time. Evidence stores the title and link, not the issue body or comments. A snapshot of the body and comments is captured as an exhibit only when the record is sampled (AUDIT-002) or an owner attaches one, and the owner can preview what will be captured. On connection, Evidence back-fills matching issues from source history for an owner-chosen lookback that covers at least the current audit period.

**SLA.** A security issue gets its own REMEDY-002 SLA clock in the security-issue category. Its due date is fixed at its tracker creation time from the SLA policy revision then in force, as VULN-001 does, and the issue records the revision used. A later policy change never moves an existing due date. A priority change in the tracker recomputes the due date from the original creation time under the same revision, and the change is recorded. An approved, expiring exception pauses the clock. Closure is the tracker's resolution, recorded as "resolved in tracker" with its time; it is distinct from a verified re-test and is never shown as one. A reopened issue resumes its original clock and keeps every resolution. When a security issue is linked to a failing test or a VULN-001 finding, that obligation still closes only on a verified re-test. Approaching and missed due dates alert, through FOLLOWUP-001, the assignee when matched to a person in Evidence, and otherwise the selector's owner. Security issues appear in readiness, the remediation queue and board and auditor exports as tracker-owned items; no WORK-001 ticket is created for them, because one already exists.

**Incidents.** Incident-management and incident-resolution records feed the AUDIT-002 incidents population, and security issues feed its security-issues population. Each population records every source and selector revision used, retrieval time, completeness and record count. A zero-record population is a non-occurrence only when every configured source was read completely for the whole period. A revoked grant, an unreadable tracker, a truncated or rate-limited read, or a period gap makes the population incomplete, never empty. The incident test reports, per incident in the period, whether it is resolved and whether each linked resolution task was completed within the deadline in the incident response policy revision in force (POLICY-001), showing that revision.

**Tests.** The LIBRARY-001 catalog gains "security issues resolved within SLA", reporting each issue as within SLA, SLA missed, open and overdue, or open within SLA, and "incident tasks completed per policy". Both are shareable into AUDIT-003 like any other test.

**Selector changes.** Changing a label, tag or query creates a reviewable selector revision. Before approval, the owner sees how many records the new revision matches against the current one. A revision applies from its approval and never rewrites earlier populations, observations or SLA results. Records that stop matching keep their history, labeled "no longer selected".

Before shipping, this clause carries REMEDY-002's per-issue SLA policy revision and clock from tracker creation time, preserved original due dates and reopen history, bounded exception pauses and per-item readiness, board/auditor and population SLA/elapsed-time reconciliation. Source closure is resolved in tracker, never a verified operating-test pass.

**Acceptance.**
1. In a Jira Cloud sandbox, label three issues `security` at high priority.
2. Resolve two, one inside and one outside the SLA, and leave the third open past its due date.
3. The "resolved within SLA" test shows one within SLA, one SLA missed and one open and overdue, each with its Jira link and the policy revision used, and the resolved issues read "resolved in tracker", not verified.
4. Reopen the on-time issue: it resumes its original clock and keeps both times.
5. Repeat with a Linear issue and a GitHub issue selected by label, with a GitLab issue selected by label, with an Azure Boards item selected by WIQL, and with a Jira JQL query in place of the label: each is ingested with its link and SLA status.
6. Change the critical SLA: existing due dates stay.
7. Label two Jira issues `incident` inside a Type II period, link a post-incident review task to one, and leave the other's resolution task open past the policy deadline.
8. Generate the AUDIT-002 incidents population: it reconciles to the two issues with retrieval metadata, one can be sampled with its body captured as an exhibit, and "incident tasks completed per policy" passes for one and fails for the other. Trigger a PagerDuty incident on a selected service: it joins the population with its source. Revoke the Jira grant and regenerate: the population shows incomplete, not zero, and cannot be recorded as a non-occurrence. Change the label: the preview shows the old and new match counts, and earlier populations keep the selector revision they were generated under. Label a Jira issue `offboarding` for a leaver: the checklist shows it completed in the tracker, while the leaver's app accounts still need readback.

#### INVENTORY-001 — Unified assets, people and ownership

*Tier:* Core

**Requirement.** A compliance inventory reconciles cloud and hosting resources (CLOUD-001, CLOUD-002), code repositories, applications and their app-level accounts (APPS-001), vendors, devices, people and service accounts from connected sources and approved manual entries. Each record has source identity, owner, criticality, scope, last observation and lifecycle state; deduplication and exclusion are reviewable. Inventory supports framework scoping and access-review populations without replacing HRIS, CMDB or endpoint management.

Completion covers all current connected sources, native People/vendors and approved manual records. Before shipping, HRIS-001, DEVICE-001, CLOUD-002, APPS-001 and new CODE-001 source providers inherit source identity, reviewed grouping, inventory metadata, source-row retention and scope export. LIFECYCLE-001 inherits the joiner/leaver checklist consumption of these same People identities; no checklist is claimed before that capability exists.

Source identity is qualified by connection/source and record kind; identical emails, serials or provider IDs never group records automatically. An owner explicitly selects same-kind source members and records a reason to group or separate their canonical reporting identity. Every source row, original People ID and history remains. Metadata decisions retain actor, UTC time, reason and revision; the latest revision for each source member determines its owner, criticality, included/excluded scope and active/retired lifecycle. Grouping does not overwrite member metadata. Ownership grants no authentication or authorization. Inventory grouping, scope exclusion and retirement never remove test subjects; a test-scope exclusion requires its own explicit reviewed decision. Missing permission and source absence remain collection facts, never owner retirement. The recorded observation time is separate from each test’s cadence-specific freshness and result; Inventory never claims a passing control. A person without an approved account match stays unmatched, labelled “no account found”; no account is fabricated. The same People IDs feed explicit owner policy assignments, role/audience training enrollment and reviewed access populations, while departures exclude future personnel campaigns and preserve history.

**Acceptance.**
1. Through current Inventory doors reconcile duplicate person/device records by explicit grouping, assign an unowned service and retire/exclude it with a reason.
2. Export every source member/row and reconcile counts, canonical membership and history, including unmatched/excluded/retired records.
3. Restore the archive and restart without losing decisions or original rows.
4. Remove GitHub/AWS collection permission and reconnect an identical provider ID through a different connection: retain distinct sources and unchanged test subjects.
5. Through the same People identities explicitly assign role policies, enroll role training and freeze an access-review population; record a departure and verify future campaigns exclude the person while prior history remains.
6. HRIS-001, DEVICE-001, CLOUD-002, APPS-001 and LIFECYCLE-001 assert their inherited source/checklist doors when they ship.
7. `tests/inventory.mjs`, `tests/inventory-browser.mjs`, `tests/github.mjs`, `tests/cloud.mjs` and `tests/identity.mjs` name INVENTORY-001 and assert these current doors, including 1440/390 console states.

#### POPULATION-001 — Labeled CSV populations for unsupported systems

*Tier:* Core

**Requirement.** For an HRIS, application, identity source or device fleet with no connector, owners upload a CSV roster, account list or device list against a published column template. Required columns are named; others are mapped on upload. Each upload is an immutable, manually-asserted exhibit (PROOF-001) that records uploader, upload time, declared source system and as-of date. It feeds Inventory and access-review populations, labeled manual provenance everywhere it appears. LIFECYCLE-001 inherits consumption of these reviewed population rows, their joiner/leaver differences and manual evidence when its checklists ship; until then no checklist is claimed. Rows reconcile to people and devices in Inventory through reviewable matches, with unmatched rows kept visible. A CSV population never creates source-observed evidence, never satisfies a test that requires a source read, and goes stale after its declared as-of date plus the owner-set refresh window.

**Acceptance.**
1. Upload a Justworks-style roster CSV and an account list for an unconnected SaaS app through Inventory → Upload population.
2. Map one renamed column, resolve one ambiguous person match, and leave one row unmatched.
3. The People and Inventory views show both lists labeled manual with the upload time.
4. A test requiring source reads stays unknown for those records.
5. Upload a revised list: the original exhibit stays, and the differences appear as joiners, leavers and removed accounts.
6. Let the refresh window pass: the population shows stale.
7. A malformed file is refused with row-level reasons, and nothing is admitted.

#### TEST-001 — Continuous control tests and exception discipline

*Tier:* Core

**Requirement.** Framework tests from the shipped catalog (LIBRARY-001), API-defined tests (API-001) and owner-defined custom tests run on their schedule (configuration tests at least hourly, population and period tests at least daily) and on source change events against the declared asset population. Each immutable observation keeps expected criteria, evaluated revision, source references, interval and result: pass, fail, unknown or not applicable with approved rationale. Configuration snapshots and event/period tests are distinct. Tune noisy tests with reviewed scope, thresholds and expiring exceptions; suppressing alerts never rewrites observations or closes risk.

**Acceptance.**
1. From a mapped control enable a scheduled MFA or reviewed-deployment test, confirm it runs at least hourly, fail a real source setting and inspect all resource results.
2. Tune scope with an expiring exception, interrupt collection, and revise criteria.
3. A later pass, expired exception or revised denominator never erases the earlier failure or fills an unobserved period.

### Remediation and follow-through

#### REMEDY-001 — Failed test to verified remediation

*Tier:* Core

**Requirement.** A failed test creates or links a durable remediation obligation with affected assets, control/framework mappings, severity, accountable owner, guidance (the test's per-provider remediation steps, LIBRARY-001), deadline, next action and source evidence. Owners triage, assign, comment and attach changes. A re-test starts automatically when the linked task closes in Evidence or in any WORK-001 tracker (per item when tickets are per item, WORK-002), or when a relevant source change event arrives, and owners can also request one. A ticket marked done remains awaiting verification until an independent real-source re-test passes; failures reopen work and time-bounded risk acceptance has an approver and expiry.

**Acceptance.**
1. Fail a real connected control, follow its Remediate action, assign an owner and due date, attach a change and mark work done before fixing the source.
2. The obligation remains open.
3. Fix the source, re-test and observe verified closure; regress it and confirm reopening with both observations retained.

#### REMEDY-002 — Remediation SLAs and automatic re-test

*Tier:* Core

**Requirement.** Owners define SLA policies by test category (cloud, identity, code, device, vulnerability, security issue, personnel, policy, vendor) and severity, with a default policy shipped per category. Each failing user, device, account, resource or vulnerability finding gets its own SLA clock starting at its first failing observation. A vulnerability finding's due date is fixed at first detection from the SLA policy revision then in force (VULN-001); changing a policy applies only to findings first detected afterwards. A tracker-sourced security issue (ISSUES-001) is clocked the same way from its tracker creation time, and its closure is recorded as the tracker's resolution rather than a verified pass. The clock pauses only for an approved, expiring exception and resets only on verified pass. Readiness, test history, the remediation queue and board/auditor exports show each item as within SLA, approaching or SLA missed, with time-to-remediate history filterable by period, owner and category. SLA breaches escalate through FOLLOWUP-001. A linked task closing in Evidence or in any WORK-001 tracker, or a source change event, automatically queues a re-test within 15 minutes, with no human action; a per-item ticket (WORK-002) re-tests only its item. If that re-test fails, the obligation reopens and the SLA clock keeps running.

REMEDY-002 is complete for every currently shipped observation and tracker door. Before shipping, VULN-001 must apply the policy revision in force at first detection, preserve each finding's fixed due date across later policy changes, and supply source-observed recovery plus per-item SLA status to readiness, board/auditor exports and the remediation population. ISSUES-001 must do the same from tracker creation time, preserve reopen history, and label tracker resolution as resolved in tracker rather than a verified test pass. Every new WORK-001 destination inherits automatic re-test within 15 minutes, per-item scope and preservation of a still-failing clock before it ships.

SLA days are 24-hour UTC intervals. Approved exception intervals are clipped to the running failure cycle and counted as a union, so overlap never pauses time twice; expiry or revocation ends its interval. The running cycle keeps its policy revision and original first-failure time until a verified pass; a regression after that pass starts a new cycle under the policy then in force. Time to remediate is elapsed wall-clock hours from first failure to verified pass, rounded to the nearest whole hour (half-hours up), including paused time; open work has no completed duration.

**Acceptance.**
1. Set a 7-day SLA for high-severity identity failures.
2. Fail MFA for two real users, fix one within the SLA, and let the other's clock pass the deadline using the test-harness clock: one item shows within SLA and resolved, the other SLA missed with an escalation sent.
3. Export the board report and reconcile per-item SLA status.
4. Close the linked Jira ticket without fixing the source: a re-test starts automatically with no human action, fails, and keeps the obligation open.
5. Repeat that step with a GitHub Issues ticket and an Asana task: each close starts a re-test with no human action.
6. Fix the source: the source event triggers a re-test that verifies closure.
7. Apply an expiring exception: the clock pauses, then resumes when it expires.

#### WORK-001 — Two-way remediation tickets in Vector and twelve external trackers

*Tier:* Core

**Requirement.** Remediation can create and synchronize a linked ticket in [Vector](https://github.com/just-every/run-vector) or in any of these trackers, each connected by its own authorized OAuth app or API token:
- Jira Cloud and Linear;
- GitHub Issues and GitLab Issues (the organizations CODE-001 connects, under a separate issue-write grant that collection credentials never hold), and Azure Boards (Azure DevOps work items);
- Asana, Shortcut, ClickUp and monday.com;
- Basecamp, Freshservice and YouTrack.

Every destination gets the same behavior:
- **Mapping.** A per-destination project, board or list, and field mapping for owner, due date, priority, status, labels and a description with source links. Explicit field rules state which side owns each field.
- **Two-way sync.** Comments synchronize both ways. Inbound webhooks, or polling where a tracker has none, bring the tracker's assignee and status into Evidence within 15 minutes.
- **Basecamp callback.** Basecamp webhooks are unsigned: the owner registers a callback from Evidence, using a unique 256-bit secret address sealed per destination and never displayed or exported. Only that address admits events with matching account/project and stable event IDs; events prompt authorized source reads and never establish source truth. The five-minute scheduler checks registration hourly for provider deactivation or changed/unavailable registration; failed checks destroy local callback authority and show a reconnect state, while ten-minute polling remains the backstop. A publicly reachable HTTPS installation is required. Custody restore excludes callback secrets and leaves the destination inactive.
- **Idempotence.** A redelivered or replayed event never creates a duplicate ticket or a second state change.
- **Visible failures.** Authorization loss, a deleted remote ticket, a field-mapping failure and conflicting edits on both sides are shown on the linked obligation with the remote value, the local value and the time. Nothing is silently overwritten.

Ticket granularity and tracker status on tests are WORK-002. Reading the security issues and incidents people raise in these trackers is ISSUES-001. Closing a ticket on any destination triggers a re-test (REMEDY-001, REMEDY-002) and is never a verified fix. Evidence owns the compliance obligation and its verification; Vector and the external trackers own general project execution. Related independent RunEditRun sibling: [Pegboard](https://github.com/just-every/run-pegboard) (work and project management).

**Acceptance.**
1. For each of the thirteen destinations, connect an authorized sandbox project, create a ticket from one failed control, change assignee and status in the tracker and in Evidence, and deliver the same inbound event twice: exactly one ticket exists, the tracker's assignee and status appear in Evidence within 15 minutes, and the second delivery changes nothing.
2. Edit the same field on both sides: the conflict shows both values and the time.
3. Revoke the tracker grant and delete one remote ticket: each failure is shown on its obligation.
4. Close the remote ticket while the test still fails: a re-test runs with no human action, fails, and Evidence keeps the compliance obligation open.
5. Add a comment in each tracker and inspect it in Evidence: retain text, author, time, stable ID and source link, mark truncation, and enforce the existing need-to-know/privacy limits; activity metadata alone fails acceptance.
6. For Basecamp, register the secret-address callback from Evidence, replay a to-do and comment event, refuse a wrong secret/account/project, deactivate the registration at the provider and advance the scheduler one hour: callback authority is removed, the owner sees the problem, and polling continues.
7. Restore the archive: no callback secret or registration authority returns.
8. **Current semantics (23 October 2026):** All thirteen destination paths have a WORK-001-named public-door matrix for mapped creation, assignee/status read-back, unchanged-read idempotence, due-date conflicts, deletion, grant loss/recovery and closure-triggered source re-tests. Priority and labels use native fields where available: label IDs for Vector/Linear, Asana workspace tags and a project Priority enum, Shortcut's Priority enum, monday tags and priority columns, and YouTrack tags/custom fields. Missing or ambiguous mappings refuse creation visibly. Basecamp to-dos have no native priority/label fields; their text representation remains explicit. Title, description, source links, priority and labels are set at creation. The signed-in human owner can also write explicitly mapped native tracker assignees and statuses, separately from Evidence's accountable owner and compliance state. The field editor reads native identities and a new source read precedes every write; if a selected field changed since the displayed snapshot, no field is written and both tracker and requested values, expected snapshot, actor reason and UTC conflict time remain in Sync history. Unknown native identities refuse writes. Read-back must confirm the requested identities; lost or unconfirmed outcomes stay uncertain and are never reported as success. This check does not claim an atomic lock against provider edits after the final read. Tokens, agents and unsigned-in sessions cannot use this owner-session door. Azure dates use the owner-mapped writable DateTime field at UTC midnight; reads compare UTC calendar days. GitHub Issues has no native due-date field: its editable `Evidence due date:` body line is synchronized, with the same explicit conflict/resolution rule as native deadlines, preserving other issue text. Removing that line creates a conflict; malformed dates stay unavailable. Authenticated native callbacks now prompt read-back for Azure Boards (Basic service-hook credentials), monday (integration-app signed JWT), Freshservice (authenticated Workflow Automator POST) and YouTrack (`X-YouTrack-Token`). Polling batches count distinct destination/remote-ticket pairs (at most fifty per tick), including every linked item of a whole-test ticket together so one closure queues a complete re-test. Their payloads never establish tracker truth; repeats are admitted once and project/destination boundaries remain enforced. Shortcut signed batches and the existing callback paths remain supported. Basecamp now has owner-registered secret-address callbacks (unsigned provider events), exact event-ID deduplication, account/project checks, hourly deactivation checks and a polling backstop, asserted through public doors against its official-schema network fake. Vector comment reads follow its published API-003 Comment schema and cursor protocol with the additional `comments:read` scope. Every destination retains the first observed comment text (up to 2,000 UTF-16 code units, visibly marked when truncated), source display author, stable comment ID, original source time normalized to UTC separately from receipt time, and a source link (the provider's safe same-origin permalink where exposed, otherwise the linked ticket). Earlier snapshots are not rewritten by later source edits. Source metadata survives restart and custody restore beside the retained history. Omitted source times stay unavailable. A denied, malformed, foreign-issue, unsafe-link, repeated-cursor or incomplete Vector page fails the read without admitting partial comments; all page filters stay bound to the linked issue. SQL deduplication prevents competing reads from duplicating either the comment or its attribution. Source HTML is inert text; only the owner's existing private doors expose the history, never a source-read API token. Vector reads at most 201 pages per sync; exceeding the bound fails visibly rather than claiming completeness. AUTH-001 inherits the same source-comment privacy on future delegated doors. Evidence-origin mapped tracker assignee/status writes and their conflict/authority doors are asserted for all thirteen destinations; editing Evidence's accountable owner/compliance state separately does not satisfy those writes. AUTH-001 carries their scoped people-only authorization before delegated roles ship; PORTABLE-001 carries callback registration custody. Live Gap for each destination: **not yet run against a live account**; no provider verification is claimed.

#### WORK-002 — Per-test or per-item tickets, with tracker status on tests

*Tier:* Core

**Requirement.** Owners choose, per test, how failures become tickets in a WORK-001 destination:
- **Granularity.** One ticket for the whole test, or one ticket per failing item: resource, user, account, device or vulnerability finding. A remediation-settings default applies to new tests. Changing a test's granularity applies to items that fail afterwards; existing tickets stay linked. With auto-create on, a ticket is created as each new item fails; otherwise Evidence proposes it for one-click creation.
- **SLA per ticket.** A per-item ticket links to that item's REMEDY-002 SLA clock, and its due date is written to the tracker. A whole-test ticket lists its items with each item's deadline, and its due date is the earliest open item's deadline. Newly failing items are added to the whole-test ticket as a comment and an updated item list.
- **Closure.** Closing a per-item ticket re-tests only that item: the item closes only on a verified pass, and other items' clocks are unaffected. Closing a whole-test ticket re-tests every item and closes only the passing ones. If any item still fails, the remote ticket is reopened with a comment naming those items, unless the owner has chosen to open a follow-up ticket instead.
- **Tracker status in Evidence.** The test page and the remediation queue show, for each linked ticket, its destination, key and link, assignee, status and last sync time. A sync older than its interval is marked stale. The remediation queue filters by tracker assignee and status.

**Acceptance.**
1. For each WORK-001 destination, set a test to per-item tickets and fail it on two sandbox resources: two tickets are created, each with its own due date.
2. Change one ticket's assignee in the tracker: the test page and the remediation queue show the new assignee and status within 15 minutes.
3. Close that ticket without fixing the source: a re-test starts within 15 minutes with no human action and fails.
4. That item stays open and its SLA clock keeps running, while the other item's clock runs unaffected.
5. Fix the second resource and close its ticket: only that item closes, as verified.
6. Switch another test to one ticket per test and fail three items: one ticket lists all three with their deadlines.
7. Close it with one item fixed: all three are re-tested, only the fixed item closes, and the remote ticket reopens naming the other two.

#### FOLLOWUP-001 — Email, Slack and Microsoft Teams follow-up

*Tier:* Core

**Requirement.** Email through Resend or SendGrid, Slack and Microsoft Teams deliver actionable remediation, policy, training, vendor-diligence and access-review reminders with private record links. Owners configure escalation, US business timezone, business calendar, quiet hours, cadence, stop rules and destination permissions. Persist the obligation and next action across restarts, deduplicate scheduled sends, expose pending/acknowledged/failed/uncertain outcomes, and stop when work is verified, authority ends or an owner pauses it. Provider acknowledgment never means a person acted. A weekly compliance digest goes to each owner and control owner by email, Slack or Teams, on an owner-chosen day and time (default Monday 09:00 in the business timezone). It lists that person's new failures, items due in the next 14 days, overdue and SLA-missed items and expiring exceptions, each linked to its record. A person with nothing open gets no digest unless they opt into an all-clear.

**Acceptance.**
1. Configure each named channel/provider, let a due obligation escalate across a DST/business-calendar boundary with the browser closed, then restart the worker.
2. Simulate a network-edge timeout and reconnect authorization; inspect delivery uncertainty without duplicate task closure.
3. Complete or pause the obligation and verify later reminders stop while history remains.
4. Let the weekly digest run on the test-harness clock: each control owner receives only their own new failures, upcoming, overdue and SLA-missed items, reconciled to the remediation queue, and a control owner with nothing open receives none.

#### FOLLOWUP-002 — Failure notices with an owner and a due date in Slack, Teams or email

*Tier:* Core

**Requirement.** When a test's failing observation opens a REMEDY-001 obligation, Evidence notifies the obligation's accountable owner at once, on the channel that person chose under FOLLOWUP-001 (email, Slack or Microsoft Teams), without waiting for the SLA to approach. The notice names the test, the failing resource, the control and the framework requirements it maps to, the owner, the severity and REMEDY-002 due date, and the first how-to-remediate step (LIBRARY-001), with a private link to the obligation. Where a WORK-001 ticket was created, it also carries the ticket key and link. An obligation with no owner notifies the control owner, or failing that the escalation contact, and says so.
- **A task in the channel.** In Slack (interactive message) and Teams (Adaptive Card), the owner can Acknowledge, which records the person and time on the obligation, and Reassign, which changes the owner with a recorded reason and notifies the new owner. The message updates in place when the obligation is reassigned, re-tested or verified closed.
- **Never a closure.** Acting on a message never marks work done or closes the obligation; only a verified re-test does (REMEDY-001).
- **Grouping and deduplication.** A test that fails on several items at once sends one notice per owner listing each item with its own due date. Notices are deduplicated per obligation and failure cycle across restarts, quiet hours defer them rather than drop them, and their outcomes follow FOLLOWUP-001 (pending, accepted, failed or uncertain). A regression after verified closure sends a new notice for the new cycle.

**Acceptance.**
1. Connect a Slack sandbox workspace and a Teams channel, give one control owner Slack and another Teams as their channel, and set a 7-day SLA for high-severity failures.
2. Fail a mapped connected test on one resource: within one scheduler run the Slack owner receives a message naming the test, resource, control, owner and a due date seven days out, with the obligation link, and the obligation history shows the notice accepted.
3. Click Acknowledge: the obligation records that person and time and stays open.
4. Reassign from the message with a reason: the new owner is recorded and notified.
5. Restart the worker: no duplicate is sent.
6. Fail a test owned by the Teams owner on three resources: one Adaptive Card lists all three items with their due dates.
7. With Jira as the WORK-001 destination, the notice carries the Jira key and link.
8. Fix the source: after the passing re-test the Slack message shows verified. Regress it: a new notice is sent. Fail a test during quiet hours: the notice waits for the business window. Revoke the Slack token: the notice shows failed on the obligation with the reason. **Current partial slice (21 October 2026):** A failing observation that opens or reopens a REMEDY-001 obligation notifies its accountable owner on the next five-minute scheduler run, on the channel that person chose under FOLLOWUP-001, without waiting for the SLA to approach. The notice names the test, failing item, control, mapped framework requirements, owner, severity, REMEDY-002 due date (UTC calendar date), the first how-to-remediate step (the shipped catalogue's first provider console step, or the owner-written step on a custom test), a link to the obligation and, where a WORK-001 ticket exists, its key and link. An item with no owner (or whose owner left) goes to the control owner, then the escalation contact, then the installation owner, and the notice says which. A test that fails on several items sends one notice per recipient listing each item with its own due date. Each delivery is recorded on the obligation per failure cycle and recipient with its outcome and reason (accepted, failed or uncertain) and is never resent; business-calendar quiet hours defer a notice until the window opens and a paused obligation stays silent. Reassigning or assigning an item notifies the new owner on the next run, and a regression after a verified closure opens a new cycle and a new notice. A verified closure is announced to whoever heard of the failure. The private obligation page (owner sign-in required) offers Acknowledge, which records who and when and never closes the obligation, and Reassign, which needs a reason and records it. Until delegated roles exist (AUTH-001) the signed-in owner session acts for the assigned person, and the history says so; only a verified re-test closes an obligation. Per ct (21 October 2026) the in-channel step is a private link, not a Slack interactive message or Teams bot. Gaps keeping this partial: Acknowledge and Reassign from inside the Slack or Teams message (needs a Slack app interactivity endpoint or a Teams bot); in-place update of an earlier message on reassignment, re-test or verification (a new message is posted instead, and a Teams workflow URL cannot edit); live Slack and Teams sandbox acceptance. No provider verification is claimed.

### Risk and third parties

#### RISK-001 — Risk register and treatment lifecycle

*Tier:* Core

**Requirement.** Risk assessments record scenario, affected assets/processes, likelihood, impact, inherent/residual risk, method (the scoring-method revision of RISK-002), owner, review deadline, mitigation and approved acceptance. Risks come from the shipped library, import, the form or the API (RISK-002). Risks link controls, failing tests, incidents and vendors; treatment plans carry due work and verification. Risk acceptance expires and escalates rather than hiding a failed control.

**Acceptance.**
1. Create a risk from a failing control in Risk Register, score it, assign mitigation, approve a time-bounded residual-risk acceptance and export the register.
2. Let approval expire and inspect escalation; a passing re-test updates treatment evidence without rewriting the original assessment.

#### RISK-002 — Shipped risk library, register import and configurable scoring

*Tier:* Core

**Requirement.** A register never starts from a blank page. Evidence ships a versioned library of at least 100 risk scenarios covering access, change, vendor and supply chain, data loss and privacy, availability and continuity, people, physical, application security and AI risks. They are written to support the ISO 27001 clause 6.1 risk assessment, the SOC 2 risk assessment criteria and the HIPAA Security Rule risk analysis (PROGRAM-003). Each scenario has a threat and vulnerability description, affected asset types, a suggested likelihood, impact and treatment, and suggested LIBRARY-001 control mappings. Adding a scenario creates a RISK-001 risk linked to its suggested controls and to in-scope assets of matching type, all of which the owner can change. Library revisions are reviewable and never alter risks already added. Risks also enter in three other ways:
- **Spreadsheet import:** CSV/XLSX with column mapping and a dry run that validates each row and detects duplicates and owner matches before anything is admitted. Admitted risks are labeled imported with file and date. Incumbent register exports under MIGRATE-001 use this path.
- **By hand:** through the Risk Register form.
- **API:** through API-001, with a risk-push token scope.

**Scoring is owner-configurable and versioned.** Owners set the likelihood and impact scale size (3×3 to 5×5), level labels and definitions, the scoring formula (product or matrix lookup), risk-level thresholds and terminology. Each assessment records the scoring-method revision it was scored under. The numeric score is likelihood multiplied by impact; product thresholds use inclusive upper bounds, while a matrix selects the risk-level label at its likelihood row and impact column. Suggested 1–5 library values are scaled to the chosen size, rounded to the nearest whole number and clamped to the scale. Legacy definitions not recorded are labeled as such. Changing the method never rescores history; reassessing a risk under a new method adds a new assessment beside the old one.

**Acceptance.**
1. On a fresh ISO 27001 program, add five library risks: each is linked to its suggested controls and matching in-scope assets.
2. Import a 30-row register CSV through Risk Register → Import: the dry run refuses one invalid row with a reason, and 29 risks are admitted labeled imported.
3. Change the scale from 5×5 to 4×4 with new labels: earlier assessments still show their original scale, labels and score.
4. Reassess one risk: both assessments are retained with their method revisions.
5. Create a HIPAA program and add its ePHI/HIPAA scenarios from the library.
6. PROGRAM-003 carries starting the HIPAA risk-analysis document and adding those scenarios inside it.
7. Export the register with the method revision per assessment.

#### VENDOR-001 — Vendor inventory and security diligence

*Tier:* Core

**Requirement.** Track suppliers, business owner, data access, criticality, subprocessors, contracts/BAAs/DPAs, security documents, risk tier, assessment questionnaires, findings, approval, renewal and reassessment dates. Outgoing assessments use shipped standard questionnaire templates (SIG Lite and SIG Core, with Shared Assessments licensing where required; CSA CAIQ v4) or owner-built templates, with answers kept per question. Secure supplier request links collect documents and replies with expiry and provenance. Compare document versions, chase missing diligence and route exceptions to a named approver; vendor marketing assertions remain distinct from verified evidence.

**Acceptance.**
1. Onboard a US SaaS supplier through Vendors, request a SOC 2 report and BAA where applicable, send the CAIQ v4 template type after importing its licensed workbook, collect the supplier's per-question response and record a finding.
2. Approve with an expiring condition, reach renewal, and inspect overdue reassessment reminders and the unchanged original documents.
3. An expired supplier link cannot read or mutate another vendor.
4. Also (ct 22 Oct 2026): import a CAIQ v4.0.x and a SIG Lite workbook with a licence confirmation (each refused without one, including under a name without 'SIG'), admit a SIG Core-sized workbook, send each, and receive a supplier's completed CAIQ as per-question answers keyed by CAIQ id.
5. **Current semantics (22 October 2026):** A supplier has a profile (service, website, contact, data it can access from PHI, cardholder data, personal data, credentials and confidential business data, hosting region, annual cost in USD, renewal date, risk tier and the basis for it, and its subprocessors); every profile change is a numbered revision with the owner's reason.
6. The tier is suggested from criticality and data and the owner may set another.
7. Diligence the profile makes necessary (SOC 2 or ISO 27001 assurance for medium and high tiers, a BAA when PHI is recorded, a DPA when personal data is, a questionnaire for medium and high tiers) is listed as missing, requested, overdue, received, expired or verified.
8. Prerequisites such as the BAA and regional controls for a non-US region are shown as "not verified by Evidence"; Evidence never signs or certifies for either party. Requests go out on one expiring supplier link per issue (at most 90 days, shown once, only its SHA-256 digest kept, emailed only when the owner ticks the explicit email choice). The token is the credential: supplier pages check no Origin (they send no referrer, so posts carry Origin: null) but refuse a cross-site Sec-Fetch-Site request, are served no-store with no referrer, never write the token to the audit, link events, logs or archive, and the owner closes a link at any time. The link shows only the requests it names; any unknown, closed, expired or other-vendor request answers the same plain 404 and is recorded against the link. Supplier documents (10 MiB each) are stored as immutable originals with their digest and read back before they are recorded; a newer document of the same kind supersedes the earlier one beside it, with a comparison of size, dates and bytes, and a changed or missing original is refused on download. Supplier answers are kept per question (yes, no or not applicable, with a comment) and a revision is appended beside the earlier answer; a final submission needs every question answered and the respondent's unverified name and email. Documents, answers and marketing claims are supplier-provided and unverified until the owner reviews a document as verified; a claim is verified only by a verified document of that vendor. Findings cite a document or an answer; accepting one, and approving past an open finding or missing diligence, is an exception that needs a named approver from People. An approval is append-only: approved, conditional (the condition and a future expiry; the owner records when it was met) or declined, with a reassessment date (default six months for the high tier and twelve otherwise, capped at the contract renewal). Reminders go to the vendor's business owner (or the installation owner) once per cycle: reassessment 14 days ahead and when overdue, a lapsed condition and an overdue request. Licensed questionnaires (ct 22 Oct 2026). Evidence ships the SIG Lite, SIG Core and CSA CAIQ v4 template types: question ids, domains, scoping and answer forms (SIG yes/no/not applicable with comment; CAIQ yes/no/not applicable, SSRM control ownership and implementation description). Their licensed text loads only by importing the owner's licensed workbook (SIG of a named year; CAIQ v4.0.x), which keeps every id, domain and scoping rule, records edition, licensee and confirming person, and refuses any SIG or CAIQ workbook without that confirmation whatever its name. A supplier may answer by uploading its completed workbook of the same edition; answers are kept per question id and stay unverified. The import maps the question worksheet's columns, preserves the original row values and explicit scoping rule/decision, and records its fingerprint. A scoped workbook comes from its licensed authoring tool; Evidence does not execute Excel macros. Up to 10,000 questions and 10 MiB are admitted. Out-of-scope ids remain in the request without requiring an answer. Until CSA or Shared Assessments licenses Evidence to ship their text, Evidence's own questionnaire is 'CCM v4 control questionnaire (Evidence wording)', never 'CAIQ'. Supplier-link digests never leave an installation: a restored link is closed and cannot authenticate. VENDOR-002 and VENDOR-003 inherit the document store, the unverified/verified distinction and the named-approver rule; ERASE-001 owns erasure of supplier contact data and answers.

#### VENDOR-003 — Vendor document review with cited findings

*Tier:* Core

**Requirement.** Evidence reads each collected vendor SOC 1/SOC 2 report, ISO certificate, penetration-test summary, DPA/BAA and questionnaire response, and proposes structured findings, each with a page citation that a reviewer confirms or corrects. For a SOC report it extracts:
- report type (Type I/II) and the period or as-of date;
- the service auditor;
- the opinion (unqualified, qualified, adverse or disclaimer);
- each tested-control exception;
- subservice organizations, with carve-out or inclusive treatment;
- each complementary user entity control (CUEC);
- a bridge-letter gap when the period ended more than the owner-set window ago (default 3 months) with no bridge letter on file.

Current readable-PDF and UTF-8 text slice: extraction runs locally, without a model or outbound document flow. UTF-8 `.txt` reports retain explicit form-feed page breaks (including addressable blank pages), with no rendered-layout or OCR claim. Invalid encoding, binary text and unsupported formats refuse a proposal. Readers bound input to 250 pages and 500,000 text characters; proposals retain the existing 1 MiB JSON / 500 source-page / 2,000-field bounds. Ambiguous opinion prose stays unresolved; recognized negative/disclaimer language never defaults to unqualified, and conflicting source opinions remain explicit. Each field retains an exact passage and page number; the source reader checks the original digest and shows that page’s extracted text beside the original download. Missing fields remain explicitly unresolved. Corrections and source-supported omitted fields append a revision; no original proposal or file is rewritten. A final native supplier questionnaire is retained as a lossless JSON transcript, with one source page per question. Negative and not-applicable answers propose findings; yes answers never count as independent evidence. Readable ISO certificates, penetration-test summaries and DPA/BAA documents retain cited scope metadata separately from proposed limitations and findings; informational metadata alone never changes a tier. A named reviewer’s exact approval records CUECs and findings and raises the vendor tier to high for an exception or a modified opinion. Unmapped and explicitly accepted-unaddressed CUECs remain open in installation-wide readiness and do not alter framework percentages. Bridge letters carry a separate classification beside immutable document rows; coverage uses their recorded effective date, byte availability and expiry, with no claim of independent verification. The window is 1–24 calendar months (default 3), with month-end clamping.

Each CUEC becomes an obligation that the owner maps to one of their own controls or explicitly accepts as unaddressed. Exceptions and qualified opinions become vendor findings with risk-tier impact. Extraction is a proposal: findings, CUEC mappings and risk-tier changes take effect only after a named reviewer approves them, and the original document bytes stay unchanged.

**Acceptance.**
1. Upload a real-format SOC 2 Type II report containing one tested-control exception and two CUECs, issued more than three months after its period ended, through Vendors → Documents.
2. The proposed review shows report type, period, auditor, opinion, the exception and both CUECs, and each citation opens the cited page.
3. Map one CUEC to an existing access-review control and leave the other unmapped: the unmapped CUEC stays an open obligation in readiness.
4. The bridge-letter gap appears and clears when a bridge letter is uploaded.
5. Correct one wrong extraction: the correction and the original proposal both remain.
6. A qualified-opinion report raises a finding only after reviewer approval.

#### VENDOR-002 — Vendor discovery and risk-based follow-through

*Tier:* Core

**Requirement.** Discover candidate SaaS vendors from these named authorized sources:
- **Identity-provider app grants:** Google Workspace OAuth app grants (token audit), Microsoft Entra ID enterprise applications and OAuth consent grants, and Okta app assignments, each with granted scopes and the users who granted or hold them.
- **Spend sources:** QuickBooks Online vendors and bills, Ramp vendors and card transactions, and Brex vendors and expenses, each with amounts and dates.
- **Connected sources:** app-account connectors (APPS-001) and cloud marketplace subscriptions visible through CLOUD-001.

Each candidate shows the source records that surfaced it. Candidates seen in several sources merge only through a reviewable match. A human confirms identity, ownership and data access before risk-tier assignment or external diligence. Accepted vendors start tier-specific recurring reviews (CADENCE-001); agents can prepare follow-ups within approved recipients and schedules.

**Acceptance.**
1. Connect each of the six named grant and spend sources (Google Workspace, Entra ID, Okta, QuickBooks Online, Ramp and Brex): each surfaces at least one candidate citing its source records (granted scopes and users, or spend amounts and dates).
2. An app connected through APPS-001 that is not yet a vendor, and an AWS Marketplace subscription read through CLOUD-001, each surface as candidates too.
3. The same vendor found in QuickBooks Online and Ramp is proposed as one duplicate match, which a human accepts.
4. Review the proposed tier for an unknown vendor and approve diligence.
5. Change its access and reach its review date: a new assessment starts, missing replies escalate and rejected candidates receive no external requests.

### Policies, employees and access

#### POLICY-001 — Policy library, approval and version control

*Tier:* Core

**Requirement.** Evidence ships a template for every policy that the mapped requirements of SOC 2, ISO 27001:2022, HIPAA and PCI DSS call for. At minimum that is: information security, acceptable use, access control, asset management, data classification and management, data retention and disposal, encryption/cryptography, risk management, secure development, change management, vulnerability and patch management, logging and monitoring, incident response, business continuity and disaster recovery, vendor/third-party management, human resources security, physical and environmental security, privacy, and the HIPAA-specific sanctions, breach notification and workforce security policies. A guided policy builder for SOC 2 and ISO 27001:2022 tailors templates from program scope and connected facts. Each library requirement that calls for a policy links the template, and an approved, published policy revision automatically satisfies its linked policy test, which fails again when the policy passes its review deadline. Tailor them to actual operations; named reviewers approve exact revisions before publication. Maintain effective dates, change history, recurring review, control mappings and exceptions, with employee assignment tied to a specific approved version. Templates require applicability review and do not constitute legal advice.

**Acceptance.**
1. From Policies tailor a template to connected business facts, review an exact revision, reject a changed draft, then publish and map it to two frameworks.
2. Reach its review deadline and publish a replacement: original approval and attestations remain, with new required acknowledgments visible.
3. On a fresh SOC 2 program and a fresh ISO 27001 program, readiness first lists every requirement lacking an approved, published policy.
4. After the shipped templates are approved and published, it lists none.
5. A build-time check fails if any library requirement calling for a policy has no shipped template.
6. Let one policy pass its review deadline: its linked policy test fails.

#### ATTEST-001 — Employee policy attestations

*Tier:* Core

**Requirement.** Employees and contractors receive role-appropriate approved policies, attest to exact versions and see their outstanding actions. Managers/compliance owners track acknowledgments, exceptions, deadlines and reminders; bulk publication cannot invent employee assent. Departed workers retain historical evidence without active access.

**Acceptance.**
1. Assign a policy revision to an employee and contractor, sign in as each and acknowledge one while leaving the other overdue.
2. Publish a material revision and inspect reassignment/reminders.
3. Terminate one person and confirm denied access with retained time/version/identity evidence in the audit export.

#### TRAIN-001 — Shipped security training and KnowBe4 evidence

*Tier:* Core

**Requirement.** Evidence ships versioned training courses with graded assessments on every installation: general security awareness (phishing, passwords and MFA, device security, data handling, incident reporting), HIPAA privacy and security workforce training, and secure coding (OWASP Top 10, secure SDLC, threat modeling). HIPAA training unlocks with a HIPAA program and secure coding with a SOC 2 or ISO program for engineering roles. Courses are accessible (captions and transcripts) and updated through reviewable revisions. Assign training during onboarding and on configurable recurring schedules, track course version, completion and assessment result and overdue obligations, and admit owner-supplied KnowBe4 completion records with their source attribution. Support approved internally delivered training with clearly manual provenance. Role-based campaigns, due dates and schedule customization drive reminders and escalation; a course assignment is not completion.

**Acceptance.**
1. Create an onboarding and annual campaign in Training, enroll a new hire, have them complete the shipped general security-awareness course including its assessment, and fail and retake the assessment once (both attempts retained).
2. Confirm that HIPAA and secure-coding courses appear only after their programs and roles apply.
3. Complete an approved internal course and ingest a real KnowBe4 sandbox completion.
4. Leave another learner overdue, amend the schedule, and verify reminders, original result provenance and an auditor export without fabricated completions.

#### LIFECYCLE-001 — Joiner, mover and leaver compliance

*Tier:* Core

**Requirement.** This clause also consumes the reviewed manual population rows and joiner/leaver differences from POPULATION-001 in its checklists, retaining their manual provenance and requiring attached exhibits or re-uploaded lists for manual check-offs. HRIS and identity events create employee/contractor checklists for policy acknowledgment, training, background-check evidence where lawful (collected from Certn or Checkr integrations as completion status and date only, never report contents, or uploaded with manual provenance), device posture, access grant/review and termination revocation. Each item has owner, due time and source-readback proof; an offboarding task is incomplete until required accounts and devices have been checked: IdP accounts by identity readback, every connected app account (APPS-001) by app readback, and every unconnected app by a manual check-off with attached evidence. HR or IT executes in its own system; Evidence coordinates and verifies compliance. Account checks run on the day itself: on a person's start date their checklist is open and their IdP and connected app accounts are read and checked (MFA enrolled, expected groups only), and on their termination date (or the day a termination is recorded, if later) their IdP accounts, connected app accounts and devices are read back, with further readbacks after each change until every item closes.

Before shipping, identity-source and CSV-roster leavers record their departure through the People departure door, so LIFECYCLE-002 flags, requests and escalates the handover of everything the person holds.

**Acceptance.**
1. Change a joiner, mover and leaver in an authorized HRIS; follow their checklists in People, ingest the joiner's background-check completion from a Certn sandbox and a Checkr sandbox (status and date only), assign tasks, and attempt to close leaver work with an active Okta account.
2. It remains open and escalates.
3. Disable the real account, re-read identity/device sources and verify closure with historical worker evidence preserved.
4. On the test-harness clock, give the joiner a start date and the leaver a termination date: the joiner's account checks and the leaver's account readbacks each run on that same UTC day in the business timezone, with their run times shown on the checklist.

#### LIFECYCLE-002 — Ownership handover when a person leaves

*Tier:* Core

**Requirement.** When a departure is recorded (from a connected HRIS, an identity source, a CSV roster or by hand), every compliance responsibility the person held is flagged for handover the same day: controls they own or contribute to (PROGRAM-002), policies they own or approve (POLICY-001), risks and treatment plans (RISK-001), vendors (VENDOR-001), open remediation obligations (REMEDY-001), access-review decisions (ACCESS-001), questionnaire assignments (ANSWER-003) and auditor requests (AUDIT-001). Each flagged item shows the departed owner and the date, and readiness counts it as unowned until it is reassigned. Reassignment names the new owner and a reason, keeps the earlier owner in the item's history, and notifies the new owner (FOLLOWUP-001). The leaver's manager, or failing that the compliance owner, is asked to hand over within an owner-set window (default 5 business days) and is escalated after it. A bulk handover can move all of a person's items to one successor, item by item in the record. Past observations, approvals and decisions keep the departed person as their actor; nothing is reattributed.

**Current doors and exact rules.** Today a departure is recorded by hand (People → Record departure); HRIS-001 and LIFECYCLE-001 (identity-source and CSV-roster leavers) record theirs through the same door before they ship. The responsibilities flagged today are control ownership and contribution, policy ownership, risk ownership, treatment plans not yet verified, vendor ownership, remediation obligations not yet verified, and undecided items of open access reviews (their reviewer or delegate). No person holds a policy approver assignment yet (approvals are made by the signed-in owner account), so AUTH-001 carries approver handover; ANSWER-003 carries questionnaire assignments and AUDIT-001 auditor requests before they ship. Until a manager role exists (AUTH-001), the leaver's manager is the current person named by the `manager_email` of their latest reviewed roster row (POPULATION-001); otherwise the installation owner acts as the compliance owner. The request is sent when the departure is recorded, and the scheduler sends any request that waited. The handover window is an owner-set whole number of business days from 1 to 30, default 5: counting starts the day after the departure's local date in the FOLLOWUP-001 business timezone and counts only FOLLOWUP-001 business days that are not holidays; the last counted day is the hand-over-by date. An item still flagged on any later local day escalates once per departure and window, to the FOLLOWUP-001 escalation contact or, without one, the installation owner. Readiness reports unowned controls (in-scope controls with no accountable owner or whose owner left) and owner-left controls as counts; they do not change the readiness percentage. Reassignment to someone who has left, or back to the leaver, is refused, and nobody is handed review of their own access. A bulk handover moves every flagged item unless the owner names a subset. Notices report the provider's outcome only; a sent notice never means anyone acted.

**Acceptance.**
1. Make one person the owner of two controls (one of them CC6.2's access-provisioning control), a policy, a risk and an open remediation obligation, then record their departure.
2. On the same day each item shows "owner left" with the departure date, readiness counts the controls as unowned, and the compliance owner is asked to hand them over.
3. Reassign CC6.2's control to Priya Shah with a reason: Priya is notified and the control shows her as owner, with the departed owner and the reason kept in its history.
4. Bulk hand over the rest to one successor.
5. Let one item pass the handover window: it escalates.
6. The departed person's earlier approvals and decisions still name them.

#### ACCESS-001 — Quarterly access-review campaigns

*Tier:* Core

**Requirement.** Schedule quarterly, semi-annual, annual (CADENCE-001) and owner-configured access reviews using a frozen source population of users, service identities, privileges and resources, drawn from identity connectors and from app-level account connectors (APPS-001) with in-app roles and MFA. Apps that are not connected or not behind SSO join a review through an uploaded account list (POPULATION-001), reconciled to people in Inventory and labeled manual provenance. Revocation in such an app is evidenced by a re-uploaded list or an attached exhibit, never by the reviewer's decision alone. Resource owners decide retain/revoke/change with reasons; self-review restrictions and delegated approvals are explicit. Track overdue decisions, reminders, exclusions and actual revocation readback; late discovered accounts become visible supplemental work.

- **Owner-configured cadence.** An owner-configured campaign either runs once over owner-chosen dates (one-off) or repeats every N whole calendar months, N from 1 to 24. When a recurring campaign's period has ended (the UTC date is after its last day), the next one starts with the same sources and resource owners: its start and decision due date move N months (day of month kept, clamped to the month's last day) and its period ends the day before the month-shifted day after the previous end (30 September plus three months ends 31 December).
- **Revocation evidence.** A connected directory account is verified revoked only by a source read after the request that shows it removed or not active. An uploaded-list account is verified by a newer upload of that app's list without the account (or with it inactive), or by an exhibit the owner attaches; the exhibit is kept as an immutable, digested receipt (PROOF-001) on the adopted access-review control's requirement (AC-04) covering the campaign period, and the revocation names that receipt. A decision alone, a still-listed account or an exhibit on a directory account never closes a revocation. Until AUTH-001 adds roles, the owner acts for the access-review administrator: starts campaigns, excludes, delegates and attaches exhibits.
- **People reconciliation.** Each frozen account shows the person it is matched to (from the population or identity match, proposed or approved, never a rejected one) and that person's recorded departure; an account with no match says so.
- **Carried by later clauses.** Done covers every source that exists today (directory connectors and uploaded account lists). APPS-001 inherits the obligation before it ships: its app-level account connectors join campaigns as source-observed populations with in-app roles and MFA, and their revocations close only on source readback; LIFECYCLE-001 and HRIS-001 carry departures from their own sources.

**Acceptance.**
1. Start a quarterly review from Access Reviews, have two resource owners decide on employee, guest and privileged service access, and leave one decision overdue.
2. Request revocation, keep the source account active and inspect unresolved work.
3. Revoke in the source and re-test; export complete decisions, population and period evidence.
4. Add an unconnected SaaS app by uploading its account list: decide revoke on a departed person's account, re-upload the list without that account, and confirm the revocation is evidenced by the new upload with both lists retained.

### Audit collaboration

#### AUDIT-001 — Period-specific auditor workspace and request lists

*Tier:* Core

**Requirement.** Auditors sign into an engagement-scoped workspace or explicitly authorized API, with independent engagements, audit periods and requested-control populations. Import or create information request lists, assign internal request owners, set due dates, discuss findings, submit exact evidence versions, and record auditor accepted/rejected/needs-more states. Track requests through resubmission and close-out without treating an upload as auditor approval. Period packs retain scope, source provenance, exceptions and request decisions. Shared continuous tests, policies and documents are reviewed directly, with no request, in the auditor evidence view (AUDIT-003).

Before shipping, this clause adds its engagement and request records to the READINESS-001 checklist, with reconciled counts and record drilldown.

Before shipping, auditor request assignments join LIFECYCLE-002 handover: a departed assignee's open requests show "owner left", are reassigned singly or in bulk with a reason, and escalate after the window.

**Acceptance.**
1. Invite an auditor to one engagement, import a request list, assign a request, comment and submit a period-specific exhibit.
2. As auditor reject it, request more evidence and accept the next submission.
3. Export the pack; another engagement and revoked auditor remain inaccessible, and the original submission and decisions remain available to authorized owners.
4. Link a second request to a continuously tested control: as auditor, the request opens the in-period test observations with their source connector and account and their observed times, and the receipts of its exhibits with their source, server receipt time and SHA-256.
5. An observation or receipt outside the engagement's period is not shown.
6. **Current native API semantics (23 October 2026):** The owner explicitly authorizes engagement-scoped native auditor identities through the documented `docs/AUDITOR-API.md` doors.
7. Only the owner submits exact existing receipts, imports request lists, assigns current people and closes accepted work.
8. Auditors append attributable comments and versioned decisions against the latest submission; an upload never counts as acceptance. All receipt intervals must fit wholly within the inclusive UTC period, and observation timestamps must fall inside it. Shared request evidence includes the original source reference, connected provider and account where available, receipt time and digest, and approved exceptions intersecting the period. Program checklists count engagement and request records separately from readiness passes. Open requests join the existing departure handover and escalation workflow. All new records join custody archives; restored grants are revoked. ct approved the dedicated native identity and grant policy on 23 October 2026 at 14:35Z. Auditors are refused at non-audit product doors and at the exact engagement-grant expiry, as asserted by the named native journey. Provider sign-in remains AUTH-001; request-free continuous review and Restricted detail remain AUDIT-003.

#### AUDIT-002 — Type II populations, sampling and non-occurrence

*Tier:* Core

**Requirement.** For a Type II or surveillance engagement, the auditor workspace generates period populations from source data for the selected period, reconciled to their sources: new hires, terminations, role changes, production changes, access-review completions, security incidents and security issues (both from ISSUES-001), vulnerability remediations, vendor reviews and backup or restore tests. Each population records source, query, retrieval time, completeness, record count and any gaps or manual rows. The auditor records sample selections, either picked or seeded random with the seed retained. Each sample opens its own evidence request (AUDIT-001) linked to the exact population record. A control whose triggering event never occurred in the period is recorded as a non-occurrence, supported by evidence of the empty population (for example, zero incidents with source completeness). The incidents population is complete only when every configured ISSUES-001 incident source was read completely for the whole period. A non-occurrence is never shown or exported as a passing operating test. A population whose source read was incomplete cannot be marked complete. Its vulnerability-remediation population includes the VULN-002 penetration-test findings with their manual provenance, fixed due dates and retest decisions.

**Acceptance.**
1. As auditor on a Type II engagement, generate the terminations population for the period and reconcile its count and identities with the connected HRIS.
2. Select five samples with a recorded seed: five per-sample requests open with owners.
3. Satisfy four, and leave one rejected and resubmitted.
4. With ISSUES-001 incident selectors on a Jira Cloud sandbox that holds no matching issues in the period, generate the incidents population: zero records with complete source reads, recorded as a non-occurrence.
5. Readiness and the exported pack show it as a non-occurrence, never a pass, and a request to mark it passing is refused.
6. Revoke HRIS read scope mid-period and regenerate: the population shows incomplete and cannot be closed.
7. Export the population CSV with its retrieval metadata and sample decisions.

#### AUDIT-003 — Auditor review of continuous test evidence for the period

*Tier:* Core

**Requirement.** Continuously tested controls need no request: the auditor reviews them directly inside the engagement.
- **Sharing.** The owner shares chosen controls, tests, policies and documents into an AUDIT-001 engagement. Unsharing removes the auditor's access from then on and is recorded.
- **What the auditor sees.** For each shared test:
  - its criteria and every LIBRARY-001 revision in force during the audit period;
  - the in-scope resource population across the period, with assets added or removed and their dates;
  - every observation inside the period with its result, and every stale or unknown interval (TEST-001);
  - per-item REMEDY-002 SLA status (within SLA, SLA missed or resolved), approved exceptions with approver and expiry, and linked remediation;
  - a Test evidence panel stating what validates the test: criteria, source connector and account, population and exhibits.

  Nothing outside the audit period or the shared scope is shown in the page or returned by the API.
- **Pre-period failures.** An item that failed before the period and was still failing at its start appears from the start of the period. An item that failed and was verified fixed before the period began is not an in-period observation, but it is listed separately, labeled "remediated before period" with its dates, so the auditor sees it.
- **Detail level.** Full shows every population attribute. Restricted hides the attributes the owner selects (for example personal emails, IP addresses or resource tags) and replaces hidden identifiers with stable pseudonyms that stay consistent across tests within the engagement. The level is fixed when the engagement is created, shown to the auditor and recorded in the pack; another level needs a new engagement.
- **Auditor decisions.** For each shared test and document, the auditor records accepted, flagged (with a required comment) or not applicable (with a reason). Owners can reply. Decisions are attributable and versioned, are kept separate from AUDIT-001 request decisions, and never change a test result, observation, mapping or readiness pass. Flags appear to the owner in readiness with their comments.
- **Preview.** The owner can preview the engagement as the auditor: the same server-side projection, read-only, with the preview recorded.
- **Pack.** The exported period pack contains the shared scope, the detail level, each shared test's in-period observations and SLA status at that detail level, and every auditor decision. Auditor views are recorded in the product action audit (LOG-001).

Before shipping, this clause adds attributable auditor-decision flags and their source/comment drilldown to READINESS-001; auditor decisions never create a readiness pass.

**Acceptance.**
1. Create a Type II engagement with a Restricted detail level that hides user emails, and share three automated tests and one policy.
2. In the period, one test has a mid-period failure, one has a stale interval, and one has an item remediated before the period began.
3. As auditor, open each test: only in-period observations and in-scope resources appear, including the mid-period failure and the stale interval, with SLA status per item and emails replaced by pseudonyms.
4. The pre-period item appears only in its "remediated before period" list.
5. Flag one test with a comment and accept the others: the flagged test's result and readiness are unchanged, and the decisions appear in the exported pack with the detail level.
6. The owner's preview matches the auditor's view field for field.
7. Requests for an unshared test and for an out-of-period observation are refused at the HTTP door.
8. Unshare the policy: the auditor can no longer open it, and the unsharing is recorded.

### Customer assurance

#### TRUST-001 — Published and permissioned trust center

*Tier:* Core

**Requirement.** A branded customer trust center publishes owner-approved security posture, frameworks, subprocessors and dated assurance statements with a custom domain. Updates, subscribers and subprocessor-change notices are TRUST-003. Restricted documents support access requests, reviewed recipients, NDA execution through a recorded in-product click-through NDA or through DocuSign or Dropbox Sign, CRM-driven auto-approval and live control status (TRUST-002), cited visitor Q&A (TRUST-004), expiry, download audit and revocation. Public, approved-customer and auditor scopes remain distinct; publishing never exposes raw connector or personnel data. A revoked grant cannot recall a previously downloaded copy.

Before shipping, this clause adds its trust publication and access records to the READINESS-001 checklist, with reconciled counts and record drilldown.

**Acceptance.**
1. Publish an approved statement, request a restricted SOC 2 report as a prospect, complete an NDA through each named e-signature integration, approve one recipient and deny another.
2. Check expiry/revocation, downloads and custom-domain access from a signed-out browser.
3. An unapproved draft and another prospect’s documents never appear.

#### TRUST-002 — CRM-driven access, click-through NDA and live control status

*Tier:* Core

**Requirement.** - **CRM auto-approval.** Salesforce and HubSpot integrations let owners define auto-approval rules. An access requester whose email or domain matches a contact or account, optionally gated by an account field such as a checkbox or stage, is approved for the mapped document tags. A rule may treat a customer as already under NDA when the owner marks that account's NDA as on file. CRM fields map to document tags. Every auto-approval records the rule, the CRM record and revision it matched, and the time, and rules stop matching when the CRM record changes.
- **Click-through NDA.** An owner-approved NDA version is presented in product. The requester's name, email, company, NDA version, time, IP address and explicit assent are recorded as an immutable acceptance and exported on request.
- **Live control status.** Owners choose control categories to publish as live status (for example access control, encryption, logging, vulnerability management). Each category reflects its linked tests. When any linked test fails or its observation becomes stale beyond the cadence, the category drops to "under review" on the next page render, without exposing resource-level detail. It returns to "monitored" only after a passing re-test. The page shows the time of the last successful check.

**Acceptance.**
1. Connect Salesforce and HubSpot sandboxes and create one auto-approval rule in each.
2. A prospect whose domain matches a gated Salesforce account is auto-approved for SOC 2 tags with the matched record shown.
3. A matching HubSpot contact is approved under that rule.
4. A non-matching requester is queued for review.
5. Clear the Salesforce checkbox: the next request is no longer auto-approved.
6. Complete a click-through NDA as a new requester and inspect its acceptance record.
7. Publish live status for an access-control category, then fail its linked MFA test: a signed-out browser sees "under review" with no resource detail.
8. Pass the re-test: the category shows monitored again. A stale collector also drops the category to "under review".

#### TRUST-003 — Trust-center updates, subscribers and subprocessor-change notices

*Tier:* Core

**Requirement.** Customers' DPAs oblige advance notice of subprocessor changes, and the trust center is how that notice is given and proven.
- **Update feed.** Owners publish updates in Compliance, Incidents, Security, Privacy and Subprocessors categories, plus owner-defined ones. Each update is drafted, approved by a named owner, and published with a date and a visibility of public or approved customers (TRUST-001). Incident updates are written by the owner; Evidence does not run incident response (BOUNDARY-001).
- **Subscribers.** Signed-out visitors subscribe by email per category with double opt-in confirmation. Owners add subscribers by email, recorded as owner-added with a reason such as a contractual notice obligation, and approved customers can be subscribed to subprocessor notices automatically. Every message carries a one-click unsubscribe, honored immediately, and the business's postal address (CAN-SPAM). The subscriber list exports with each address's consent source and history.
- **Notifications.** Publishing an update can send an owner-approved notification to that category's subscribers through the FOLLOWUP-001 email provider. Each subscriber's outcome is recorded as pending, delivered, bounced, failed or uncertain. Unsubscribed and unconfirmed addresses never receive a message.
- **Subprocessor-change notices.** Adding, removing or changing a subprocessor in the TRUST-001 list creates a notice draft with name, purpose, data categories, location and effective date. The owner sets the notice period (default 30 days), and the public list shows the pending change and its effective date until the change takes effect. Approving the notice sends it, and the change becomes active only on its effective date. The notice record keeps its approval, send time, effective date and per-subscriber delivery outcome as DPA evidence.

**Acceptance.**
1. Subscribe a signed-out visitor to Subprocessors and confirm the double opt-in.
2. The owner adds a second subscriber by email with a reason, and a third subscribes and then unsubscribes.
3. Add a subprocessor with an effective date 30 days out and draft its notice.
4. Publishing without approval is refused.
5. Approve it: the notice is sent, and delivery is recorded per subscriber, including one bounce simulated at the network edge.
6. The unsubscribed address receives nothing.
7. The public list shows the pending subprocessor with its effective date, and after that date it shows as active.
8. Publish one Security update publicly and one only to approved customers: a signed-out browser sees only the public one. Export the notice record with per-subscriber outcomes.

#### TRUST-005 — Customer-facing publication and confirmation notifications

*Tier:* Core

**Requirement.** The ct ruling of 25 October 2026 at 20:08Z carries this notification obligation separately. Customer-facing sends require enabled owner publication authorization; visitor confirmations also require the enabled confirmation authorization at consent activation. Both start disabled. The notification and consent duties above apply through these customer-facing doors. TRUST-003 retains owner-only reasoned, expiring, named-record read and submit grants, one-time links stored only as hashes, and audited uses. TRUST-001 and TRUST-002 keep their inherited duties.

**Acceptance.**
1. `tests/trust.mjs` runs `trustJourney` in `tests/helpers/trust-journey.mjs` for Resend and SendGrid.
2. It proves disabled-by-default owner authorization, exact approved category content, required postal address and withdrawal, public and named-record recipient scope, excluded unconfirmed, withdrawn, expired, revoked and out-of-record recipients, all five retained delivery outcomes, signed events, replay deduplication and forgery refusal, restart deduplication and inactive restore.
3. Visitor requests require explicit confirmation; GET, duplicate requests, stale or reused links, withdrawal and disabled owner authorization cannot establish new consent.
4. Consent history survives custody restore.
5. `tests/trust-browser.mjs` proves request, confirmation and withdrawal end states, public and customer feeds and owner notice evidence at 1440 and 390.
6. Mail edges are controlled; no new live-provider proof is claimed.
7. Current evidence: —.

#### TRUST-004 — Cited visitor Q&A on the trust center

*Tier:* Core

**Requirement.** Visitors can ask questions in plain language on the trust page. Answers are drafted only from content published to that visitor's scope, plus approved answer-library entries (ANSWER-001) the owner has marked trust-shareable:
- **Scope.** A signed-out visitor is answered from public content. An approved visitor is also answered from the documents their TRUST-001 grant covers. The assistant never reveals restricted content without the grant, and never returns raw connector, personnel or other customers' data.
- **Citations.** Every answer cites the published statement, document page or library entry it relies on, and states the date of that source. Live status questions reflect TRUST-002 categories.
- **Unanswerable questions.** A question the visitor's scope cannot answer is not answered. The visitor is offered an access request for a restricted document or can route the question to the owner with their email. The owner's approved reply goes to the visitor and can be promoted into the library.
- **Control.** The owner can turn Q&A off and reviews a log of every question, answer and citation. Withdrawing publication or revoking a grant stops answers from that source immediately. Instructions inside a visitor's question never widen scope.

**Acceptance.**
1. As a signed-out visitor, ask about encryption at rest: the answer cites the public statement and its date.
2. Ask a question answerable only from the restricted SOC 2 report: no restricted content appears, and an access request is offered.
3. As an approved visitor, ask the same question: the answer cites the report page.
4. Ask a question no source covers: nothing is drafted, and the question is routed to the owner, who approves a reply; the next visitor who asks gets the cited library answer.
5. Withdraw the report: the approved visitor's next answer no longer cites it.
6. Ask the assistant to ignore its rules and list other customers or unpublished documents: it refuses.
7. The owner's log shows every exchange.

#### ANSWER-002 — Portal and web-form questionnaire capture and fill-back

*Tier:* Core

**Requirement.** A browser extension for Chrome, Microsoft Edge and Brave, signed in to the owner's installation with a scoped token, scans a customer procurement portal or web-form questionnaire across all its pages and sections. It imports each question with its page, field identifier, answer type (text, choice, multi-select, yes/no, file upload) and allowed options into a questionnaire record. Drafting, citation and approval then follow ANSWER-001. Fill-back writes only the exact approved answer revision into the matching field, attaches only approved documents, and never submits the portal form on the user's behalf. Before filling, the extension re-scans the page. A field that was added, removed, re-typed or whose options changed since capture is not filled; it is listed for re-capture and review. An unapproved, stale (AGENT-005) or edited answer is refused.

**Acceptance.**
1. On a test portal of at least three pages with text, single-choice, multi-select and file fields, capture the questionnaire with the extension in Chrome, Edge and Brave.
2. All fields import with page and type.
3. Draft and approve answers in Questionnaires, leaving one answer unapproved.
4. Change one choice field's options on the portal, then run fill-back: every approved, unchanged field fills with the exact approved text, the changed field and the unapproved answer are refused with reasons, and the form is not submitted.
5. Re-capture the changed field, approve its answer and complete the fill.
6. The questionnaire history shows capture time, page structure and every fill.

#### ANSWER-003 — Questionnaire collaboration, PDF capture and answer-library import

*Tier:* Core

**Requirement.** Large questionnaires are answered by several people, arrive as PDFs, and build on hundreds of answers a buyer already has. Three capabilities cover this:
- **Per-question collaboration.** Each questionnaire has a primary owner. The owner assigns individual questions or whole sections to teammates (control owners and contributors under AUTH-001) with due dates. Assignees are notified in Evidence, by email, and in Slack or Microsoft Teams (FOLLOWUP-001). They can answer in Evidence or directly from the Slack or Teams message. An answer from any channel arrives as a draft that must carry ANSWER-001 citations or be flagged, and it still needs the named reviewer's approval. Progress is shown per assignee, and overdue assignments escalate.
- **PDF questionnaire capture.** Upload a text PDF, or a scanned PDF read by OCR. Evidence extracts each question with its section, numbering, order and page reference. The owner reviews the extracted list, merging or splitting questions, before drafting. The original PDF is kept as an exhibit. Answers export as a DOCX, XLSX or PDF answer document in the original question order with question numbers.
- **Answer-library import.** Bulk-import past completed questionnaires (XLSX, CSV, DOCX or PDF) or a question-and-answer CSV, with column mapping, a dry run and duplicate detection, plus reference documents kept as exhibits. Imported entries are labeled imported with source file and date, and are searchable in the library. ANSWER-001 cannot reuse an imported answer as cited until it is re-cited to current sources or re-approved by a named reviewer.

Before shipping, this clause adds questionnaire assignment completion records to the READINESS-001 checklist, with reconciled counts and record drilldown.

Before shipping, questionnaire assignments join LIFECYCLE-002 handover: a departed assignee's open assignments show "owner left", are reassigned singly or in bulk with a reason, and escalate after the window.

**Acceptance.**
1. Split a full-length SIG Lite across three assignees with due dates.
2. One answers a question from a Slack message: the answer arrives as an uncited draft that is flagged until a citation is added, and it awaits reviewer approval.
3. Let one assignment pass its due date: it escalates.
4. Upload a 40-question PDF customer questionnaire: questions extract in order with section and page; merge one wrongly split question; draft and approve; export an answer document whose question order and numbering match the PDF.
5. Import a prior completed XLSX questionnaire: its answers appear in the library labeled imported and unverified, a draft cannot cite one until it is re-cited or re-approved, and after re-approval it can be reused.

### Portability and migration

#### MIGRATE-001 — Switch from Vanta, Drata and Secureframe

*Tier:* Core

**Requirement.** Guided migration separately supports Vanta, Drata and Secureframe exports and authorized APIs for available framework scope, mappings, controls, test history, policies/attestations, people, vendors/risks, audit requests, trust/questionnaire content and original exhibits. Preview counts, field mappings, unsupported records and absent export fields; resolve identity/owner conflicts before admission. Preserve original IDs, timestamps, source and audit periods as imported provenance, never fabricated live observations. Reconcile totals and bytes, undo admitted links without deleting source custody, and explicitly reauthorize connectors and external access.

MIGRATE-001 carries OPEN-001’s incumbent-switching obligation: open-source availability alone does not prove a completed switch.

**Current semantics (22 October 2026):** Vanta and Secureframe are read from the API list responses the owner captured (Vanta Manage and Auditor APIs, `results.data` pages; the Secureframe API, `data` pages), one ZIP per incumbent, with required fields, nullability and enums taken from each provider's published reference; Drata is read from its evidence package. A malformed page refuses the ZIP; a malformed record is refused alone. For each of the ten record classes the preview and the post-approval reconciliation show source, admitted, unsupported and refused counts with every reason: *refused* is a record that is invalid or inconsistent inside the export (a failed schema check, a duplicate source id, a mapping to an absent record, file bytes that the export lists but does not hold), *unsupported* is a record the incumbent exports that Evidence cannot carry (a deleted file, a document with no file, evidence metadata with no downloadable bytes, a remediation task that is not an access-review item, a control resolved onto an existing proof requirement), and a class the incumbent's API or package does not export at all is named as not exported with an authorized API or manual route. Admitted records are retained history in the immutable import additions (with a live link that undo removes), labeled imported with the incumbent, original ids, original timestamps, a hash of the source record and the export date (or "not stated"); they are never verified, never current proof, never a source observation, and never change People, Vendors, Risks, Policies, tests or connections. People who share an email in the export, or whose email matches a person already in People, are decided by the owner (same person, different people, or link to the existing person, with no People change) before the mapping can be saved. Drata's evidence package carries no people, so its duplicate-identity step is a source control that duplicates an existing proof requirement, resolved onto it. Exhibits keep their bytes and SHA-256 in the retained ZIP and download from the import. Export (JSON or CSV) and every import action are audited with revision. Reconnecting a source starts fresh observations that stay separate from imported history; credentials are never read from a ZIP, and connectors and external access are reauthorized by the owner. ERASE-001 inherits the obligation to erase or anonymize the personal data held in imported people, vendor-contact and trust-request records, and MIGRATE-002 inherits the imported test history and audit periods as its pre-cutover records.

**Acceptance.**
1. For each incumbent, use a representative authorized customer export through Move-in, preview it, resolve a duplicate identity, admit, export and undo.
2. Reconcile each record class separately, showing source count, admitted, unsupported and refused for each: - frameworks, controls and mappings; - test history; - policies with approval history and attestations; - people; - vendors; - risks; - access-review decisions; - audit requests; - trust-center and answer-library content; - original exhibits, by bytes and digest.
3. Reconnect one actual source and verify imported history stays distinct from fresh observations.
4. If an incumbent does not export a record type, the UI names it and offers an authorized API/manual mapping route without silently dropping it.
5. A switch inside an open audit period follows MIGRATE-002.

#### MIGRATE-002 — Switching in the middle of an audit period

*Tier:* Core

**Requirement.** A Type II window runs all year, so any switch falls inside a period, and the auditor needs evidence for the whole window. The owner records a cutover time per program. For an audit period that spans it, period reports, AUDIT-002 populations, samples, test history and auditor packs combine two kinds of record:
- **before cutover:** imported incumbent test history, exhibits and population records, labeled imported with the incumbent's name, original IDs and export date;
- **after cutover:** fresh source-observed and manual records.

The cutover boundary is shown explicitly in each report, in population exports (a provenance column and boundary metadata), on samples and in packs. Imported pre-cutover records can be sampled, and a request for one can be satisfied with imported evidence, with the auditor judging sufficiency; they never become source-observed. A pre-cutover interval the incumbent export does not cover shows as incomplete with its reason. It can be filled by a labeled POPULATION-001 upload, or by a back-fill read from a source that retains history (for example HRIS termination dates or repository merges), labeled source-observed with its retrieval time. The same person or event appearing on both sides of the boundary is reconciled once through a reviewable match. A gap or overlap between the last imported and first fresh observation of a test is shown, never filled. After cutover, GAP-001's rule that imported material cannot establish current proof applies unchanged.

**Acceptance.**
1. Migrate from a Vanta export dated four months into a Type II period and set the cutover.
2. Generate the terminations population across the whole period: pre-cutover rows show as imported, post-cutover rows as source-observed from the connected HRIS, the boundary is marked, and the count reconciles with no person missing or duplicated at the boundary.
3. Sample one row from each side and satisfy both requests, the pre-cutover one with imported evidence.
4. Remove one month of pre-cutover rows from the export and regenerate: that interval shows incomplete with its reason until back-filled from the HRIS.
5. Export the pack: every record carries its provenance and the boundary is visible.

#### PORTABLE-001 — Full-program transfer and Base replacement obligations

*Tier:* Core

**Requirement.** The versioned complete-product archive must extend CUSTODY-001 to every target program record: mappings/revisions, inventory, observations, policies/attestations/training, risks/vendors, remediation and delivery history, access/auditor decisions, trust/questionnaire approvals and the permanent anonymized action audit. Account for every table and blob explicitly, preserve unavailable entries and later erasure fences, and refuse unknown namespaces rather than truncate. Receiving identity, sessions, provider secrets and execution grants stay local; source schedules, writes, messages and external shares remain inactive until reauthorization. The domain archive is the recorded Evidence replacement for Base’s generic product transfer, not an assertion of full Base equivalence. Local export/restore and documented disaster recovery must work without the original hosted service.

Completion covers every capability that exists today, including its revisions, originals, unavailable bytes and execution history. The current v10 format has no total-archive ceiling: archives of any total size stream through bounded record pages, frames and file parts; individual original files retain their public-door size limits. Before shipping, PROGRAM-003, PROGRAM-004, INVENTORY-001, CLOUD-002, CODE-001, APPS-001, MONITOR-001, HRIS-001, DEVICE-001, DEVICE-002, VULN-001, ISSUES-001, VENDOR-001, VENDOR-002, VENDOR-003, LIFECYCLE-001, AUDIT-001, AUDIT-002, AUDIT-003, TRUST-001, TRUST-002, TRUST-003, TRUST-004, ANSWER-001, ANSWER-002, ANSWER-003, MIGRATE-001, MIGRATE-002, AUTH-001, ERASE-001, LOG-001, AGENT-002, AGENT-003, AGENT-004, AGENT-005, AGENT-006, AGENT-007, AI-001 each extend the portable registry, export, validation and restore to their new record classes and blobs. ERASE-001 carries authorized erasure, retention holds and anonymization; LOG-001 carries the complete action audit as further actions ship. These future records cannot silently be omitted from the archive.

A source-lineage erasure journal records the known later erasure boundary. An older archive is refused when the destination or a supplied later journal knows an erasure; a fresh destination lacking later evidence asks for the latest journal and labels recovery “erasure history unverified”. Proceeding without that journal requires explicit acknowledgement and never claims protection from unknown later erasures. Restored schedules, mail, collections, writes and shares remain behind a persistent recovery barrier until the owner authorizes the intended capability; a connector also requires fresh credentials, and authorizing one connector grants no authority to other connectors. Restored reviewer links stay permanently closed.

**Acceptance.**
1. Use the console and local archive command to export a populated program containing every current record class, over 20,000 native resource rows and over 64 MiB of original file bytes; restore offline into an empty installation with a different owner.
2. Resume a multipart upload across a Worker restart; a final-digest failure admits no business records or originals.
3. Reconcile table/blob inventory, original history, unavailable bytes and erasure fences.
4. Verify no message, source mutation or external grant replays, then explicitly reauthorize one connector.
5. Reject an unknown table and a pre-erasure archive without the required later journal.

### Access, integrity and operation

#### AUTH-001 — Roles, SSO and scoped authorization

*Tier:* Core

**Requirement.** WORK-001 tracker assignee/status writes are people-only, require mapped tracker identities/states and read-before-write conflict handling; agent credentials cannot perform them. Until delegated roles exist, only the native owner session can authorize such writes. This is a future obligation, not a claim that tracker writes exist today. Keep Base native owner authentication and same-origin mutation checks. Add administrator, compliance manager, control owner, contributor, employee, risk approver and auditor roles with engagement/team/record scope and separation of duties. SSO via Google Workspace, Microsoft Entra ID and Okta supports MFA enforcement, SCIM provisioning/deprovisioning, session revocation and audited break-glass owner access. API tokens and service identities have explicit scopes and expiry; a collector or prepare-only agent cannot approve, publish or change roles.

Before shipping, named policy approvers and the manager relation join LIFECYCLE-002: a departed approver's pending approvals are flagged for handover, and the handover request goes to the leaver's manager from the role model instead of the roster `manager_email`.

WORK-001 tracker assignee/status writes are people-only: the current owner session is the only writer. Before delegated roles ship, AUTH-001 must apply scoped human authorization to those exact HTTP doors; agent/API-token preparation never grants tracker field write authority.

**Delegated-role default adopted (26 October 2026; ct approval pending):** The owner keeps native email-link sign-in and every door. Delegation is deny by default: a door that no role names stays owner-only. Administrator and compliance manager open program work (programs, controls, frameworks, tests, policies, vendors, risks, tailoring and review settings) and the proof desk; only the owner grants administrator, restricted record areas (personnel, findings, connector-data), SCIM tokens, the second-factor requirement and invitations. Control owner and contributor reach only the controls their grants or current control assignments name (business scope follows assignments; team and control grants add more); a contributor cannot download exhibits. A risk approver reads risks and accepts residual risk only. Policy decisions, residual-risk acceptances and tailoring decisions refuse the person who drafted, assessed or prepared them. Employees keep their own tasks and auditors their engagement door; agent, API and SCIM tokens never open an owner door, and every grant, revocation, session end and refusal is audited with its reason. Single sign-on uses Base's OpenID Connect providers, offered only when their Worker bindings exist; Okta and Entra ID name a person only through the subject map SCIM fills, and a SCIM-provisioned person signs in only through their provider while the owner's email link remains the audited break-glass door. SCIM deprovisioning ends the account, sessions, subject and roles in one transaction. A required second factor refuses any provider sign-in whose ID token does not prove one. Grants, SCIM state and SSO state are authority and never travel in an archive. See `docs/ACCESS.md`. LIFECYCLE-002 inherits the role model's manager relation and named policy approvers before they ship; WORK-001 tracker writes stay owner-only until a later clause names a scoped human role for them.

**Acceptance.**
1. Sign in through native authentication and each named SSO provider; provision and deprovision a contributor via SCIM.
2. Attempt foreign-team reads, employee exports, self-approval and cross-origin writes; refuse them at HTTP doors.
3. Revoke a session/token and confirm all next requests fail while authorized control owners can submit only their scoped evidence.

#### SECURE-001 — Restricted evidence and declared external flows

*Tier:* Core

**Requirement.** Sensitive documents, personnel records, findings and connector data stay private by default, with record-level need-to-know grants, explicit redaction/publication and verified attachment downloads. Encrypt provider credentials and sensitive persisted data under documented key custody; rotate keys with recovery and loss behavior documented. Declare each outbound provider/model, purpose, exact data classes, retention, region and account in Connections before enablement. Owner-selectable model providers use minimum necessary evidence, never grant authority from source text, and do not receive secrets. Audit access and suspected data disclosures.

**Acceptance.**
1. Upload hostile HTML/SVG and a sensitive employee document, verify safe attachment handling, then try unauthorized record reads and publication.
2. Enable one model/connector only after reviewing its data flow, rotate its key and simulate unavailable custody.
3. Inspect logs and exports for secret exclusion and explicit failure; revoked access fails on the next read.
4. **Restricted-record and flow default adopted (26 October 2026; ct approval pending):** A receipt marked sensitive at upload or later is private to the owner and to named need-to-know holders (the uploader first); a delegated role without a grant sees neither the record nor its file, and each refusal is audited and listed as a suspected disclosure.
5. A reviewer folder or auditor engagement never receives a sensitive record until the owner publishes it with a reason, and withdrawing the publication ends it on the next request.
6. Personnel records, findings and connector data are restricted areas that a delegated role reaches only through an owner-issued area grant.
7. Provider credentials and model keys are AES-256-GCM ciphertext under a named custody key (`session`, or any key in `CUSTODY_KEYS`), re-sealed under the current key by an owner action, and a credential whose key is absent fails every user explicitly and is never opened with another key; exhibit bytes rely on storage-provider encryption at rest and archives carry no credentials, grants, publications or declarations.
8. A model provider is reachable only through a flow declared in Connections (provider, model, purpose, exact data classes, retention, region, account), reviewed by exact fingerprint before enablement; each call is refused before anything leaves when a data class is undeclared, the payload exceeds the minimum-necessary bound or it carries a credential, and is recorded by payload digest and size only. See `docs/KEY-CUSTODY.md`. AGENT-006 is the first purpose; later model clauses (AGENT-007, TRUST-004, ANSWER-001 drafting) inherit the declaration, refusal and custody obligations before they ship.

#### ERASE-001 — Explicit erasure, holds and restore fencing

*Tier:* Core

**Requirement.** Authorized erasure of a person, exhibit, vendor, engagement or entire business removes applicable D1 rows, R2 bytes, derivatives, model indexes, provider-side copies under our control and live grants. A reviewed legal hold discloses what is retained, why, who authorized it and when it is reviewed. Erasure overrides ordinary receipt immutability only through the dedicated audited workflow; ordinary editing still cannot delete proof. Durable receipts count deletions/anonymization by store, retain opaque audit references and fence old archives using the later source journal. External downloads and offline archives already held elsewhere cannot be recalled; buyers receive deletion requests/instructions for those custodians.

Authority (ct 22 Oct 2026). Today only the owner previews, confirms, authorizes holds and releases them. An exact preview fingerprint and typed ERASE are required, and each is audited. After AUTH-001, a scoped privacy/legal role does the same within its scope, and the owner may restrict it. A hold names its authorizer, reason and review date, never releases automatically, and is released only by an attributed person with a reason. An overdue review shows on the desk and notifies the authorizer. A hold on a person, vendor, engagement or business covers every record classified under it. Entity erasure erases every record not under a hold and keeps the held ones. The receipt lists each held item, why it is kept, who authorized the hold and its review date. Records that are not yet classified, and imported exhibits, refuse execution. The clause remains partial. Mirrored tracker comment text, including held text, belongs to this clause before that capability ships. Older archives are refused against the later lineage journal, as PORTABLE-001 specifies; an unverified fresh destination still requires the latest journal or its explicit unverified-history acknowledgement.

Current native hold classification: an engagement covers exhibits under its selected controls and its submitted receipts, including historical custody after close-out. Review dates are inclusive UTC days; a still-active hold becomes overdue the following UTC day. The owner desk and Privacy disclose it, while the existing schedule and mail recovery barriers govern a single content-free notice to its original active authorizer. Released holds are never notified.

Current native classification: Owner-audited, append-only exhibit classifications now attach a person, vendor or engagement without granting access. Matching entity holds follow each classified exhibit in preview and atomic confirmation; unrelated entity holds do not. Classifications, hold history and pending-deletion fences survive custody restore.

**Acceptance.**
1. In Privacy, preview and confirm each entity and business erasure with linked imports, mirrored tracker comment text (including held text), receipts, blobs and active shares.
2. Verify exact stored bytes/derivatives disappear, all grants fail, held items are disclosed and actor references anonymize.
3. Restore a pre-erasure archive with the later journal: erased content and authority cannot resurrect.
4. Interrupt a provider deletion and inspect pending work rather than a false completion.
5. Also (ct 22 Oct 2026): a hold on an engagement blocks erasure of its exhibit.
6. A person erasure with one held exhibit erases the rest and its receipt discloses the held one.
7. A hold past its review date shows overdue and is still active.
8. A non-owner without the scoped role is refused every privacy door.

#### LOG-001 — Permanent accountable action audit

*Tier:* Core

**Requirement.** An append-only product audit records authentication/authorization changes, control/scope revisions, observations, evidence access and replacement, import/undo, approvals, source mutations, sends, exports and erasures with actor or scoped agent, subject, time, reason, exact revision and durable outcome. No raw credentials or token-bearing URLs enter it. Failed/uncertain operations and later resolution remain distinguishable; erasure anonymizes actors without removing accountability. The audit travels in product archives and authorized reports.

Completion covers every action that exists today. The reason is the one the actor entered where the door asks for one; the revision is the subject's exact stored revision, version or edition that the action produced or acted on (control, requirement, framework, test, policy, course, risk method, library, collector, program edition, inventory decision, agent proposal snapshot). Both stay empty where the door asks no reason or the subject keeps no revisions, and entries recorded before reasons and revisions were kept stay empty; nothing rewrites a stored entry. Authentication and authorization changes through the sign-in, first-run and owner-claim doors are recorded by what they changed (sessions started or ended, operators added, role, status, email or display-name changes), attributed to the operator concerned or the signed-in requester; a write there that changes none of these is recorded by its door (method and path) and answer, and an unauthenticated one as "Unauthenticated request". Every follow-up delivery attempt is recorded with its outcome. An uncertain delivery stays uncertain and is never resent; the owner records once, with a reason, whether it was later found delivered or not delivered, as a separate entry beside the original. A restore keeps every entry; audit entries of the destination's own authentication (`auth.*`) do not make a restore destination non-empty. Person erasure is not implemented yet: ERASE-001 carries actor anonymization in this audit (an erased actor shows as anonymous while each entry stays attributable to an opaque reference) before it ships, and each future clause that adds a sensitive action (AUTH-001, ERASE-001, FOLLOWUP-002, AUDIT-001, AUDIT-002, TRUST-001, TRUST-002, VENDOR-001, VENDOR-002, MIGRATE-001, AGENT-003, AGENT-004, AGENT-005) records it here with actor, reason, revision and outcome before it ships.

**Acceptance.**
1. Perform an import/undo, folder read/refusal, approval, source change, failed send and erasure through their public doors.
2. Inspect and export the audit, restart, then restore.
3. Every attempted sensitive action and its outcome remains attributable without secrets; an erased actor is anonymous and an interrupted send remains uncertain until resolved.

#### OPS-001 — Durable operation, health and recovery

*Tier:* Core

**Requirement.** Preserve Base setup, origin-bound owner admission, CLI lifecycle, health and deploy boundaries. Required configuration failures name the setting without its value and fail closed. Scheduled work uses durable claims, bounded execution, crash reconciliation and visible failed/unknown outcomes; restarts never manufacture observations or silently discard obligations. Operators see connector health, storage/queue limits, backup status and last successful collection. Test backup restoration and upgrades with retained migrations; limits refuse work explicitly rather than truncate evidence. Estimated operating costs and optional provider/module charges are itemized in USD before enablement.

**Acceptance.**
1. Use documented setup/dev/build commands, omit a required setting, restart during a collection and notification, and interrupt storage.
2. Inspect health and durable outcomes, recover from a complete backup and apply an additive migration without changing historical evidence.
3. Attempt a documented size bound and inspect explicit refusal and the USD cost/configuration explanation.
4. Completion covers every operation and provider door shipped today.
5. COLLECTION-001, CLOUD-002, CODE-001, APPS-001, MONITOR-001, HRIS-001, DEVICE-001, VULN-001, ISSUES-001, LIFECYCLE-001, AUTH-001 and AGENT-002..007 inherit named configuration refusals, bounded/cancellable work, durable outcomes, health, recovery and preactivation USD disclosure before shipping.
6. Cron has one 60-second elapsed budget; pending claims reconcile at the inclusive 15-minute lease boundary.
7. Cancellation and expiry fence later D1 writes and cancel provider requests; effects already submitted to a provider or R2 may remain unknown and require inspection, never a fabricated success.
8. Operational history is archived; running attempts restore as Unknown without replay. An external backup copy is labeled unverified until separately checked.

#### MOBILE-001 — Responsive and accessible complete workflows

*Tier:* Core

**Requirement.** At 1440 and 390 pixels, owners, employees and auditors can complete their authorized jobs: readiness and source failures, remediation, evidence upload/download, attestations/training, access reviews, requests, trust access and questionnaire approval. Keyboard/screen-reader labels, focus, text status and error recovery meet WCAG 2.2 AA, with zero axe-core violations under the wcag2a, wcag2aa, wcag21aa and wcag22aa rule tags on every listed end state. Browser/mobile file and camera upload are supported with the same custody checks; task links reopen the exact authorized record. Mobile sessions and notifications obey the same privacy and revocation rules.

**Acceptance.**
1. With realistic program data, use desktop and phone browsers to complete each role’s journey, upload a phone file/photo, resolve an error and return from a task notification.
2. Inspect every end state at both widths, run axe-core with the WCAG 2.2 AA rule tags on each end state at 1440 and 390 pixels with zero violations, and complete each role's journey by a scripted keyboard-only run (no pointer events) that reaches the same end state.
3. Spot-check with VoiceOver and NVDA, and verify no hidden controls, color-only states or cross-role disclosures.

#### PUBLIC-001 — Preserve the approved installation and run surfaces

*Tier:* Core

**Requirement.** The separate static run site retains its approved homepage, `/run` installation instructions and repository Markdown guides without requiring JavaScript. Installed `/` remains Base’s Lobby, with setup-state-aware Finish setup or Sign in. Existing sign-in, setup, proof, folder, archive, move-in and agent surfaces keep the approved styling. This target contract does not itself change those screens or claim unbuilt workflows are present.

**Acceptance.**
1. Build the run site, follow the homepage Run/docs links without JavaScript, and inspect installed Lobby before and after setup.
2. Existing browser journeys inspect the approved owner/reviewer flows at 1440 and 390.
3. `tests/site.mjs`, `tests/evidence.mjs`, `tests/browser.mjs` and `tests/review-browser.mjs` are the existing checks.

#### OPEN-001 — Free and open source under the MIT license

*Tier:* Core

**Requirement.** Evidence is free and open source under the MIT license: the repository's license and the package metadata declare MIT, and anyone may run, modify and redistribute it. Every capability that exists today is available in the open-source product with no license key, seat, framework or connector cap, paid gate or upgrade prompt from Evidence's authors. Paid third-party services a buyer connects (hosting on the buyer's Cloudflare account, email delivery, model providers, KnowBe4, e-signature and the named SaaS sources) are billed by those providers, and Evidence names that provider cost in USD before the connection is enabled (OPS-001). Future capabilities and provider doors under COLLECTION-001, CLOUD-002, CODE-001, APPS-001, MONITOR-001, HRIS-001, DEVICE-001, VULN-001, ISSUES-001, WORK-001, TRUST-001..004, ANSWER-001..003, AGENT-002..007 and AI-001 inherit the same no-gate and preactivation USD-disclosure obligations before shipping. MIGRATE-001 owns switching from Vanta, Drata and Secureframe; it is not affiliated with them, and it never claims to certify anyone (BOUNDARY-001).

**Acceptance.**
1. Verify the repository's `LICENSE` is the MIT license and the package metadata declares MIT.
2. Install from the public source with no account or key from Evidence's authors and reach every product area, with all four core programs and 250 people, without a payment, upgrade or license prompt.
3. Begin enabling a paid provider connection and verify its cost is shown in USD as that provider's before activation.

#### OWN-001 — Run on your own computer or Cloudflare account, with your evidence in your own database

*Tier:* Core

**Requirement.** One command starts Evidence on any computer or server the buyer controls (`npx -y @runeditrun/rer dev just-every/run-evidence`), with no Evidence account, Cloudflare account or model key needed. `rer deploy` puts it on the buyer's own Cloudflare account. Either way, every control, test result, observation, policy, receipt and exhibit lives in that installation's own D1 database and R2 bucket, which the buyer holds: a local installation keeps them under its checkout across restarts, and a hosted one keeps them in the buyer's account. Evidence's authors run no service the installation depends on and receive none of its data; the only outbound calls go to the providers the owner has connected and declared (SECURE-001). The complete archive (CUSTODY-001, PORTABLE-001) exports and restores without the original installation.

**Acceptance.**
1. On a clean macOS and a clean Ubuntu machine, run the one-line start: Evidence opens its private link, first-run setup completes, and an uploaded receipt and a test result survive a stop and restart, held in the local D1 and R2 files under the checkout.
2. With every connector off, record every outbound request for an hour of use: none goes to a host run by Evidence's authors.
3. Deploy with `rer deploy` to a sandbox Cloudflare account: the D1 database and R2 bucket are in that account, and the deployment serves the restored archive of the local installation with every record and byte reconciled.

### Honest product boundaries

#### BOUNDARY-001 — US-first scope and independent specialist services

*Tier:* Core

**Requirement.** Evidence is the owned compliance automation and customer-assurance product, replacing the program work bought from Vanta, Drata and Secureframe and advancing beyond the Comp AI, Sprinto and Delve comparison set. US-first means USD commercial/cost disclosures, US business calendars, employee and 1099-contractor populations, and US-first framework applicability. It prepares SOC 2/ISO/HIPAA/PCI evidence; an independent US CPA issues a SOC 2 attestation, an accredited certification body decides ISO 27001, ISO 27701 and ISO 42001 certification, a PCI QSA or the merchant signs the AOC, a C3PAO assesses CMMC Level 2, a FedRAMP 3PAO and agency sponsor decide authorization, an authorized HITRUST assessor submits HITRUST assessments, and qualified assessors/counsel determine regulated obligations, including which US state privacy laws apply. No template, score, agent or portal guarantees certification or authorizes regulated data. Required BAAs/DPAs, regional controls and licensed framework content are explicit prerequisites to appropriate processing, not reasons to omit the program. The named MDMs manage endpoints and the named EDRs protect them; the named scanners and code-security tools find vulnerabilities; HRIS, identity systems and the SaaS apps themselves operate staff and accounts; hosting platforms run production; independent testers perform penetration tests, whose findings Evidence imports (VULN-002); approved executor services perform heavy scans. General project work stays in Vector; incident response stays in the buyer’s tracker and incident tooling, whose security issues and incident records Evidence reads as evidence (ISSUES-001); the named observability tools run monitoring and alerting, whose configuration Evidence reads (MONITOR-001); and general file collaboration stays in [Chest](https://github.com/just-every/run-chest). Related independent RunEditRun siblings: [Pegboard](https://github.com/just-every/run-pegboard) (work and project management) and [Porthole](https://github.com/just-every/run-porthole) (observability). Evidence integrates their records and verifies compliance obligations rather than absorbing neighboring products. Each program shows its data-processing prerequisites (the framework's agreements, licensed framework content, and regional controls for every named region outside the US) labelled as not verified by Evidence, names who decides and signs, discloses USD provider costs for hosting, mail and every connected provider, and exports an assessor handoff pack that asserts no certification. A region counts as US when its name starts with "us" followed by a separator or digit (us-east-1, us-central1, US), names the United States, or is an Azure US region (eastus, westus2, centralus); any other named region is non-US. This clause is done when every capability that exists today conforms; each future clause that adds a program, agreement, specialist handoff or customer-facing claim (PROGRAM-003, PROGRAM-004, VENDOR-001, VENDOR-002, ANSWER-001, TRUST-001, AUDIT-001) inherits the same prerequisites, no-certification and USD-disclosure obligations before it ships.

**Acceptance.**
1. Onboard a US business, choose a HIPAA/PCI scope, inspect data-processing prerequisites and assessor handoff, review USD module/provider costs, and export an evidence pack for an independent assessor.
2. Follow linked remediation to Vector and source checks to the named specialist providers.
3. No UI/report claims certification, legal sufficiency or operation of an external system without source evidence.

### Agent surface

Inherits BASE-AGENT-001 to BASE-AGENT-013. The company's policy decides every call.

| Tool | Core clauses | Classes this call can carry |
| --- | --- | --- |

## Push further

### Push further: agents accountable to the compliance job

#### AGENT-002 — Prove operation across the audit period

*Tier:* Core

**Requirement.** An agent correlates cloud configuration changes, identity/security events, deployment history and control revisions across a selected audit period. It flags controls that pass now but failed earlier, missing windows, contradictory sources and unobserved assets, and proposes attributable findings rather than a fabricated pass. Compliance owners approve control meaning and exceptions; the auditor decides evidence sufficiency. Original observations, source times and periods remain inspectable.

**Acceptance.**
1. From a period report ask the agent to investigate a control that passes its latest snapshot but had a documented mid-period privilege/merge violation and a missing event window.
2. Follow its citations to original sources; both the failure and unknown interval appear.
3. Reject its proposed exception and verify no mapping, pass or auditor decision changes.
4. **Current door and exact rules (21 October 2026).** Control → Audit-period report → Ask agent to investigate this period retains a fingerprinted investigation attributed to the requesting owner.
5. Its agent is deterministic source correlation, with no model invocation or external call.
6. It correlates the retained cloud, identity/security and deployment resource versions and observations with captured control/test revisions and historical scope; source-reported data stays source-reported.
7. The period is inclusive UTC days, clipped at the investigation time.
8. Evaluation/receipt times never impersonate a provider event timestamp: original source fields and source references remain inspectable, and absent event coverage stays unknown. Missing observation windows are per resource and start after 1.5 times the cadence in the recorded test revision. Contradictions mean opposite pass/fail results for the same exact resource ID and identical serialized criteria at equal evaluation times or strictly overlapping recorded intervals; differing criteria are not declared contradictory. Scope matches exact resource IDs; unmatched names and unobserved populations remain findings, never inferred identities. Each finding links its immutable observation, source version, scope decision or evaluated definition. Every retained source/observation remains unchanged. The owner reviews or rejects the exact investigation fingerprint with a reason. Both decisions record only a findings disposition; control meaning and expiring exceptions require their existing separate owner approvals, and the auditor retains the evidence-sufficiency decision. Investigations, decisions and original citations survive restart and custody restore without replay. Work is bounded: a projection or findings list above 5,000 rows, 100,000 comparisons, or an investigation snapshot above 512 KiB is explicitly refused before a proposal is saved; a narrower period can be selected. The source projections also refuse above 8 MiB. This clause covers every current source record door; COLLECTION-001, CODE-001, CLOUD-002, APPS-001, MONITOR-001, HRIS-001, DEVICE-001, VULN-001 and ISSUES-001 inherit retention of their source times/events and their correlation and unknown-coverage obligations before adding source capabilities. `tests/agent.mjs` (the AGENT-002 journey in `tests/helpers/period-agent-journey.mjs`) asserts cloud/identity/deployment correlation, earlier failures with latest passes, unknown intervals, contradictory reports, unmatched/unobserved assets, original citations and revisions, separate owner exception approval, unchanged mapping/observations/auditor decisions on rejection, audit history and populated custody restore. `tests/period-agent-browser.mjs` asserts the report → investigation → original source → exact decision journey at 1440 and 390.

#### AGENT-003 — Investigate, fix narrowly and re-test the real system

*Tier:* Core

**Requirement.** For a failed control, an agent investigates the linked source evidence, affected assets, configuration and repository history; proposes a minimal configuration/IaC change with rationale, risk, diff and rollback; requests an exact versioned approval or a standing low-risk grant bounded by account, resources, actions, expiry and spend. Execution uses a separate constrained writer, never collection credentials. It independently reads back and re-tests the real system, closes only verified work, and escalates residual failures or exhausted authority. Reject/revoke prevents the next action. Retain the failed observation, approved change, execution outcome, rollback and fresh proof in one chain.

**Acceptance.**
1. Fail a real sandbox control, ask the agent to investigate and propose a change, reject one revision and approve the next with one-resource authority.
2. Attempt an out-of-scope write and revoke an in-flight grant: prevent further unauthorized work.
3. Execute the permitted fix, read back from the real provider, independently re-test and verify closure without erasing the original failure.
4. A failed fix stays open with escalation and rollback evidence.

#### AGENT-004 — Maintain collectors without manufacturing evidence

*Tier:* Core

**Requirement.** An agent detects expired scopes, schema drift, stale timestamps, dropped assets and missing source coverage; diagnoses the provider/account failure and prepares a reconnect or reviewed read-only connector change. It may implement a missing connector in a sandbox and compare outputs against the authorized actual source. The owner approves code, accounts and scopes before activation; scope broadening and production writes require separate approval. No fabricated screenshots, backdating or silent exclusions can repair a gap.

**Acceptance.**
1. Break a sandbox connector scope/schema, remove an asset from a page and stale its source timestamp.
2. Ask the agent for a diagnosis and connector patch, review the diff and approve read-only scopes, then compare output with the actual source inventory.
3. Original gaps remain, and no production activation or unsupported pass happens before approval.

#### AGENT-005 — Keep customer promises current

*Tier:* Core

**Requirement.** An agent tracks dependencies from approved trust statements and questionnaire answers to controls, exhibits, policies, audit periods and customer contract commitments. Changed/failed/stale sources invalidate affected answers for reuse and prepare a cited revision plus named security/legal-owner decision. Approved recipients and exact-version publication remain human-controlled; the agent can chase internal review under authorized follow-up rules, never silently send a new security promise.

**Acceptance.**
1. Approve an answer and trust statement linked to a passing control and contract obligation, then fail the control and change the source policy.
2. Inspect invalidation, affected customer commitments and cited revision.
3. Attempt to reuse/export/send the stale answer; require a fresh authorized decision and retain the prior external version and recipient history.

#### AGENT-006 — Tailor policies, risks and structured obligations

*Tier:* Core

**Requirement.** Using authorized architecture/inventory, approved policies, customer contracts and selected regulatory text, an agent proposes tailored policy changes, risk assessments and structured control obligations with source passages, applicability assumptions, deadlines and conflicts. It distinguishes a contract promise from a framework requirement and never presents interpretation as legal advice. Security/legal owners approve exact changes before they assign work, alter scope or become published policy. Before shipping, AGENT-006 inherits CONTROL-001 mapping proposals: approve two and reject one individually; only the two approved exact revisions become framework mappings, and rejected proposals change nothing.

**Acceptance.**
1. Ask the agent to interpret a US customer security addendum and selected framework material alongside the actual asset inventory.
2. Inspect clause citations, proposed controls, policy/risk diffs and one ambiguous obligation.
3. Reject a proposed interpretation and approve another: only the approved exact revision enters the program and downstream work.
4. Current AGENT-006 semantics: local deterministic preparation uses the exact owner-selected customer requirement, imported framework/regulatory requirement, approved policy revision, recorded inventory rows and current risk method.
5. When no control hint is supplied, it recommends an existing control by shared terms across the customer passage, selected framework material and actual inventory; this is a proposal of applicability, never proof of equivalence.
6. It retains passages and source doors, assumptions, ambiguity, an ISO deadline only after an explicit by/due/no-later-than phrase in the passage, and the exact proposed control mapping, policy diff and scored risk assumptions.
7. It distinguishes a contract promise from a framework requirement and asserts no legal interpretation is authoritative.
8. Each decision names a person from People as reviewer and the exact proposal hash; that person must be the installation owner or hold administrator or compliance manager for the whole business (AUTH-001), their name is attribution and never a new authentication grant, and a delegated session cannot decide a proposal it prepared. Approval applies the mapping, an unassigned risk assessment, structured obligation and a new policy draft atomically; creator/assessment attribution names the signed-in actor, with the named reviewer retained separately in the decision; publication remains the existing separate POLICY-001 approval/publication door. Source or inventory drift requires fresh preparation. Rejection creates none of those records. No source passage authorizes outbound action or work assignment. Interpretation (26 October 2026; ct approval pending): the owner or a delegated program role can ask a model to draft the policy addition, risk, obligation text, assumptions and conflicts from the selected passages and inventory, only through the enabled policy-tailoring flow declared under SECURE-001. The call sends the selected customer passage, framework passage, approved policy text, in-scope assets, candidate control and risk method, never a secret or an exhibit file. Every model citation must quote its source verbatim or the whole proposal is refused; a deadline exists only where the source states one; the ambiguity test of the source and the model's judgement both demand explicit acknowledgement; model output grants no authority and the proposal is decided by exact hash like a deterministic one.

#### AGENT-007 — Check uploaded and captured evidence before the auditor sees it

*Tier:* Core

**Requirement.** When an exhibit is uploaded to a requirement (PROOF-001), an agent checks it against the requirement text, its control, the period and earlier accepted exhibits. It reports one of likely meets, missing element, outdated or wrong system, with citations to the exhibit's page or region and to the requirement wording. Through the Evidence browser extension (ANSWER-002), a signed-in owner or control owner can capture a screenshot of a named web-app settings page. The capture records the URL, page title, time and capturing person, and is stored as a manually-asserted exhibit labeled browser-captured, never source-observed; the same check then runs on it. The agent only proposes: it never changes an exhibit, receipt or origin, never marks a requirement satisfied, and never shares a finding with an auditor. The owner accepts or dismisses each finding; open findings appear in readiness before an engagement is shared (AUDIT-003).

**Acceptance.**
1. Upload three exhibits to a quarterly access-review requirement: one dated before the period, one missing the reviewer sign-off and one complete.
2. The agent reports outdated and missing element for the first two and likely meets for the third, and each citation resolves to the cited page and requirement wording.
3. Dismiss one finding and accept another: the receipt bytes, origin and requirement state are unchanged, and nothing is marked satisfied.
4. Capture a SaaS admin MFA settings page with the extension: the exhibit is manually-asserted and labeled browser-captured with URL and time, and it is checked.
5. Against a held-out set of 20 exhibits with an independent reviewer key, the agent's verdicts match at least 90% of the key, and zero exhibits the key marks deficient are reported as likely meets.

#### AI-001 — AI inventory and governance

*Tier:* Core

**Requirement.** Inventory AI tools, model providers, internal AI use cases, data classes, business owners, access, evaluation evidence and approved-use restrictions, discovered from these named authorized sources:
- **OAuth grants to AI apps** in Google Workspace, Microsoft Entra ID and Okta, classified against a shipped, versioned catalog of AI apps, with granted scopes and users;
- **the OpenAI organization Admin API:** members, projects, API keys and service accounts;
- **the Anthropic Admin API:** organization members, workspaces and API keys;
- **AI SDK dependencies** (for example `openai`, `@anthropic-ai/sdk`, `anthropic`, `langchain` and `@google/generative-ai`) found in dependency manifests by CODE-001;
- **AI vendors** among VENDOR-002 spend sources.

Each inventory record cites the source records that surfaced it. Link AI-specific risks, policies and control tests to the same program; flag shadow tools, unowned API keys and changed data access for human triage. Model/vendor approval and a documented evidence-sharing policy precede agent use; governance observations never imply certified model safety.

**Acceptance.**
1. Exercise every named source.
2. Grant an unapproved AI app in each of Google Workspace, Entra ID and Okta; add a member and an API key in an OpenAI organization and in an Anthropic organization; add an AI SDK to a connected repository; and record an AI vendor charge in a connected spend source.
3. Each produces an inventory record citing its source.
4. Review one tool's data access and owner, link a risk and acceptable-use policy, and approve only a bounded use case.
5. Change its permissions and revoke one API key at the provider, rerun governance checks, and inspect the reopened review and the key's revoked state on the next read.
6. An unapproved provider cannot receive evidence or execute an agent job.

## Field proof register

No field proof is recorded yet.

## Boundaries

No additional boundaries are recorded.

## Homepage claims

| # | Section | Claim | Clauses |
| --- | --- | --- | --- |
| 1 | Hero | "tests your controls around the clock" | TEST-001, LIBRARY-001 |
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
| 33 | Observation window | "Evidence tests every control around the clock and keeps each day's result with its time and source" | TEST-001, PROOF-001, LIBRARY-001 |
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
| 50 | ISO 27001 | "SOC 2, ISO 27001 and HIPAA share controls, so one passing test counts everywhere it applies" | PROGRAM-002, LIBRARY-001 |
| 51 | ISO 27001 | "Add framework · ISO 27001:2022 · 71 of 93 controls already tested", A.5.15 ← CC6.1, A.8.24 ← CC6.7, a new control with an owner | PROGRAM-001, PROGRAM-002, READINESS-001 |
| 52 | Moving in | "Coming from Vanta, Drata or Secureframe? Import controls, policies, evidence and vendors" | MIGRATE-001, IMPORT-001 |
| 53 | Moving in | "check every count before you switch" (86 controls, 18 policies, 1,412 evidence files, 37 vendors) | MIGRATE-001, IMPORT-001 |
| 54 | Limits | "Evidence is not an auditor. A licensed CPA firm still tests your controls and signs your report." | BOUNDARY-001 |
| 55 | Closing | "Open source compliance for SOC 2, ISO 27001 and HIPAA"; "Free and open source, MIT licensed" | PROGRAM-001, OPEN-001 |

## Status

Judged from the code and tests at commit `dd2c24078e57bfbccb54bb40c6dedf3a8cf18fc5` (21 October 2026). COLLECTION-001’s Azure schema, SQL coverage and pagination partial slice is asserted in this revision; earlier clause baselines remain historical below.

| Clauses | Done | Partial | Missing | Total |
| --- | ---: | ---: | ---: | ---: |
| Published | 6 | 2 | 0 | 8 |
| Target and push further | 40 | 13 | 19 | 72 |
| All | 46 | 15 | 19 | 80 |

| Clause | Title | Kind | Status | Evidence | Gap |
| --- | --- | --- | --- | --- | --- |
| `PROGRAM-001` | Framework programs and applicability | target | done | `tests/program.mjs` |  |
| `PROGRAM-003` | Framework-required program documents | target | done | `tests/program.mjs` — "PROGRAM-003: each core program generates, edits, approves, exports and reconciles its framework documents with cited sources, drift review and retained prior revisions" via `tests/helpers/program-documents-journey.mjs` (every core deliverable, cited pre-fill, approvals/exports, exhibits, SoA, HIPAA scenarios, exact SAQ A/B ids, response explanations, reviewed SAQ revision drift, originals/restore); `tests/program-documents-browser.mjs` (documents, library revision, SAQ scope/explanations/drift/AOC at 1440/390) | None for current doors. Per-SAQ mappings name their source revision; the merchant or QSA confirms against the licensed SAQ (`docs/SAQ-WORKSHEETS.md`). PROGRAM-004 inherits the document model and drift review. |
| `PROGRAM-004` | Extended and regulated programs | target | partial | `src/evidence/library/extended/`; `src/evidence/program/extended.ts`; `src/evidence/program/extended-view.ts`; `src/evidence/program/documents/privacy.ts`; `migrations/core/0058_extended_programs.sql`; `tests/program.mjs` ("PROGRAM-004: the extended and regulated programs open readiness…") via `tests/helpers/extended-programs-journey.mjs`; `tests/extended-programs-browser.mjs` (1440/390); `docs/PROGRAMS.md` | Shipped: USDP (nineteen state laws), ISO/IEC 27701:2025 and :2019, GDPR, ISO/IEC 42001:2023, NIST AI RMF 1.0, NIST CSF 2.0, NIST SP 800-53 Rev. 5 Low and Moderate, FedRAMP Rev. 5 Moderate (323 controls), CMMC Level 1 and Level 2 (SPRS worksheet) and HITRUST CSF domains. Section-level citations and provision dates for every existing USDP checklist row are carried through readiness, program export and custody restore by the named PROGRAM-004 journey (including staged opt-outs and explicit limits of the summaries). Not yet built: HITRUST CSF requirement statements and control references (licensed; readiness is by HITRUST assessment domain). |
| `LIBRARY-001` | Shipped control library, test catalog and cadence | target | done | `scripts/library-check.mjs`; `src/evidence/library/`; `src/evidence/program/library.ts`; `src/evidence/tests/engine.ts`; `src/evidence/cloud/`; `src/evidence/identity/`; `src/evidence/policy/`; `tests/program.mjs`; `tests/github.mjs`; `tests/cloud.mjs` | Live acceptance needs an account: applying the AWS Terraform snippet in a sandbox account. The hosting, app-account, vulnerability, security-issue, monitoring, HRIS and device catalogs ship with CLOUD-002, APPS-001, VULN-001, ISSUES-001, MONITOR-001, HRIS-001 and DEVICE-001 |
| `PROGRAM-002` | Reusable mappings and accountable ownership | target | done | `src/evidence/program/control.ts`; `src/evidence/program/storage.ts`; `tests/program.mjs` |  |
| `CONTROL-001` | Custom controls and testing intent | target | done | `tests/evidence.mjs`; `tests/helpers/control-journey.mjs`; `tests/helpers/framework-journey.mjs`; `tests/browser.mjs`; `tests/helpers/control-browser.mjs`; `tests/helpers/framework-browser.mjs` | Current definitions, mappings and reviewed CSV/XLSX framework import conform. AGENT-006 inherits proposal decisions before its capability ships. |
| `READINESS-001` | Readiness, trend and executive reports | target | done | `src/evidence/program/readiness.ts`; `src/evidence/program/board.ts`; `src/evidence/program/board-view.ts`; `src/evidence/program/denominator-view.ts`; `tests/readiness.mjs`; `tests/helpers/readiness-browser.mjs`; `tests/report.mjs` | Current capability readiness, denominators, daily snapshots, filters and CSV asserted; future checklist/decision integration is explicitly inherited by AUDIT-001/003, TRUST-001 and ANSWER-001/003. |
| `PROOF-001` | Immutable exhibits and attributable receipts | published | done | `src/evidence/upload.ts`; `src/evidence/storage.ts`; `src/evidence/http.ts`; `tests/evidence.mjs` — "PUBLIC-001 / AUTH-001: first-run Lobby leads to an authenticated empty owner desk"; "PROOF-001: create a requirement, store attributable bytes and refuse unsafe uploads"; "PROOF-001: replace an exhibit without rewriting facts and refuse unavailable bytes" |  |
| `GAP-001` | Honest period-specific proof coverage | published | done | `src/evidence/model.ts`; `src/evidence/storage.ts`; `tests/evidence.mjs` |  |
| `CADENCE-001` | Annual, semi-annual and anchored evidence renewal | target | done | `src/evidence/reviews/`; `tests/cadence.mjs`; `tests/training.mjs`; `tests/access.mjs` |  |
| `COLLECTION-001` | Scheduled source collection with visible failures | published | partial | Schedules/events and all twelve hosted doors: `tests/helpers/collection-schedule-journey.mjs` under `tests/github.mjs`, `tests/cloud.mjs`, `tests/clouds.mjs`, `tests/identity.mjs`, `tests/training.mjs` — "COLLECTION-001: hosted collector schedules through owner doors, Cron, browser and restore" (GitHub wraps it in its collection journey). Context, prospective revisions, timestamps, period-report access/history/missing windows and custody: `tests/github.mjs` — "COLLECTION-001: configurable elapsed schedules retain schema and pagination gaps, recover only on fresh reads, and survive restart and restore" via `tests/helpers/collection-journey.mjs`. Schema gaps/recovery: named COLLECTION-001 schema scenarios in those five provider suites. Durable cursor restart: `tests/cloud.mjs` — "COLLECTION-001: AWS resumes interrupted source pages through fresh authentication without duplicate page reads or rewritten outcomes"; `tests/clouds.mjs` — "COLLECTION-001: Azure and Google Cloud resume only the interrupted page after restart, preserve original source times and never persist unexpected provider fields"; `tests/identity.mjs` — "COLLECTION-001: every directory resumes its saved user page after restart and throttling, with no duplicate first-page read or unexpected cached fields"; `tests/training.mjs` — "COLLECTION-001: KnowBe4 malformed completion facts, repeated or exhausted pages and throttling never admit a partial completion set; recovery deduplicates originals"; GitHub collection journey above (rotation/definition invalidation too). Screens/grants/history/retained cursors at 1440/390: `tests/helpers/collection-schedule-browser.mjs`. Process interruption/no replay: `tests/ops.mjs` — "independent process death during collection and notification preserves claims and reconciles without replay". Private-source/server receipt clocks: `tests/private-collector.mjs`. | PARTIAL; the owner-only, reasoned and audited per-connection event-token default is approved with the ct 23:45Z riders above. Source-read and receipt clocks are retained; independently verified provider modification/event times remain unknown where unavailable. Live authorized sandbox journey not yet run against a live account (named Gap per ct 19 Oct); no provider verification claimed. All current hosted page loops now retain durable, authority/context-bound cursors within the documented bounds, and restore never reactivates them. |
| `CONNECT-001` | Least-privilege integration custody and custom collectors | target | done | `src/evidence/connect/`; `src/evidence/collector/`; `scripts/private-collector.mjs`; `scripts/private-collector/git.mjs`; `tests/private-collector.mjs`; `tests/github.mjs` — "CONNECT-001: authorize, collect, remediate and retire one GitHub connection"; `tests/helpers/collector-browser.mjs`; `tests/browser.mjs` |  |
| `API-001` | Public REST API for pushed resources, custom tests and program state | target | done | `tests/api.mjs` — "TEST-001 / REMEDY-002: a pushed MFA failure follows re-test, regression and prospective SLA decisions" |  |
| `CLOUD-001` | AWS, Google Cloud and Microsoft Azure | target | done | `src/evidence/cloud/`; `tests/cloud.mjs` — "CLOUD-001 / LIBRARY-001: authorize AWS, observe failures and source fixes, and retain unknown or stale coverage"; `tests/clouds.mjs` — "CLOUD-001: authorize Google Cloud and Azure, observe failures and fixes, and retain denied or removed populations" | Live acceptance needs an account: AWS organization, GCP organization, Azure tenant sandboxes for live acceptance |
| `CLOUD-002` | Heroku, Vercel, DigitalOcean, Cloudflare, Netlify, Supabase, MongoDB Atlas and Snowflake | target | missing |  | No implementing path |
| `CODE-001` | GitHub, GitLab, Bitbucket Cloud and Azure DevOps change assurance | target | partial | `tests/github.mjs`: CONNECT-001 scheduler/fix/revocation scenarios prove repository inventory, privacy, branch protection, required reviews/checks, organization enforcement and alert counts. "CODE-001: GitHub merged change reviews, exact-revision checks and deployments retain source times, gaps, cursor recovery and immutable period history" via `tests/helpers/github-history-journey.mjs`; "CODE-001: GitHub membership, MFA and owner-reviewed People matches preserve departed accounts, denied scope and source removal without merging people" via `tests/helpers/github-members-journey.mjs`; "CODE-001: GitHub SPDX package metadata enters inventory without secret fields or invented manifest revisions, retaining denied scope, removals and custody history" via `tests/helpers/github-dependencies-journey.mjs`. Those journeys include populated restore; `tests/helpers/collection-schedule-browser.mjs` proves the connection, history, identity and inventory end states at 1440/390. GitLab configuration/authority: `tests/github.mjs` — "CODE-001: GitLab owner authorization, scoped privacy and protection tests, source fixes, lost access, credential rotation and revocation"; inherited membership: "CODE-001: GitLab inherited members require explicit People matches, preserve unknown MFA and retain departed, denied and removed account history"; source history: "CODE-001: GitLab source reviews, exact-head pipelines, deployments and dependency inventory retain unknown event times, earlier failures and custody"; paging/schedules/events: "CODE-001 / COLLECTION-001: GitLab resumes the saved page after restart, refuses query-filter changes and inherits schedules, events and inactive restore" via `tests/helpers/gitlab-journey.mjs`. Bitbucket authority/configuration/membership: "CODE-001: Bitbucket requires audited admin-scope consent, reads only selected repositories, preserves unknown membership attributes and compares reviewed departures"; source history/production/custody: "CODE-001: Bitbucket real merge activity, exact-revision statuses and Pipelines readback preserve precise times, contradictory outcomes, owner production classification and custody"; paging/schedules/events: "CODE-001 / COLLECTION-001: Bitbucket resumes the interrupted restriction page, rejects altered filters and inherits schedules, events and inactive restore" via `tests/helpers/bitbucket-journey.mjs`. All run under `tests/github.mjs`; the shared browser helper proves each own end state at 1440/390. Azure DevOps scope: `tests/github.mjs` — "CODE-001: Azure DevOps reads selected immutable repositories, applies only blocking in-scope policies and preserves unknown subjects, reviewed departures and revoked authority"; source linkage/custody: "CODE-001: Azure Repos review and exact-commit statuses link to actual Pipelines release build artifacts with separate outcomes, prospective production classification and custody"; continuation/events: "CODE-001 / COLLECTION-001: Azure DevOps resumes the saved Graph page, retains denied populations and inherits schedules, events and inactive restore", via `tests/helpers/azuredevops-journey.mjs`; setup/connection/report/Identities/Inventory at 1440/390. Source findings: `tests/github.mjs` — "CODE-001: normalized GitHub dependency and secret findings retain source state, unknown coverage and custody without literal secrets or invented verified closure" via `tests/helpers/github-findings-journey.mjs` (owner/anonymous doors, source-only closure, unknown failed/malformed/absent scope, decoded durable-cursor secrecy, original versions, inactive restore and Vulnerabilities at 1440/390). `tests/helpers/code-manifests-journey.mjs`, invoked by the existing SPDX dependency scenario in `tests/github.mjs`, proves two selected repositories per provider, exact original revisions/bytes/digests, grant/rotation/revocation, denied/unsafe reads, idempotence, private downloads and inactive custody restore; `docs/CODE-MANIFESTS.md`. | Remaining: ct approval of the adopted deny-by-default owner-consent policy for private originals and custody exports; dedicated screen, recursive paths, other formats and scheduled original capture; GitLab/Bitbucket/Azure DevOps normalized vulnerability/secret findings into VULN-001; historical pre-merge outcomes when the source cannot establish them. The CONNECT-001 write-capable Bitbucket scope exception is approved with the ct 23:45Z riders above; GET-only and consent-audit proof is the named Bitbucket authority journey (tests/helpers/bitbucket-journey.mjs). Live journey not yet run against a live account (named Gap per ct 19 Oct); no provider verification claimed. |
| `IDENTITY-001` | Google Workspace, Microsoft 365, Entra ID, Okta and JumpCloud | target | done | `src/evidence/identity/`; `tests/identity.mjs` — "IDENTITY-001: authorize directory reads and evaluate the resulting account populations"; `tests/access.mjs` | Live acceptance needs an account: tenants for each directory |
| `APPS-001` | App-level account connectors for access reviews and leaver checks | target | missing |  | No implementing path |
| `MONITOR-001` | Monitoring and alerting evidence from observability tools | target | missing |  | No implementing path |
| `HRIS-001` | BambooHR, Gusto, Rippling, Justworks, Deel HR and ADP Workforce Now personnel sources | target | missing |  | No implementing path: a labeled CSV roster route exists under POPULATION-001 |
| `DEVICE-001` | MDM and EDR posture: Jamf, Intune, Kandji, JumpCloud, Addigy, NinjaOne, CrowdStrike, SentinelOne and Defender for Endpoint | target | missing |  | No implementing path |
| `DEVICE-002` | Owned read-only device monitor for computers without MDM | target | missing |  | No implementing path |
| `VULN-001` | Vulnerability findings from scanners, code and cloud-native sources | target | missing |  | No implementing path |
| `VULN-002` | Penetration-test findings with retest-verified closure | target | done | `src/evidence/vuln/`; `src/evidence/upload.ts`; `src/evidence/program/readiness.ts`; `src/evidence/archive/program.ts`; `migrations/core/0038_pentest.sql`; `tests/vulns.mjs` | Reviewed import, manual provenance, fixed SLA due dates, retest-approved closure, readiness, population export and archive custody asserted; VULN-001 (scanner-read closure), AUDIT-002 (population sampling) and AUDIT-001/AUDIT-003 (auditor pack) carry their points before they ship. |
| `ISSUES-001` | Security issues and incidents from the team's own trackers | target | missing |  | No implementing path |
| `INVENTORY-001` | Unified assets, people and ownership | target | done | `src/evidence/inventory/http.ts`; `src/evidence/inventory/storage.ts`; `src/evidence/resources.ts`; `tests/inventory.mjs`; `tests/inventory-browser.mjs`; `tests/github.mjs`; `tests/cloud.mjs`; `tests/identity.mjs` | All current sources retain reviewed canonical members and original rows; named future source/checklist clauses inherit before shipping. |
| `POPULATION-001` | Labeled CSV populations for unsupported systems | target | done | `src/evidence/population/`; `src/evidence/archive/populations.ts`; `tests/population.mjs`; `tests/helpers/population-browser.mjs`; `tests/browser.mjs`; `tests/access.mjs` | LIFECYCLE-001 carries consumption by future checklists; no checklist claimed today. |
| `TEST-001` | Continuous control tests and exception discipline | target | done | `src/evidence/tests/engine.ts`; `src/evidence/tests/catalogue.ts`; `src/evidence/tests/http.ts`; `tests/api.mjs` — "TEST-001 / REMEDY-002: a pushed MFA failure follows re-test, regression and prospective SLA decisions" |  |
| `REMEDY-001` | Failed test to verified remediation | target | done | `tests/work.mjs` |  |
| `REMEDY-002` | Remediation SLAs and automatic re-test | target | done | `src/evidence/remedy/storage.ts`; `src/evidence/work/sync.ts`; `src/evidence/tests/engine.ts`; `src/evidence/program/board.ts`; `tests/report.mjs`; `tests/work.mjs` | All current category/clock/tracker doors asserted, including overlap, policy changes, regression and CSV duration; ISSUES-001 and VULN-001 carry their source-specific clocks and outcomes before shipping. |
| `WORK-001` | Two-way remediation tickets in Vector and twelve external trackers | target | done | `src/evidence/work/`; `tests/work.mjs`; `tests/trackers.mjs`; `tests/trackers-browser.mjs` (each destination and source-comment history at 1440/390); `docs/TRACKERS.md`; `tests/trackers.mjs` — the thirteen parameterized scenarios "{provider}: authorized project, mapped create, duplicate refusal, source links, two-way comments, status/assignee polling, replay, conflicts, closure re-test and visible failures" (provider names: vector, jira, linear, github, gitlab, azure-boards, asana, shortcut, clickup, monday, basecamp, freshservice, youtrack; mapping/create, source read-back/comments, event replay, due conflicts, lost grant/deletion, closure re-test and private history), Vector page/failure/concurrent-read assertions in its matrix scenario, and "all thirteen providers and their callback credentials restore inactive without credentials or replayed source operations"; `tests/helpers/tracker-write-journey.mjs` — trackerWriteJourney (owner-origin mapped writes, conflict values/time, confirmed read-back and authority refusal); `tests/helpers/basecamp-webhook-journey.mjs` — basecampWebhookJourney (registration, source read-back, replay, wrong secret/account/project, hourly deactivation and inactive restore); `tests/work.mjs` — "WORK-001 / REMEDY-002 / WORK-002: Every current tracker gives each item its due date and re-tests only its own item within 15 minutes while both original clocks keep running" (scheduler timing, per-item isolation and preserved clocks) | Four additional authenticated webhook paths and native priority/label mappings are asserted across all thirteen destinations, with due-date conflicts (including explicit GitHub body dates), failure/recovery and restore. Basecamp owner-registered 256-bit sealed secret-address callbacks, event deduplication, account/project checks and hourly deactivation/polling backstop are now asserted. Mapped Evidence-origin assignee/status writes, source read-before-write conflicts, read-back and owner-session-only authority are asserted across all thirteen destinations. Original, attributed, bounded comment text and source links, explicit truncation, private owner-only reads, Vector cursor completeness and atomic competing-read deduplication are asserted for the current doors. Live Gap: not yet run against a live account for each destination. |
| `WORK-002` | Per-test or per-item tickets, with tracker status on tests | target | done | `src/evidence/work/granularity.ts`; `tests/work.mjs` | Live acceptance needs an account |
| `FOLLOWUP-001` | Email, Slack and Microsoft Teams follow-up | target | done | `src/evidence/followup/`; `tests/followup.mjs`; `tests/policy.mjs`; `tests/cadence.mjs`; `tests/training.mjs`; `tests/access.mjs` | Live acceptance needs an account: Slack and Teams workspaces, production mail key |
| `FOLLOWUP-002` | Failure notices with an owner and a due date in Slack, Teams or email | target | partial | `src/evidence/remedy/storage.ts`; `src/evidence/followup/opened.ts`; `src/evidence/followup/send.ts`; `src/evidence/followup/channels.ts`; `tests/failure-notices.mjs`; `tests/followup.mjs`; `tests/work.mjs` | Notice at obligation open (owner, control-owner/escalation fallback that says so), grouped per recipient with per-item due dates, first remediation step, private obligation link and WORK-001 ticket key/link, per cycle and recipient with recorded outcome, quiet-hours deferral, pause, new notice on regression, closure announced, and private-page Acknowledge/Reassign with a recorded reason are asserted. Remaining: Acknowledge/Reassign from inside the Slack or Teams message, in-place message update, live Slack and Teams sandbox acceptance. |
| `RISK-001` | Risk register and treatment lifecycle | target | done | `src/evidence/risk/storage.ts`; `src/evidence/risk/http.ts`; `tests/risk.mjs` |  |
| `RISK-002` | Shipped risk library, register import and configurable scoring | target | done | `src/evidence/risk/`; `tests/risk.mjs`; `tests/helpers/risk-browser.mjs` |  |
| `VENDOR-001` | Vendor inventory and security diligence | target | done | `tests/risk.mjs` — "VENDOR-001: onboarding, supplier link requests and per-question answers, findings, expiring conditional approval, overdue reminders and link isolation" via `tests/helpers/vendor-journey.mjs` (profile, licence/edition, typed workbooks, scoping, 1,200-question SIG Core, SSRM, completed receipt, supplier security, findings, approval, reminders, originals, restore); `tests/vendor-browser.mjs` (owner import/send and supplier answer/upload/receipt at 1440/390); `tests/cadence.mjs` | None for current doors. Licensed text is import-only; workbook limits and scoped-authoring semantics are documented in `docs/QUESTIONNAIRE-WORKBOOKS.md`. VENDOR-002 and VENDOR-003 inherit the document store and verified/unverified distinction. |
| `VENDOR-003` | Vendor document review with cited findings | target | partial | `tests/helpers/vendor-review-journey.mjs` — vendorReviewJourney, invoked by `tests/risk.mjs`: Type II metadata, auditor/opinion, exception, subservice treatment and both CUECs with exact resolving source pages; source-supported corrections retain original proposals; exact named approval/rejection and stale-decision refusal; mapped/unaddressed CUECs in readiness; bridge gap, letter and owner window; qualified findings only after approval; all named document families and native questionnaire transcript with omitted-field revisions; UTF-8 text/form-feed and blank-page citations, retained original bytes and inactive custody; ambiguous, negative, disclaimer and conflicting opinion prose plus malformed text. `tests/vendor-browser.mjs`: review list/proposal, original page, correction, named decision, CUEC/readiness and text review/source end states at 1440/390 (vendor-review-*, vendor-source-page, vendor-cuec-*, vendor-text-* captures). | Remaining: scanned/OCR and other unsupported binary document formats, documents or questionnaire transcripts beyond the stated reader/proposal bounds, and broader owner-authorized representative-source proof beyond the synthetic corpus. Readable PDF, UTF-8 text and the native submitted questionnaire source are proved; no OCR or independent supplier verification is claimed. |
| `VENDOR-002` | Vendor discovery and risk-based follow-through | target | missing |  | No implementing path |
| `POLICY-001` | Policy library, approval and version control | target | done | `src/evidence/policy/`; `src/evidence/attest/`; `tests/policy.mjs`; `tests/cadence.mjs` |  |
| `ATTEST-001` | Employee policy attestations | target | done | `src/evidence/attest/`; `src/evidence/me/http.ts`; `tests/policy.mjs` |  |
| `TRAIN-001` | Shipped security training and KnowBe4 evidence | target | partial | `tests/training.mjs` — "Courses unlock with their programs and roles and apply only once adopted; a new hire fails the assessment once, passes the retake, and both attempts are kept" (reviewed revision adoption, retained assigned curriculum across an upgrade, programs, role campaign, onboarding, annual assignment, grading and retained attempts); "Approved internal training is manual, KnowBe4 completions are source-reported and never invented, overdue learners are reminded and escalated, and a schedule change is recorded" (manual provenance, source edge, reminders, escalation, schedule and auditor exports); `tests/helpers/training-browser.mjs` — trainingBrowser (complete ten-question form, failure, retake, result retention, invitation confirmation, member navigation and completion at 1440 and 390); `tests/training.mjs` final recurring-cycle assertions (new annual obligation preserves original completion). | Real KnowBe4 sandbox completion remains unproved: no held authorized KnowBe4 reporting API key. The controlled KnowBe4 network edge is not a live sandbox receipt. |
| `LIFECYCLE-001` | Joiner, mover and leaver compliance | target | missing |  | No implementing path: departures end sign-in and close attestations; checklists, HRIS events and background checks not built |
| `LIFECYCLE-002` | Ownership handover when a person leaves | target | done | `src/evidence/handover/`; `src/evidence/attest/storage.ts`; `src/evidence/program/readiness.ts`; `src/evidence/program/control.ts`; `tests/handover.mjs` | Current departure door and every holder kind that exists today are asserted; HRIS-001 and LIFECYCLE-001 (departure sources), AUDIT-001, ANSWER-003 and AUTH-001 (assignments, approvers, manager role) carry handover before they ship. |
| `ACCESS-001` | Quarterly access-review campaigns | target | done | `src/evidence/access/`; `migrations/core/0044_access_cadence.sql`; `tests/access.mjs` | Current directory and uploaded-list sources, owner-configured cadence, People reconciliation and exhibit-evidenced revocation asserted; APPS-001 carries app-level connector populations before it ships. |
| `REVIEW-001` | Selected expiring evidence folders | published | done | `src/evidence/review/http.ts`; `src/evidence/review/storage.ts`; `tests/review.mjs` — "REVIEW-001: owner issues a scoped folder and an independent reviewer reads only its safe projection"; "REVIEW-001: closed or expired folders refuse every door, including withdrawal during disclosure"; `tests/review-browser.mjs` |  |
| `AUDIT-001` | Period-specific auditor workspace and request lists | target | done | `tests/review.mjs` — "AUDIT-001 native auditor authorization, exact submissions and retained decisions" via `tests/helpers/engagement-journey.mjs`: native invitation, independent engagement grants, atomic request import, assignment and due dates, comments, exact submissions, rejected and needs-more decisions, accepted resubmission, close-out, period pack, source connector and account, receipt time and SHA-256, excluded dates, revocation, expiry and inactive custody restore; `tests/engagement-browser.mjs` via `tests/helpers/engagement-browser.mjs`: inherited handover, program and board records at 1440 and 390; `tests/handover.mjs`: business-day handover and escalation; `tests/readiness.mjs`: readiness denominators remain independent. | None for the native explicitly authorized API. ct approved the dedicated identity and grant policy on 23 October 2026 at 14:35Z; the named journey proves non-audit-door and exact-expiry refusals. AUTH-001 retains provider sign-in; AUDIT-003 retains request-free test review and Restricted detail. |
| `AUDIT-002` | Type II populations, sampling and non-occurrence | target | missing |  | No implementing path |
| `AUDIT-003` | Auditor review of continuous test evidence for the period | target | done | `tests/review.mjs` — "AUDIT-003 request-free selected revisions, scope, preview, unsharing and inactive restore", via `tests/helpers/audit-sharing-journey.mjs`: explicit Full test, control, published policy and approved program-document shares; scope and authority refusals; retained selected revision; identical owner preview; immediate policy unsharing including a concurrent withdrawal; audited preview and unsharing; independent versioned test, policy and program-document decisions with required flag comments and not-applicable reasons, exact-decision owner replies, readiness flags with attributable comments and record drilldown, unchanged test state and readiness totals, selected-revision pack parity, restart retention and inactive-grant custody restore; exact in-period observations, retained failure after a later pass, UTC boundary and foreign-test refusals, original criteria and per-run library revision with connector and account provenance; period-bounded criteria and accepted library revision timelines including revisions with no test run; historical resource attributes, additions, removal, restoration and prospective exclusions; HTTP refusal of excluded observations; stale and unknown intervals bounded by the product clock; `tests/engagement-browser.mjs`: readiness flags and source drilldown at 1440 and 390. Additional proof: `tests/review.mjs` — "AUDIT-003 historical SLA cycles, exceptions, carry-in and pre-period remedies", via `tests/helpers/audit-remediation-journey.mjs`: original cycle policy, overlapping approved exceptions, unresolved carry-in failure, verified resolution, regression, missed SLA, linked change history, supporting exhibit provenance, and separately labeled fixes before the period without raw observations; later history cannot rewrite the period. The request-free scenario also proves Restricted hidden emails, stable pseudonyms across tests, three tests and a policy, preview and pack parity, independent flagged and accepted decisions, unchanged readiness, immediate audited unsharing and inactive-grant custody. `tests/engagement-browser.mjs`, journeys auditSharingJourney and auditRemediationJourney with engagementBrowser: Restricted auditor evidence, actual browser flag submission and read-only preview, SLA and pre-period history at 1440 and 390. | None for the current native request-free review doors. AUDIT-001 request evidence remains separately authorized; Full request evidence is never a Restricted fallback. |
| `TRUST-001` | Published and permissioned trust center | target | partial | `src/evidence/review/http.ts`; `tests/review.mjs` | Scoped expiring reviewer downloads are implemented; trust publication, customer access requests, NDA integrations and domains are missing. |
| `TRUST-002` | CRM-driven access, click-through NDA and live control status | target | missing |  | No implementing path |
| `TRUST-003` | Trust-center updates, subscribers and subprocessor-change notices | target | done | `tests/trust.mjs`, trustJourney in `tests/helpers/trust-journey.mjs`, run for Resend and SendGrid: owner-only grants (including signed-in admin refusal), mandatory reason and expiry, one-time link response and digest-only storage, exact named-record read and submit permissions, denial across records and for future records, per-record mail eligibility, attributable immutable comments, audited successful and refused uses, revocation, expiry, restart and inactive-grant custody restore. The same journey proves category double opt-in, reasoned owner-added consent, one-click withdrawal and excluded recipients, approval refusal, dated subprocessor add, change and removal, pending and active lists, public versus approved-customer feeds, consent and notice exports, signed delivered and bounced events with replay and forgery refusals. `tests/trust-browser.mjs` (also included by `tests/engagement-browser.mjs`), engagementBrowser in `tests/helpers/engagement-browser.mjs`: actual subscription, grant issuance, customer comment, read-only feed, owner overview and submission end states at 1440 and 390. `tests/live/trust-sendgrid.mjs`: actual SendGrid confirmation message e6si1SnFSU6I7-xKH6y2eA, QA receipt 9317bc9b-cd57-41a5-91c3-089d02238a6e at 2026-10-25 23:11:50Z; subprocessor notice -g9j5WIfQtihZpmmPkFCwQ, QA receipt e9b12402-ce8e-461e-893b-2c804f84196f at 23:11:57Z. Both received with SPF, DKIM and DMARC passing. | None for this clause's current scope. A send alone does not prove owner authority, reason and expiry, one-time issuance and digest-only storage, named-record rights and use audit, recipient isolation, consent transitions and excluded recipients, approval gates, notice timing and effective-date transitions, public versus customer visibility, exports, restart or inactive custody restore; each is asserted by the named native journey, with changed screens also proved by the browser journey. No live webhook URL is available: signed delivered and bounced events, replay and forged-event refusal remain network-edge assertions, as permitted. TRUST-001 and TRUST-002 retain document, NDA, domain and CRM obligations. Customer-facing publication and confirmation notifications are proved separately under TRUST-005. |
| `TRUST-005` | Customer-facing publication and confirmation notifications | target | done | `tests/trust.mjs`, trustJourney in `tests/helpers/trust-journey.mjs`, run against Resend and SendGrid network edges: initially disabled authorization and refusal, exact owner-approved category notice and postal address with one-click withdrawal, public and exact-record customer recipients, unconfirmed and withdrawn exclusion, expired and revoked grant exclusion, different-category and out-of-record exclusion, retained approvals and all five delivery outcomes, signed events with replay deduplication and forgery refusal, restart deduplication and inactive custody restore. The same journey proves explicit double opt-in, GET non-activation, repeated request deduplication, disabled-owner refusal, stale and reused links, withdrawal before and after confirmation, and retained consent history. `tests/trust-browser.mjs`, engagementBrowser in `tests/helpers/engagement-browser.mjs`: request, confirmation, withdrawal, public and customer feeds, and owner notice evidence at 1440 and 390. | None for the two native notification obligations. Only the mail network edge is controlled; no new live provider or webhook verification is claimed. TRUST-001 and TRUST-002 retain their inherited obligations. |
| `TRUST-004` | Cited visitor Q&A on the trust center | target | missing |  | No implementing path |
| `ANSWER-001` | Cited security-questionnaire completion | published | partial | `src/evidence/answer/`; `tests/agent.mjs`; `tests/helpers/answer-journey.mjs`; `tests/period-agent-browser.mjs`; `tests/helpers/assurance-browser.mjs` | CSV, first-sheet XLSX and table DOCX templates, exact policy/observation excerpts or explicit flags, named exact answer-set/recipient approval, source invalidation, template export, readiness drilldown and archive parity. Approved SOC-report passages and recursively current prior approved answers now retain exact revisions, source pages/periods and stale-parent/expiry refusal. Human-confirmed yes/no choices retain the supporting passage, mapping reason and exact decision; their buyer cells contain only the declared value, with a separately approved citation/flag manifest. Remaining: other non-text formats and automatic choice drafting, full-length licensed SIG Lite and official CAIQ benchmark with an independently held-out reviewer key and the required 90% answerable-question coverage. No answer-quality benchmark or model inference is claimed. |
| `ANSWER-002` | Portal and web-form questionnaire capture and fill-back | target | partial | `./public/portal-extension/`; `src/evidence/answer/portal.ts`; `src/evidence/answer/portal-documents.ts`; `tests/agent.mjs` invokes answerJourney and portalBrowser in `tests/helpers/answer-journey.mjs`: typed three-page capture, inbound and fill scopes, original-token isolation, exact recipient and latest revision, source invalidation, added and removed and changed fields, unapproved refusal, exact text and choices and document bytes, no submission, re-capture and fresh approval, client-reported history, inactive archive restore; native Chromium screens at 1440 and 390. `docs/PORTAL-QUESTIONNAIRES.md` documents installation and current bounds. | Native Chromium scanner and applier proof exists, but installed-extension journeys exercising browser permissions, session storage and scripting in Chrome, Microsoft Edge and Brave have not yet run. No three-browser installation or acceptance claim is made. The current extension supports standard visible native fields, explicit manual page navigation and bounded captures; embedded frames, custom controls and framework-specific change-event integration remain unsupported and are refused where detectable. |
| `ANSWER-003` | Questionnaire collaboration, PDF capture and answer-library import | target | missing |  | No implementing path |
| `IMPORT-001` | Reviewed Drata archive admission and undo | published | done | `src/evidence/import/http.ts`; `src/evidence/import/plan.ts`; `tests/import.mjs`; `docs/DRATA-IMPORT.md` |  |
| `MIGRATE-001` | Switch from Vanta, Drata and Secureframe | target | done | `src/evidence/import/`; `src/evidence/import/bundle/`; `tests/import.mjs` ("MIGRATE-001 / Vanta…", "MIGRATE-001 / Secureframe…", "A Drata control that duplicates an existing proof requirement…", "Imported receipts retain provenance…", "Undo unlinks only imported additions…") via `tests/helpers/migrate-journey.mjs`; `tests/browser.mjs` via `tests/helpers/move-in-browser.mjs` (Vanta, Secureframe and Drata Move-in at 1440/390); `docs/MOVE-IN.md` | Live acceptance needs an account: no real Vanta, Drata or Secureframe tenant has been read (named Gap, ct 19 Oct 2026); the fixtures follow each provider's published schema and no provider-verification claim is made. Evidence reads API responses the owner has captured, not a live API call. |
| `MIGRATE-002` | Switching in the middle of an audit period | target | missing |  | No implementing path |
| `CUSTODY-001` | Complete custody archive and empty-target restore | published | done | `tests/archive.mjs` |  |
| `PORTABLE-001` | Full-program transfer and Base replacement obligations | target | done | `src/evidence/archive/service.ts`; `src/evidence/archive/portable-export.ts`; `src/evidence/archive/portable-restore.ts`; `tests/archive.mjs`; `tests/helpers/portable-journey.mjs`; `tests/review-browser.mjs`; `tests/helpers/portable-browser.mjs`; `tests/vulns.mjs`; `tests/work.mjs`; `tests/import.mjs`; `tests/agent.mjs`; `tests/population.mjs`; `tests/identity.mjs`; `tests/risk.mjs`; `tests/github.mjs`; `tests/private-collector.mjs`; `tests/readiness.mjs`; `docs/BACKUP-RESTORE.md` | Current records and originals conform; named future capabilities inherit archive parity before shipping. |
| `AUTH-001` | Roles, SSO and scoped authorization | target | partial | `src/evidence/authz/`; `src/auth.server.ts`; `src/evidence/http.ts`; `src/evidence/door.ts`; `docs/ACCESS.md`; `tests/roles.mjs` — "A member with no role reaches no owner door, and every delegated role opens only the doors it names" (foreign-team reads, employee exports, cross-origin writes, role doors), "Nobody approves their own work, and a risk approver decides risks only" (self-approval), "Control owners and contributors submit only their scoped evidence, and revocation applies on the next request" (scoped submission, revoked session and grant), "Bearer and SCIM tokens never open the role door, and SCIM provisions and deprovisions a contributor who signs in through single sign-on only" (Okta, Google Workspace and Entra ID sign-in at provider fakes, SCIM provisioning for Okta and Entra ID, second factor, deprovision); `tests/live/okta-sso.mjs` with receipt `tests/live/receipts/okta-sso.json` (live Okta sandbox: SSO sign-in, SCIM provision and deprovision, second-factor refusal); `tests/email-link.mjs` (native sign-in) | Landed and proved: administrator, compliance manager, control owner, contributor and risk approver roles with business, team, control and record-area scope, separation of duties, session and grant revocation, SCIM provisioning and deprovisioning, MFA enforcement, audited break-glass and Okta sign-in against a live sandbox. Missing: the Google Workspace and Microsoft Entra ID sign-in legs against live tenants (no test tenant users are held; the code paths are proved at a provider fake only), and a live Okta push of SCIM from Okta to a public address. Delegated-role default adopted 26 October 2026; ct approval pending (see the clause). |
| `SECURE-001` | Restricted evidence and declared external flows | target | partial | `src/evidence/secure/`; `src/evidence/connect/custody.ts`; `src/evidence/upload.ts`; `src/evidence/http.ts`; `docs/KEY-CUSTODY.md`; `tests/secure.mjs` — "Hostile HTML and SVG download only as inert attachments, and a sensitive employee document stays private, opens to a need-to-know grant and fails the next read once revoked", "A sensitive record reaches a reviewer only after explicit publication, and withdrawal removes it again", "A model flow is enabled only after its exact declaration is reviewed; its key is sealed, rotated and never exported, and custody rotates and fails explicitly when its key is gone"; `tests/helpers/interpret-journey.mjs` (declared-flow gate, undeclared class, credential in payload, rotated key and unavailable custody at a call) | All acceptance points are proved through public doors. Held at partial until ct approves the restricted-record and flow default adopted 26 October 2026 (see the clause); exhibit bytes rely on storage-provider encryption and are not application-sealed. |
| `ERASE-001` | Explicit erasure, holds and restore fencing | target | partial | `src/evidence/erase/`; `tests/archive.mjs`; `tests/helpers/erasure-journey.mjs` — erasureJourney asserts audited person and vendor classifications, matching and unrelated entity holds, immutable classification custody, pending-deletion fences, interrupted R2 deletion with retained bytes and durable retry across restart, populated classification restore, submitted-exhibit engagement holds, unrelated-hold exclusion, review-date boundaries, overdue retention, authorizer notification deduplication across restart, release reasons, every current privacy door refused to a member, and populated restore; `tests/vendor-browser.mjs` — Privacy and the overdue desk at 1440 and 390; `tests/helpers/promise-journey.mjs` — promiseJourney refuses erasure of a promise-linked exhibit and preserves its original; `tests/trust-browser.mjs` — refusal at 1440 and 390 | Landed: owner-only standalone-exhibit erasure with exact preview and typed ERASE, exact-subject and business-wide holds, share revocation, pending work and retry, byte absence, restore fencing. Promise-linked exhibits now refuse standalone execution until their retained derivatives are classified; no completed erasure is claimed. Engagement holds now cascade to exhibits under selected controls and submitted exhibits, remain active when overdue, and fence concurrent confirmations and later submissions. Confirmed erasure refuses new submissions both at the owner door and inside the database transaction; custody admission preserves historical submissions. Overdue reviews appear on the owner desk and Privacy; Cron notifies the active original authorizer once per hold review date through the existing durable follow-up system. Owner-audited, append-only exhibit classifications now attach a person, vendor or engagement without granting access. Matching entity holds follow each classified exhibit in preview and atomic confirmation; unrelated entity holds do not. Classifications, hold history and pending-deletion fences survive custody restore. Not yet built: person, vendor, engagement and business execution, cascading holds for records beyond submitted or explicitly classified exhibits, partial erasure with disclosed retention, the AUTH-001 privacy and legal role, linked-import retirement, mirrored tracker comment text (including held text), actor anonymization in LOG-001, deletion of provider copies beyond the native R2 store. A restored hold whose original authorizer has no active local identity stays overdue on the desk without sending to a substitute. |
| `LOG-001` | Permanent accountable action audit | target | done | `src/evidence/door.ts`; `src/evidence/audit/`; `src/evidence/audit/auth.ts`; `src/evidence/followup/send.ts`; `src/evidence/followup/resolve.ts`; `src/evidence/import/http.ts`; `src/evidence/review/storage.ts`; `src/evidence/agent/storage.ts`; `migrations/core/0046_audit_context.sql`; `tests/import.mjs`; `tests/followup.mjs`; `tests/review.mjs`; `tests/agent.mjs`; `tests/policy.mjs`; `tests/work.mjs` | Done for every action that exists today. The owner Audit view and CSV/JSON export read the append-only product audit, reviewer folder events and agent decisions (UTC-day inclusive filters; each export is recorded) with actor, subject, time, outcome, the entered reason and the subject's exact revision. Import writes, receipt additions and replacements, refused and failed owner-door writes, sign-in/session/operator changes, every follow-up delivery attempt and the owner's later resolution of an uncertain one are recorded; restart and restore keep every entry, and v10 archives from before reasons and revisions restore with both empty. ERASE-001 carries erasure anonymization; the clauses named in the text inherit the obligation before they ship. |
| `OPS-001` | Durable operation, health and recovery | target | done | `SEED-COMMAND-CONTRACT.md`; `src/auth.server.ts`; `src/evidence/ops/`; `src/evidence/scheduler.ts`; `migrations/core/0048_operations.sql`; `docs/OPERATIONS.md`; `tests/ops.mjs`; `tests/ops-browser.mjs`; `tests/open.mjs`; `tests/browser.mjs`; `tests/evidence.mjs`; `tests/archive.mjs`; `tests/email-link.mjs` | Every current scheduled step has bounded execution, cancellable provider calls, atomic D1 claim fencing and durable outcomes. Named public-door journeys prove health/limits/backup/last collection, independent process death during collection and notification, storage interruptions, operational-history restore, retained migrations, explicit size refusal and USD disclosure. External backup copies and effects already accepted outside D1 remain honestly unverified/unknown. |
| `MOBILE-001` | Responsive and accessible complete workflows | target | partial | `tests/browser.mjs`; `tests/review-browser.mjs`; `src/evidence/view.ts`; `public/desk.css`; `public/review.css` | Existing owner/reviewer custody flows have 1440/390 browser journeys; new program/employee workflows, mobile camera validation and independent accessibility conformance are unproven. |
| `PUBLIC-001` | Preserve the approved installation and run surfaces | target | done | `tests/site.mjs`; `tests/browser.mjs` |  |
| `OPEN-001` | Free and open source under the MIT license | target | done | `LICENSE`; `package.json`; `src/evidence/costs.ts`; `docs/PROVIDER-COSTS.md`; `tests/open.mjs`; `tests/helpers/open-browser.mjs`; `tests/browser.mjs` |  |
| `OWN-001` | Run on your own computer or Cloudflare account, with your evidence in your own database | target | partial | `tests/live/own-macos.py`, Native setup and retained receipt facts, original digest and evaluated test after own-process restart: real macOS, fresh checkout and CLI home; committed harness c7c4be3d870be234c3d482998f2f2af223eb19b5, app source 3369d758fd648855637e5fabe968f8218574cad2, heavy job 20261026T011145570260Z-heavy-slot-0d8ae929 at 2026-10-26 01:13Z. The actual listener-owning runtime is identified, its shutdown and port closure are asserted before fresh start, local D1 and R2 are present, all connectors are off, and the checkout and CLI home are removed. `tests/live/own-daytona.py`: clean Ubuntu 24.04 image reached exact README startup, native setup, uploaded original and evaluated test; sandbox 34334ec5-3d15-4da6-991a-954672d2576e was deleted. `tests/live/own-hosted.mjs`: actual rer deploy in RunEditRun account b20c0ca9cab0c2b70e13d7cf724b89bd created and read back Worker evidence-own-i816-20261026, D1 2f2d460c-d97e-4948-aa6c-8825854bfe0a and R2 evidence-own-i816-20261026-exhibits; native sign-in received QA receipt c6cc86dd-c4ac-4457-b656-7bd13ec8985c at 01:16:39Z. All three resources were removed and read back absent. `tests/archive.mjs`, portableJourney in `tests/helpers/portable-journey.mjs`: complete native HTTP and offline CLI archive with 20,206 resources and 75,499,612 original bytes, corruption refusals and erasure fences; native archive and trust journeys pass after D1 batching and bounded JSON argument changes. `README.md`; `RUN-LOCALLY.md`; `deploy.json`. | Ubuntu stop and restart and the complete one-hour outbound capture remain unproved. A corrected Ubuntu rerun reached the exact start and setup, then stopped with PermissionError during runtime shutdown; sandbox 7160bbcd-908d-47f9-9b6f-d0fae60a46da was deleted. The Linux descriptor check now scopes inspection to this checkout and still refuses every unattributed kernel listener; that correction has not completed a new Ubuntu run. The first launcher-only restart messages are not acceptance proof; the corrected Mac journey above is runtime-based. Fresh checkout and CLI home on existing macOS do not establish the full clean-machine point. The live hosted archive manifest still returned 503 after the native batching changes; complete live validation, restore and every-record and original-byte reconciliation remain unproved. The provider tail returned no usable error detail. The shared hosting guide at https://runeditrun.com/docs/hosting returns 404 and remains Base-owned; the existing rer pin is retained. Held DAYTONA_API_KEY and the requested Workers Scripts Write, D1 Write and Workers R2 Storage Write groups are available, so no missing-key or missing-permission blocker is claimed. |
| `AGENT-001` | Prepare-only proposals with exact human approval | published | done | `src/evidence/agent/http.ts`; `src/evidence/agent/storage.ts`; `tests/agent.mjs`; `docs/AGENT-COMMANDS.md` |  |
| `AGENT-002` | Prove operation across the audit period | push-further | done | `src/evidence/agent/period-analysis.ts`; `src/evidence/agent/period-http.ts`; `src/evidence/agent/period-storage.ts`; `src/evidence/agent/period-archive.ts`; `tests/agent.mjs`; `tests/helpers/period-agent-journey.mjs`; `tests/period-agent-browser.mjs` | Current source doors conform; named future source clauses inherit correlation and honest unknown coverage before shipping. No model or provider event validation is claimed. |
| `AGENT-003` | Investigate, fix narrowly and re-test the real system | push-further | missing |  | No implementing path |
| `AGENT-004` | Maintain collectors without manufacturing evidence | push-further | missing |  | No implementing path |
| `AGENT-005` | Keep customer promises current | push-further | done | `tests/trust.mjs` — promiseJourney in `tests/helpers/promise-journey.mjs`, for both Resend and SendGrid: exact control, exhibit, policy, audit-period and customer-obligation dependencies; failed and stale evidence and changed policy invalidation; affected commitments and cited revisions; stale answer reuse, buyer-template and citation export, trust export, publication and queued-mail refusal; fresh named human decisions; exact recipient isolation, retained external versions and successor history; inactive custody restore. `tests/trust-browser.mjs` — promise-current, promise-invalidated and promise-refreshed answer and trust screens at 1440 and 390, with icon-control audit. `tests/agent.mjs` — answerJourney retains recursive prior-answer and SOC-report invalidation. | None for the current native doors. Dependencies are exact owner-selected source relationships, not inferred legal equivalence. AUTH-001 retains future reviewer roles; ANSWER-002 and ANSWER-003 inherit the same freshness, exact human decision and recipient gates before their new doors ship. `docs/CUSTOMER-PROMISES.md` documents the current semantics. |
| `AGENT-006` | Tailor policies, risks and structured obligations | push-further | partial | `src/evidence/agent/tailoring-storage.ts`; `src/evidence/agent/tailoring-interpret.ts`; `src/evidence/agent/tailoring-http.ts`; `src/evidence/authz/reviewers.ts`; `tests/agent.mjs` and tailoringJourney in `tests/helpers/tailoring-journey.mjs` (mapping decisions, deterministic cited preparation, inventory, diffs, ambiguity, exact effects and full populated restore); interpretationJourney in `tests/helpers/interpret-journey.mjs` (model interpretation through the declared flow, verbatim citations, ambiguity, no authority from source text, reject one and approve another, reviewer role check); live receipt `tests/live/receipts/anthropic-tailoring.json`; assuranceBrowser in `tests/helpers/assurance-browser.mjs` through `tests/period-agent-browser.mjs` (all corresponding owner screens at 1440/390) | Landed: deterministic cited preparation, model interpretation through the declared SECURE-001 flow, exact-hash human decisions, atomic downstream records, CONTROL-001 inheritance and the reviewer role check. Held at partial until ct approves the SECURE-001 flow default and the AUTH-001 role default on which it runs. |
| `AGENT-007` | Check uploaded and captured evidence before the auditor sees it | push-further | missing |  | No implementing path |
| `AI-001` | AI inventory and governance | push-further | missing |  | No implementing path |
| `BOUNDARY-001` | US-first scope and independent specialist services | target | done | `src/evidence/program/boundary.ts`; `src/evidence/program/http.ts`; `src/evidence/costs.ts`; `src/evidence/library/`; `tests/program.mjs`; `tests/work.mjs`; `tests/cloud.mjs`; `tests/population.mjs`; `tests/followup.mjs` | None for current doors. Future program, agreement, specialist-handoff and customer-facing clauses (PROGRAM-003, PROGRAM-004, VENDOR-001, VENDOR-002, ANSWER-001, TRUST-001, AUDIT-001) inherit the obligation. |
