# Evidence target contract

Target date: **16 October 2026**. Evidence is an owned security compliance automation and customer-trust product for a US security or operations lead at a 20–250 person business. A buyer can replace Vanta, Drata or Secureframe for framework readiness, continuous control testing, policy and employee compliance, remediation, risk/vendor management, auditor collaboration and customer security reviews. Comp AI, Sprinto and Delve are the comparison set for the next step: agents carry a failed control to a narrowly authorized fix and fresh source proof, while preserving the original failure.

This is the product to build toward, not a description of today’s release. The owner-approved 16 October target replaces the earlier first-release exclusions of frameworks, policy templates, collectors and questionnaires. Existing immutable receipts, honest gaps, imports and reviewer folders remain the provenance layer within the complete job. One installation serves one business and its scoped teams, employees, customers and auditors. The product stays independently usable and MIT-licensed; shared Base code or sibling integrations do not combine products.

`done` means the entire named clause has implementing code and cited public-door tests at the status baseline. `partial` means only the explicitly stated subset exists or acceptance is incomplete. `missing` means the target behavior has no implementing product path. Future acceptance journeys below are requirements, not claims that planned screens/routes exist. Current `seed.json` metadata and README first-release descriptions have not been changed in this documents-only round and do not narrow this target.

## Target clauses

### Program and readiness

**PROGRAM-001 — Framework programs and applicability.** A US security or operations lead at a 20–250 person business can run SOC 2 Type I and Type II, ISO 27001, HIPAA and PCI DSS programs. Each program records its framework edition, licensed requirement references where necessary, legal entity, in-scope products, teams, regions, systems, audit period, assessor, accountable lead and milestone dates. An applicability review records exclusions and rationale; changing editions creates a reviewable mapping change, never a retroactive pass. Additional regulated and sector programs, including NIST CSF, NIST 800-53, FedRAMP readiness and HITRUST readiness, use the same versioned program model and identify assessment/authorization dependencies.

**Acceptance evidence:** From the program-setup UI, create each of the four core programs for a US SaaS business, choose two scoped products and different periods, review applicability with an assessor, then upgrade one framework edition. Reopen the program and export it: owners, exclusions, edition history and unresolved obligations survive; excluded work is visible and no certification is asserted.

**PROGRAM-002 — Reusable mappings and accountable ownership.** One versioned control can satisfy explicitly mapped requirements in several frameworks without duplicating evidence. Every mapping states the implementation, test, evidence requirements, scope and accountable human, with delegated contributors and due dates. Scope changes, accepted exceptions and mapping changes retain actor, reason and effective period; no scope reduction silently improves a historical result.

**Acceptance evidence:** In the program UI map an access-review control to SOC 2, ISO 27001 and HIPAA, assign an owner and contributor, attach period evidence once, and inspect all three mappings. Remove an asset from scope with a reason: earlier denominators and the changed-definition label remain in the audit-period report.

**CONTROL-001 — Custom controls and testing intent.** Owners create and revise custom controls, framework requirements, evidence requirements, cadence, applicability, test intent and evaluation criteria alongside shipped templates. Revisions take effect prospectively; prior observations retain the exact revision evaluated. Custom mappings are first-class and exportable.

**Acceptance evidence:** Create a custom production-access control through the control form, add two evidence requirements and a custom framework mapping, revise its test intent after a failed observation, then view both revisions in the historical report. The earlier failure keeps its original meaning.

**READINESS-001 — Readiness, trend and executive reports.** The readiness view separates recorded proof completeness, automated test effectiveness, policy/personnel completion, risks, exceptions and auditor decisions. Filter by framework, product, owner, period and severity; drill from each total to its denominator and source. Board/auditor exports include scope, open obligations, overdue work, collection freshness and trend history. Missing, stale, unsupported and untested work remains visible; any score explains its calculation and does not label a business certified.

**Acceptance evidence:** From readiness, compare current and prior audit periods with a stale connector, failed test, accepted exception and missing policy attestation. Follow every displayed total to records, export the report, and reconcile counts and period boundaries. A filtered or failed read cannot create a passing result.

### Evidence provenance and continuous observation

**PROOF-001 — Immutable exhibits and attributable receipts.** An owner creates Control → Requirement → Exhibit → Receipt through `/app`. The server reads stored bytes before issuing a receipt, records server time and authenticated actor, ignores forged digest/origin fields, appends explicit same-requirement replacements, and retains original bytes and facts. Each read verifies size and SHA-256. Source-observed, manually-asserted and imported remain distinct; a fingerprint proves unchanged stored bytes, not truth or operation of a control. The detailed receipt rules below remain binding.

**Acceptance evidence:** Use `/app/controls` and the requirement upload form, attempt forged receipt facts, replace an exhibit, reload its original receipt and download both versions. Attempt a double replacement, oversized upload and changed/missing object: refuse unsafe writes/downloads and retain facts. `tests/evidence.mjs` exercises these production HTTP doors.

**GAP-001 — Honest period-specific proof coverage.** `/app` and `/api/desk` derive covered, due soon, overdue, missing, superseded-only or unavailable bytes per requirement and selected UTC cadence period. Imported history cannot establish current proof. Storage failure is unavailable, never green. Historical completeness describes recorded assertions and remains separate from observed control effectiveness. The detailed period rules below remain binding.

**Acceptance evidence:** At the desk select daily, weekly, monthly and quarterly periods, advance across their deadlines and inspect a superseded period, imported-only proof and changed/missing R2 bytes. Reopen a completed historical period and confirm the original state logic. `tests/evidence.mjs` exercises these cases through `/api/desk` and receipt downloads.

**COLLECTION-001 — Scheduled source collection with visible failures.** Owner-authorized collectors run without an open browser on configurable schedules and source events. Every run records account/asset coverage, connector and control revision, source and receipt timestamps, audit period, cursor, completeness and a terminal outcome. Source-observed evidence requires a successful authorized read; manual uploads and imported artifacts cannot impersonate it. Pagination, partial permissions, throttling, expired grants, dropped assets and schema drift create explicit gaps. Bounded backoff resumes collection without duplicate receipts or fabricated catch-up observations.

**Acceptance evidence:** Connect a real authorized sandbox via the Connections UI, schedule collection, close the browser, change the source and inspect the next run. Revoke a required scope, throttle a page and interrupt a run; reconnect and resume. The run history and period report preserve missing coverage, failure and recovery separately; only actual source reads issue observed receipts.

**CONNECT-001 — Least-privilege integration custody and custom collectors.** The Connections UI exposes exact scopes, account/tenant binding, covered and unsupported resources, latest successful read and reconnect instructions. Read-only OAuth/provider apps or scoped role grants are the collection default. Secrets are encrypted under installation-local custody, redacted from UI/logs/archives and rotated or revoked without resurrecting old authority. Buyers can install a reviewed custom read-only connector or private-network collector for on-premises systems using the same observation protocol. Provider registration, permissions review and deployment are engineering deliverables, not manual-upload substitutes.

**Acceptance evidence:** Authorize, rotate, revoke and reconnect a provider through Connections; attempt cross-tenant use and export/restore. Validate that secrets never appear and restored connectors remain inactive. Install one owner-reviewed private collector, inspect unsupported resources and a lost connection, and reconcile its read-only output with the actual private source.

**CLOUD-001 — AWS, Google Cloud and Microsoft Azure.** Native AWS, Google Cloud (GCP) and Microsoft Azure connections inventory in-scope accounts/projects/subscriptions and collect IAM/MFA, public storage, encryption, logging, backup and network-configuration evidence. Scheduled tests expose exact resources and applicable exclusions, including organizational child accounts; an inaccessible account cannot disappear from the denominator.

**Acceptance evidence:** For each provider, connect an authorized sandbox through Connections, discover a child account/project/subscription, and run a public-storage and privileged-MFA test. Change a setting in the real provider, re-test, and revoke one read permission. The failing resource, missing coverage, original observations and recovery are individually visible.

**CODE-001 — GitHub and GitLab change assurance.** GitHub and GitLab provider apps collect repository inventory, branch protection, required reviews/checks, merge and deployment history, membership and vulnerability evidence. Scope includes private repositories explicitly granted by the owner. Audit-period evidence links a production change to its review/check outcome and source revision; missing event history is unknown.

**Acceptance evidence:** Connect each code host, select two repositories and run branch-protection and reviewed-change tests. Merge an authorized reviewed change, remove protection on one repository and revoke access to the other. Inspect source links, event period coverage, failure and unknown states without exposing repository secrets.

**IDENTITY-001 — Google Workspace, Microsoft 365, Entra ID and Okta.** Google Workspace, Microsoft 365 / Entra ID and Okta connections collect user/group, privileged-role, MFA, lifecycle and sign-in evidence for compliance checks and access reviews. Reconcile identities across sources using reviewable matches; suspended accounts, service identities, guests and contractors remain explicit populations.

**Acceptance evidence:** For each named identity service connect a tenant via Connections, ingest an admin, employee, guest and service account, and test MFA and inactive-user access. Disable one real account and deny one scope. Reconcile duplicates with a human decision and inspect fresh source readback and incomplete coverage.

**HRIS-001 — BambooHR, Gusto and Rippling personnel sources.** BambooHR, Gusto and Rippling integrations synchronize employee/contractor roster, manager, department, start and termination dates as authoritative lifecycle inputs. Buyers review source conflicts rather than merging people silently; sensitive compensation, SSNs and bank data are unnecessary and excluded from requested scope.

**Acceptance evidence:** Connect each named HRIS, import a joiner, mover and leaver, then correct a start date and terminate an account in the real source. The People UI shows source priority, conflict review, correct obligations and no collected payroll or tax identifiers.

**DEVICE-001 — Jamf, Microsoft Intune and CrowdStrike posture.** Jamf and Microsoft Intune supply managed-device inventory, ownership, encryption, screen-lock, OS/patch and management status. CrowdStrike supplies endpoint protection and sensor-health evidence. Correlation exposes unmanaged or unmatched endpoints and missing collection; compliance tests do not replace MDM or EDR operation.

**Acceptance evidence:** Connect each named service, match a device to a person, change encryption/patch or sensor-health state in a sandbox and run a fresh test. A missing device feed or unmatched endpoint stays a gap; the original failed posture and correction remain attributable.

**VULN-001 — Tenable and Qualys vulnerability evidence.** Integrations with Tenable and Qualys ingest asset-linked findings, severity, first/last seen, due dates, accepted exceptions and remediation verification. Deduplication retains source IDs and history; scanner silence or a deleted finding is not proof of remediation. Evidence delegates scanning compute to the authorized scanner.

**Acceptance evidence:** Connect each scanner via Connections, ingest a finding, link it to a control and remediation task, accept a time-bounded exception and let it expire. Correct the sandbox issue and perform a fresh scanner read; only verified resolution closes the compliance obligation, with original findings retained.

**INVENTORY-001 — Unified assets, people and ownership.** A compliance inventory reconciles cloud resources, code repositories, applications, vendors, devices, people and service accounts from connected sources and approved manual entries. Each record has source identity, owner, criticality, scope, last observation and lifecycle state; deduplication and exclusion are reviewable. Inventory supports framework scoping and access-review populations without replacing HRIS, CMDB or endpoint management.

**Acceptance evidence:** Open Inventory after connecting HRIS, identity, cloud and MDM sources; reconcile a duplicate person/device, assign an unowned service and retire an asset. Export the scope and reconcile counts with source lists. Removing connector permission cannot retire an asset or silently shrink test coverage.

**TEST-001 — Continuous control tests and exception discipline.** Framework and custom tests run on schedules and change events against the declared asset population. Each immutable observation keeps expected criteria, evaluated revision, source references, interval and result: pass, fail, unknown or not applicable with approved rationale. Configuration snapshots and event/period tests are distinct. Tune noisy tests with reviewed scope, thresholds and expiring exceptions; suppressing alerts never rewrites observations or closes risk.

**Acceptance evidence:** From a mapped control enable a scheduled MFA or reviewed-deployment test, fail a real source setting and inspect all resource results. Tune scope with an expiring exception, interrupt collection, and revise criteria. A later pass, expired exception or revised denominator never erases the earlier failure or fills an unobserved period.

### Remediation and follow-through

**REMEDY-001 — Failed test to verified remediation.** A failed test creates or links a durable remediation obligation with affected assets, control/framework mappings, severity, accountable owner, guidance, deadline, next action and source evidence. Owners triage, assign, comment, attach changes and request fresh verification. A ticket marked done remains awaiting verification until an independent real-source re-test passes; failures reopen work and time-bounded risk acceptance has an approver and expiry.

**Acceptance evidence:** Fail a real connected control, follow its Remediate action, assign an owner and due date, attach a change and mark work done before fixing the source. The obligation remains open. Fix the source, re-test and observe verified closure; regress it and confirm reopening with both observations retained.

**WORK-001 — Vector, Jira and Linear remediation links.** Remediation can create and synchronize a linked issue in [Vector](https://github.com/just-every/run-vector), Jira or Linear, including owner, due date, status, comments and source links under explicit field rules. Idempotent event handling prevents duplicate tasks; authorization loss and conflicting edits are visible. Evidence owns compliance obligation and verification; Vector and the external trackers own general project execution.

**Acceptance evidence:** For each destination connect an authorized project, create a task from one failed control, change assignee/status on both sides and deliver the same event twice. Inspect conflict and delivery failures, then close the remote task while the test still fails: Evidence keeps the compliance obligation open until re-test.

**FOLLOWUP-001 — Email, Slack and Microsoft Teams follow-up.** Email through Resend or SendGrid, Slack and Microsoft Teams deliver actionable remediation, policy, training, vendor-diligence and access-review reminders with private record links. Owners configure escalation, US business timezone, business calendar, quiet hours, cadence, stop rules and destination permissions. Persist the obligation and next action across restarts, deduplicate scheduled sends, expose pending/acknowledged/failed/uncertain outcomes, and stop when work is verified, authority ends or an owner pauses it. Provider acknowledgement never means a person acted.

**Acceptance evidence:** Configure each named channel/provider, let a due obligation escalate across a DST/business-calendar boundary with the browser closed, then restart the worker. Simulate a network-edge timeout and reconnect authorization; inspect delivery uncertainty without duplicate task closure. Complete or pause the obligation and verify later reminders stop while history remains.

### Risk and third parties

**RISK-001 — Risk register and treatment lifecycle.** Risk assessments record scenario, affected assets/processes, likelihood, impact, inherent/residual risk, method, owner, review deadline, mitigation and approved acceptance. Risks link controls, failing tests, incidents and vendors; treatment plans carry due work and verification. Risk acceptance expires and escalates rather than hiding a failed control.

**Acceptance evidence:** Create a risk from a failing control in Risk Register, score it, assign mitigation, approve a time-bounded residual-risk acceptance and export the register. Let approval expire and inspect escalation; a passing re-test updates treatment evidence without rewriting the original assessment.

**VENDOR-001 — Vendor inventory and security diligence.** Track suppliers, business owner, data access, criticality, subprocessors, contracts/BAAs, security documents, risk tier, assessment questionnaires, findings, approval, renewal and reassessment dates. Secure supplier request links collect documents and replies with expiry and provenance. Compare document versions, chase missing diligence and route exceptions to a named approver; vendor marketing assertions remain distinct from verified evidence.

**Acceptance evidence:** Onboard a US SaaS supplier through Vendors, request a SOC 2 report and BAA where applicable, collect a questionnaire response and record a finding. Approve with an expiring condition, reach renewal, and inspect overdue reassessment reminders and the unchanged original documents. An expired supplier link cannot read or mutate another vendor.

**VENDOR-002 — Vendor discovery and risk-based follow-through.** Discover candidate SaaS vendors from authorized SSO/application, cloud and procurement/accounting sources such as QuickBooks Online and Ramp. Show why a candidate was found; a human confirms identity, ownership and data access before risk-tier assignment or external diligence. Accepted vendors start tier-specific recurring reviews; agents can prepare follow-ups within approved recipients and schedules.

**Acceptance evidence:** Connect an authorized application source and one named spend source, discover an unknown vendor and duplicate, review proposed matching/tier, then approve diligence. Change its access and reach its review date: a new assessment starts, missing replies escalate and rejected candidates receive no external requests.

### Policies, employees and access

**POLICY-001 — Policy library, approval and version control.** SOC 2, ISO 27001, HIPAA and PCI policy templates cover access, change, incident response, continuity, retention, vendor security and acceptable use. Tailor them to actual operations; named reviewers approve exact revisions before publication. Maintain effective dates, change history, recurring review, control mappings and exceptions, with employee assignment tied to a specific approved version. Templates require applicability review and do not constitute legal advice.

**Acceptance evidence:** From Policies tailor a template to connected business facts, review an exact revision, reject a changed draft, then publish and map it to two frameworks. Reach its review deadline and publish a replacement: original approval and attestations remain, with new required acknowledgments visible.

**ATTEST-001 — Employee policy attestations.** Employees and contractors receive role-appropriate approved policies, attest to exact versions and see their outstanding actions. Managers/compliance owners track acknowledgments, exceptions, deadlines and reminders; bulk publication cannot invent employee assent. Departed workers retain historical evidence without active access.

**Acceptance evidence:** Assign a policy revision to an employee and contractor, sign in as each and acknowledge one while leaving the other overdue. Publish a material revision and inspect reassignment/reminders. Terminate one person and confirm denied access with retained time/version/identity evidence in the audit export.

**TRAIN-001 — Security awareness and KnowBe4 evidence.** Assign security-awareness training during onboarding and on configurable recurring schedules, track course version, completion/assessment result and overdue obligations, and import source-attributed completions from KnowBe4. Support approved internally delivered training with clearly manual provenance. Role-based campaigns, due dates and schedule customization drive reminders and escalation; a course assignment is not completion.

**Acceptance evidence:** Create an onboarding and annual campaign in Training, enroll a new hire, complete an approved internal course and ingest a real KnowBe4 sandbox completion. Leave another learner overdue, amend the schedule, and verify reminders, original result provenance and an auditor export without fabricated completions.

**LIFECYCLE-001 — Joiner, mover and leaver compliance.** HRIS and identity events create employee/contractor checklists for policy acknowledgment, training, background-check evidence where lawful, device posture, access grant/review and termination revocation. Each item has owner, due time and source-readback proof; an offboarding task is incomplete until required accounts and devices have been checked. HR or IT executes in its own system; Evidence coordinates and verifies compliance.

**Acceptance evidence:** Change a joiner, mover and leaver in an authorized HRIS; follow their checklists in People, assign tasks, and attempt to close leaver work with an active Okta account. It remains open and escalates. Disable the real account, re-read identity/device sources and verify closure with historical worker evidence preserved.

**ACCESS-001 — Quarterly access-review campaigns.** Schedule quarterly and owner-configured access reviews using a frozen source population of users, service identities, privileges and resources. Resource owners decide retain/revoke/change with reasons; self-review restrictions and delegated approvals are explicit. Track overdue decisions, reminders, exclusions and actual revocation readback; late discovered accounts become visible supplemental work.

**Acceptance evidence:** Start a quarterly review from Access Reviews, have two resource owners decide on employee, guest and privileged service access, and leave one decision overdue. Request revocation, keep the source account active and inspect unresolved work. Revoke in the source and re-test; export complete decisions, population and period evidence.

### Audit collaboration

**REVIEW-001 — Selected expiring evidence folders.** Owners select controls, an inclusive date range and expiry at `/app/folders`. A one-time bearer link exposes only the scoped read-only projection, checked on every request and again before disclosure. Closing is terminal; unknown, changed, closed, expired and out-of-scope requests receive the same plain 404. Tokens never appear in stored owner lists, events or archives. Originals inside a folder scope remain visible even after redacted replacement; inspect the full list before sharing. The detailed reviewer rules below remain binding.

**Acceptance evidence:** Issue a folder through `/api/folders`, open its `/review/{token}` page and download only in-period exhibits. Try a crossing-period receipt, foreign control, write, altered token, expiry during a read and closed folder. Owner event history retains allowed/refused attempts without raw links. `tests/review.mjs` and `tests/review-browser.mjs` cover these doors.

**AUDIT-001 — Period-specific auditor workspace and request lists.** Auditors sign into an engagement-scoped workspace or explicitly authorized API, with independent engagements, audit periods and requested-control populations. Import or create information request lists, assign internal request owners, set due dates, discuss findings, submit exact evidence versions, and record auditor accepted/rejected/needs-more states. Track requests through resubmission and close-out without treating an upload as auditor approval. Period packs retain scope, source provenance, exceptions and request decisions.

**Acceptance evidence:** Invite an auditor to one engagement, import a request list, assign a request, comment and submit a period-specific exhibit. As auditor reject it, request more evidence and accept the next submission. Export the pack; another engagement and revoked auditor remain inaccessible, and the original submission and decisions remain available to authorized owners.

### Customer assurance

**TRUST-001 — Published and permissioned trust center.** A branded customer trust center publishes owner-approved security posture, frameworks, subprocessors and dated assurance statements with a custom domain. Restricted documents support access requests, reviewed recipients, NDA execution through DocuSign or Dropbox Sign, expiry, download audit and revocation. Public, approved-customer and auditor scopes remain distinct; publishing never exposes raw connector or personnel data. A revoked grant cannot recall a previously downloaded copy.

**Acceptance evidence:** Publish an approved statement, request a restricted SOC 2 report as a prospect, complete an NDA through each named e-signature integration, approve one recipient and deny another. Check expiry/revocation, downloads and custom-domain access from a signed-out browser. An unapproved draft and another prospect’s documents never appear.

**ANSWER-001 — Cited security-questionnaire completion.** Upload XLSX, CSV and DOCX questionnaires, preserve question IDs, sections and required answer format, and draft answers only from authorized approved policies, control observations, audit reports and prior approved answers. Every material assertion cites exact source revision and relevant period; unsupported or contradictory questions stay flagged. A named security/legal reviewer approves the exact answer set and recipient before export or submission. Export preserves the buyer’s template; reusable answers expire or invalidate when sources change.

**Acceptance evidence:** Upload representative XLSX, CSV and DOCX customer questionnaires in Questionnaires, generate a cited draft with one unsupported and one conflicting question, inspect citations, edit and approve an exact version. Modify a source after approval and attempt reuse/submission: require a new decision. Export and reopen the original formats without losing question placement, IDs or flagged gaps.

### Portability and migration

**IMPORT-001 — Reviewed Drata archive admission and undo.** The owner dry-runs the documented Drata ZIP/HTML-manifest shape, reviews every proposed mapping and unsupported item, explicitly admits a Base journal and can undo active native links while original artifacts and immutable custody remain. Imported history never proves a live control operated. Original archive bytes and source provenance remain available; the supported shape and synthetic-fixture boundary in `docs/DRATA-IMPORT.md` are explicit.

**Acceptance evidence:** Through Move-in, inspect a documented-shape Drata ZIP, review mappings and refuse unsafe/malformed artifacts, admit with a journal, then undo active links. Inspect retained originals and import history after undo, restart and archive restore. `tests/import.mjs` exercises these routes; a real customer export remains separately required under MIGRATE-001.

**MIGRATE-001 — Switch from Vanta, Drata and Secureframe.** Guided migration separately supports Vanta, Drata and Secureframe exports and authorized APIs for available framework scope, mappings, controls, test history, policies/attestations, people, vendors/risks, audit requests, trust/questionnaire content and original exhibits. Preview counts, field mappings, unsupported records and absent export fields; resolve identity/owner conflicts before admission. Preserve original IDs, timestamps, source and audit periods as imported provenance, never fabricated live observations. Reconcile totals and bytes, undo admitted links without deleting source custody, and explicitly reauthorize connectors and external access.

**Acceptance evidence:** For each incumbent, use a representative authorized customer export through Move-in, preview and reconcile source totals and unsupported fields, resolve a duplicate identity, admit, export and undo. Reconnect one actual source and verify imported history stays distinct from fresh observations. If an incumbent does not export a record type, the UI names it and offers an authorized API/manual mapping route without silently dropping it.

**CUSTODY-001 — Complete custody archive and empty-target restore.** At `/app/archive` the owner inventories, streams, dry-runs and restores the current Evidence domain archive, including all controls, requirements, immutable receipts, actor provenance, available verified exhibits, closed reviewer-folder history, import custody/original ZIPs and agent snapshots/decisions. The archive records unavailable bytes honestly, validates all entries before business admission and requires empty product data/bucket. Restoration grants no source-owner, reviewer or agent authority. The versioned format, size bounds and distinction from Base generic transfer below remain binding.

**Acceptance evidence:** Export through `/api/archive/export`, inspect the manifest, dry-run and restore into empty real D1/R2; compare every portable record and byte. Try altered digests, traversal, missing/unlisted files, unavailable bytes and a nonempty target. Refusal preserves the target; successful restore leaves grants inactive. `tests/archive.mjs` and `tests/review-browser.mjs` exercise HTTP/CLI custody journeys.

**PORTABLE-001 — Full-program transfer and Base replacement obligations.** The versioned complete-product archive must extend CUSTODY-001 to every target program record: mappings/revisions, inventory, observations, policies/attestations/training, risks/vendors, remediation and delivery history, access/auditor decisions, trust/questionnaire approvals and the permanent anonymized action audit. Account for every table and blob explicitly, preserve unavailable entries and later erasure fences, and refuse unknown namespaces rather than truncate. Receiving identity, sessions, provider secrets and execution grants stay local; source schedules, writes, messages and external shares remain inactive until reauthorization. The domain archive is the recorded Evidence replacement for Base’s generic product transfer, not an assertion of full Base equivalence. Local export/restore and documented disaster recovery must work without the original hosted service.

**Acceptance evidence:** Use the console and local archive command to export a populated program containing every record class; restore offline into an empty installation with a different owner. Reconcile table/blob inventory, original history, unavailable bytes and erasure fences. Verify no message, source mutation or external grant replays, then explicitly reauthorize one connector. Reject an unknown table and a pre-erasure archive without the required later journal.

### Access, integrity and operation

**AUTH-001 — Roles, SSO and scoped authorization.** Keep Base native owner authentication and same-origin mutation checks. Add administrator, compliance manager, control owner, contributor, employee, risk approver and auditor roles with engagement/team/record scope and separation of duties. SSO via Google Workspace, Microsoft Entra ID and Okta supports MFA enforcement, SCIM provisioning/deprovisioning, session revocation and audited break-glass owner access. API tokens and service identities have explicit scopes and expiry; a collector or prepare-only agent cannot approve, publish or change roles.

**Acceptance evidence:** Sign in through native authentication and each named SSO provider; provision and deprovision a contributor via SCIM. Attempt foreign-team reads, employee exports, self-approval and cross-origin writes; refuse them at HTTP doors. Revoke a session/token and confirm all next requests fail while authorized control owners can submit only their scoped evidence.

**SECURE-001 — Restricted evidence and declared external flows.** Sensitive documents, personnel records, findings and connector data stay private by default, with record-level need-to-know grants, explicit redaction/publication and verified attachment downloads. Encrypt provider credentials and sensitive persisted data under documented key custody; rotate keys with recovery and loss behavior documented. Declare each outbound provider/model, purpose, exact data classes, retention, region and account in Connections before enablement. Owner-selectable model providers use minimum necessary evidence, never grant authority from source text, and do not receive secrets. Audit access and suspected data disclosures.

**Acceptance evidence:** Upload hostile HTML/SVG and a sensitive employee document, verify safe attachment handling, then try unauthorized record reads and publication. Enable one model/connector only after reviewing its data flow, rotate its key and simulate unavailable custody. Inspect logs and exports for secret exclusion and explicit failure; revoked access fails on the next read.

**ERASE-001 — Explicit erasure, holds and restore fencing.** Authorized erasure of a person, exhibit, vendor, engagement or entire business removes applicable D1 rows, R2 bytes, derivatives, model indexes, provider-side copies under our control and live grants. A reviewed legal hold discloses what is retained, why, who authorized it and when it is reviewed. Erasure overrides ordinary receipt immutability only through the dedicated audited workflow; ordinary editing still cannot delete proof. Durable receipts count deletions/anonymization by store, retain opaque audit references and fence old archives using the later source journal. External downloads and offline archives already held elsewhere cannot be recalled; buyers receive deletion requests/instructions for those custodians.

**Acceptance evidence:** In Privacy, preview and confirm each entity and business erasure with linked imports, receipts, blobs and active shares. Verify exact stored bytes/derivatives disappear, all grants fail, held items are disclosed and actor references anonymize. Restore a pre-erasure archive with the later journal: erased content and authority cannot resurrect. Interrupt a provider deletion and inspect pending work rather than a false completion.

**LOG-001 — Permanent accountable action audit.** An append-only product audit records authentication/authorization changes, control/scope revisions, observations, evidence access and replacement, import/undo, approvals, source mutations, sends, exports and erasures with actor or scoped agent, subject, time, reason, exact revision and durable outcome. No raw credentials or token-bearing URLs enter it. Failed/uncertain operations and later resolution remain distinguishable; erasure anonymizes actors without removing accountability. The audit travels in product archives and authorized reports.

**Acceptance evidence:** Perform an import/undo, folder read/refusal, approval, source change, failed send and erasure through their public doors. Inspect and export the audit, restart, then restore. Every attempted sensitive action and its outcome remains attributable without secrets; an erased actor is anonymous and an interrupted send remains uncertain until resolved.

**OPS-001 — Durable operation, health and recovery.** Preserve Base setup, origin-bound owner admission, CLI lifecycle, health and deploy boundaries. Required configuration failures name the setting without its value and fail closed. Scheduled work uses durable claims, bounded execution, crash reconciliation and visible failed/unknown outcomes; restarts never manufacture observations or silently discard obligations. Operators see connector health, storage/queue limits, backup status and last successful collection. Test backup restoration and upgrades with retained migrations; limits refuse work explicitly rather than truncate evidence. Estimated operating costs and optional provider/module charges are itemized in USD before enablement.

**Acceptance evidence:** Use documented setup/dev/build commands, omit a required setting, restart during a collection and notification, and interrupt storage. Inspect health and durable outcomes, recover from a complete backup and apply an additive migration without changing historical evidence. Attempt a documented size bound and inspect explicit refusal and the USD cost/configuration explanation.

**MOBILE-001 — Responsive and accessible complete workflows.** At 1440 and 390 pixels, owners, employees and auditors can complete their authorized jobs: readiness and source failures, remediation, evidence upload/download, attestations/training, access reviews, requests, trust access and questionnaire approval. Keyboard/screen-reader labels, focus, text status and error recovery target WCAG 2.2 AA. Browser/mobile file and camera upload are supported with the same custody checks; task links reopen the exact authorized record. Mobile sessions and notifications obey the same privacy and revocation rules.

**Acceptance evidence:** With realistic program data, use desktop and phone browsers to complete each role’s journey, upload a phone file/photo, resolve an error and return from a task notification. Inspect every end state at both widths, use keyboard navigation and a screen reader, and verify no hidden controls, color-only states or cross-role disclosures.

**PUBLIC-001 — Preserve the approved installation and run surfaces.** The separate static run site retains its approved homepage, `/run` installation instructions and repository Markdown guides without requiring JavaScript. Installed `/` remains Base’s Lobby, with setup-state-aware Finish setup or Sign in. Existing sign-in, setup, proof, folder, archive, move-in and agent surfaces keep the approved styling. This target contract does not itself change those screens or claim unbuilt workflows are present.

**Acceptance evidence:** Build the run site, follow the homepage Run/docs links without JavaScript, and inspect installed Lobby before and after setup. Existing browser journeys inspect the approved owner/reviewer flows at 1440 and 390. `tests/site.mjs`, `tests/evidence.mjs`, `tests/browser.mjs` and `tests/review-browser.mjs` are the existing checks.

### Push further: agents accountable to the compliance job

**AGENT-001 — Prepare-only proposals with exact human approval.** Expiring/revocable prepare-only agent credentials read the permitted desk and prepare an evidence-folder proposal. Only an authenticated owner session approves the exact current proposal snapshot; changed or stale snapshots require a new decision. Immutable decisions survive restart and archive transfer without reviving agent authority. Preparation does not grant sharing or source-write power. See `docs/AGENT-COMMANDS.md`.

**Acceptance evidence:** Issue a prepare token, inspect gaps and propose a folder through agent commands/API. Attempt direct sharing, owner-only mutation, approval with an agent token and stale-snapshot approval; refuse each. Have the owner approve the current snapshot, revisit its immutable decision and revoke the token. `tests/agent.mjs` exercises these doors.

**AGENT-002 — Prove operation across the audit period.** An agent correlates cloud configuration changes, identity/security events, deployment history and control revisions across a selected audit period. It flags controls that pass now but failed earlier, missing windows, contradictory sources and unobserved assets, and proposes attributable findings rather than a fabricated pass. Compliance owners approve control meaning and exceptions; the auditor decides evidence sufficiency. Original observations, source times and periods remain inspectable.

**Acceptance evidence:** From a period report ask the agent to investigate a control that passes its latest snapshot but had a documented mid-period privilege/merge violation and a missing event window. Follow its citations to original sources; both the failure and unknown interval appear. Reject its proposed exception and verify no mapping, pass or auditor decision changes.

**AGENT-003 — Investigate, fix narrowly and re-test the real system.** For a failed control, an agent investigates the linked source evidence, affected assets, configuration and repository history; proposes a minimal configuration/IaC change with rationale, risk, diff and rollback; requests an exact versioned approval or a standing low-risk grant bounded by account, resources, actions, expiry and spend. Execution uses a separate constrained writer, never collection credentials. It independently reads back and re-tests the real system, closes only verified work, and escalates residual failures or exhausted authority. Reject/revoke prevents the next action. Retain the failed observation, approved change, execution outcome, rollback and fresh proof in one chain.

**Acceptance evidence:** Fail a real sandbox control, ask the agent to investigate and propose a change, reject one revision and approve the next with one-resource authority. Attempt an out-of-scope write and revoke an in-flight grant: prevent further unauthorized work. Execute the permitted fix, read back from the real provider, independently re-test and verify closure without erasing the original failure. A failed fix stays open with escalation and rollback evidence.

**AGENT-004 — Maintain collectors without manufacturing evidence.** An agent detects expired scopes, schema drift, stale timestamps, dropped assets and missing source coverage; diagnoses the provider/account failure and prepares a reconnect or reviewed read-only connector change. It may implement a missing connector in a sandbox and compare outputs against the authorized actual source. The owner approves code, accounts and scopes before activation; scope broadening and production writes require separate approval. No fabricated screenshots, backdating or silent exclusions can repair a gap.

**Acceptance evidence:** Break a sandbox connector scope/schema, remove an asset from a page and stale its source timestamp. Ask the agent for a diagnosis and connector patch, review the diff and approve read-only scopes, then compare output with the actual source inventory. Original gaps remain, and no production activation or unsupported pass happens before approval.

**AGENT-005 — Keep customer promises current.** An agent tracks dependencies from approved trust statements and questionnaire answers to controls, exhibits, policies, audit periods and customer contract commitments. Changed/failed/stale sources invalidate affected answers for reuse and prepare a cited revision plus named security/legal-owner decision. Approved recipients and exact-version publication remain human-controlled; the agent can chase internal review under authorized follow-up rules, never silently send a new security promise.

**Acceptance evidence:** Approve an answer and trust statement linked to a passing control and contract obligation, then fail the control and change the source policy. Inspect invalidation, affected customer commitments and cited revision. Attempt to reuse/export/send the stale answer; require a fresh authorized decision and retain the prior external version and recipient history.

**AGENT-006 — Tailor policies, risks and structured obligations.** Using authorized architecture/inventory, approved policies, customer contracts and selected regulatory text, an agent proposes tailored policy changes, risk assessments and structured control obligations with source passages, applicability assumptions, deadlines and conflicts. It distinguishes a contract promise from a framework requirement and never presents interpretation as legal advice. Security/legal owners approve exact changes before they assign work, alter scope or become published policy.

**Acceptance evidence:** Ask the agent to interpret a US customer security addendum and selected framework material alongside the actual asset inventory. Inspect clause citations, proposed controls, policy/risk diffs and one ambiguous obligation. Reject a proposed interpretation and approve another: only the approved exact revision enters the program and downstream work.

**AI-001 — AI inventory and governance.** Inventory AI tools, model providers, internal AI use cases, data classes, business owners, access, evaluation evidence and approved-use restrictions discovered from authorized identity, code and vendor sources. Link AI-specific risks, policies and control tests to the same program; flag shadow tools and changed data access for human triage. Model/vendor approval and a documented evidence-sharing policy precede agent use; governance observations never imply certified model safety.

**Acceptance evidence:** Discover an unapproved AI tool through an authorized source, review its data access and owner, link a risk and acceptable-use policy, and approve only a bounded use case. Change its permissions, rerun governance checks and inspect the reopened review. An unapproved provider cannot receive evidence or execute an agent job.

### Honest product boundaries

**BOUNDARY-001 — US-first scope and independent specialist services.** Evidence is the owned compliance automation and customer-assurance product, replacing the program work bought from Vanta, Drata and Secureframe and advancing beyond the Comp AI, Sprinto and Delve comparison set. US-first means USD commercial/cost disclosures, US business calendars, employee and 1099-contractor populations, and US-first framework applicability. It prepares SOC 2/ISO/HIPAA/PCI evidence; an independent US CPA issues a SOC 2 attestation, an accredited certification body decides ISO certification, and qualified assessors/counsel determine regulated obligations. No template, score, agent or portal guarantees certification or authorizes regulated data. Required BAAs/DPAs, regional controls and licensed framework content are explicit prerequisites to appropriate processing, not reasons to omit the program. Jamf/Intune manage endpoints; CrowdStrike protects them; Tenable/Qualys scan; HRIS and identity systems operate staff/accounts; approved executor services perform heavy scans and penetration tests. General project work stays in Vector, incident response stays in the buyer’s incident tooling, and general file collaboration stays in [Chest](https://github.com/just-every/run-chest). Evidence integrates their records and verifies compliance obligations rather than absorbing neighboring products.

**Acceptance evidence:** Onboard a US business, choose a HIPAA/PCI scope, inspect data-processing prerequisites and assessor handoff, review USD module/provider costs, and export an evidence pack for an independent assessor. Follow linked remediation to Vector and source checks to the named specialist providers. No UI/report claims certification, legal sufficiency or operation of an external system without source evidence.

## Retained provenance mechanics

These rules define existing receipt, cadence, bearer-folder and custody behavior. Target program automation adds independently attributable observations and permissions; it must not relabel manual/imported material, silently change historical period logic or grant external authority on restore. Explicit erasure under ERASE-001 is the only target exception to ordinary immutable-record deletion rules.

## Receipt facts

The receipt origin vocabulary is exactly source-observed, manually-asserted, or imported. The manual upload route always writes manually-asserted; a caller cannot select imported or source-observed. Caller-supplied origin, actor, digest and time are ignored. The authenticated Base owner identity and server UTC timestamp are recorded. Source and inclusive covered-from/through UTC dates are owner assertions, including future coverage; the desk does not verify their truth.

The server writes a fresh random R2 key, then reads the stored bytes and computes SHA-256. A filename is display metadata, never a key or filesystem path. Each upload appends an Exhibit and Receipt in a D1 transaction. Supersession requires an explicit current receipt belonging to the same requirement. The newer receipt points to the old; no old fact or byte is changed. A unique constraint prevents concurrent double replacements. Old files remain listed and downloadable. Receipt/exhibit update and deletion are forbidden by SQLite triggers. An interrupted storage/DB operation may leave unreferenced bytes, but never a successful invented receipt.

Files are nonempty and limited to 10 MiB; the multipart body is streamed with a 10 MiB + 64 KiB cap before parsing. Downloads require owner authorization, force attachment and octet-stream, include nosniff and a sandbox policy, and do not preview HTML/SVG. Every read verifies actual R2 bytes against retained size and SHA-256. Missing, unreadable or changed bytes are unavailable; the receipt remains.

## Period and gap rules

Dates are real ISO calendar dates in UTC. On the owner desk, the selected date chooses a whole calendar period: daily midnight to midnight; weekly Monday through Sunday; monthly first through last day; quarterly Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec. Covered-through is inclusive; the deadline is the next UTC midnight. The default is today's UTC date; the owner can select a historical date.

A matching receipt must cover the entire selected period and cannot have imported origin. Imported material is supplied history; a fresh owner assertion is needed to establish current proof. A receipt is current only when no newer receipt supersedes it, regardless of its covered period. Precedence is:

1. Any matching current receipt whose actual bytes cannot be read and verified: unavailable bytes, even if another matching receipt is available.
2. Matching current receipts with verified bytes: due soon in the final 20% of that selected period before its deadline; otherwise covered. For daily proof, the final 4 hours 48 minutes are due soon. Historical complete periods stay covered. This is completeness of recorded assertions, not control effectiveness.
3. Matching receipts exist but all have been superseded: superseded-only. A normal replacement may assert a different covered period; selecting the older period then reaches this state without invented records.
4. No receipts at all: missing.
5. No matching receipts, and the selected period has ended: overdue. On today's default view it is also overdue when any current receipt's covered-through has expired, making covered → due soon → overdue reachable across the calendar boundary. Otherwise: missing.

R2 or D1 failures that prevent a coherent desk return an explicit unavailable response. No failed read asserts coverage. Time is server time; only the test harness can inject a clock function. There is no production time header, query or environment override.

## Current reviewer-folder mechanics

An owner issues a folder with a reviewer label, one or more existing controls, a start and end date, and a future UTC expiry. The dates are inclusive and the start cannot follow the end. Duplicate control selections collapse to one selection. Issuing creates a random 256-bit bearer token. The creation response is its only display; persistent storage keeps its SHA-256 digest, not the raw token. Owner folder listings and revisits cannot recover the link. Treat the link as a secret: anyone who has it may use the selected reviewer doors until the folder closes or expires.

The reviewer does not sign in and receives no owner session or mutation route. Each page, list, receipt and download request re-reads the stored grant. Authorization requires the matching token, an open folder, a request before expiry, the expected local origin, a read-only GET/HEAD method and the current control and period selection. Expiry is exact: at now equal to expires_at the request is refused. The grant is rechecked immediately before a response is disclosed, so a close or expiry during a storage read cannot preserve a stale response. Public pages and responses are no-store and use no-referrer.

The folder's date interval is inclusive. A receipt is visible only when its whole covered-from/through interval is inside that interval and its requirement belongs to a selected control. A receipt that crosses either boundary is excluded from the list and from direct receipt/view/download access. The gap for each selected requirement uses the r1 calculation at the folder's end date. Covered, due soon and unavailable bytes use only in-scope receipts. Full history preserves whether an in-scope receipt was superseded, and the full-history overdue result is used only when the scoped calculation would be missing. A gap can therefore show overdue or superseded-only because of hidden history, but hidden rows cannot establish covered or unavailable bytes. The hidden receipt fields and bytes stay private.

Reviewer projections contain the selected control and requirement, cadence, gap, in-scope receipt facts, origin and source, period, fingerprint, filename, size, media type, availability, and the in-scope supersession relationship. They omit uploader or owner identity, object-storage keys, private owner routes, other controls/folders and review logs. Downloads are verified attachment/octet-stream responses with nosniff and sandbox policy; unavailable bytes do not produce a successful download. Unknown, changed, closed, expired and out-of-scope requests use the same plain 404 response on reviewer doors. Storage failure returns an unavailable response rather than asserting access or coverage.

Owner-only event history records allowed and refused page/list/receipt/download attempts with time and known folder/exhibit association. Unknown-token attempts have no invented folder association. Events contain no raw token or token-bearing URL. The current bearer-folder projection cannot see event logs or write findings. Engagement findings and auditor decisions belong to AUDIT-001; they do not grant bearer-folder mutation authority. Closing is terminal; reissue means creating a new folder. Closing cannot revoke a copy a reviewer already downloaded.

Exhibits remain private locally and immutable. There is no automatic pruning or per-receipt allowlist on a review folder: every receipt whose full period is inside the selected interval for a selected control is in scope, including superseded history. Inspect the whole projected list before sharing. A redacted replacement is a new receipt and, when replacing existing proof, explicitly supersedes the prior receipt; the original receipt and bytes stay in history. A redacted replacement does not hide an original that is also inside the folder's control/date scope. A complete archive includes both. Closing a folder cannot revoke a copy a reviewer already downloaded.

## Current custody-archive mechanics

The owner archive contains the Evidence controls, requirements, exhibits, receipt facts, receipt-actor provenance, review folders and selected controls, and review events. Archive version 2 also retains import reviews, native links, Base import custody tables and original ZIPs, plus agent token metadata, snapshots and decisions. Version 1 archives remain readable. It never contains reviewer or agent token hashes, owner sessions, passwords or authentication credentials. Restored agent credentials and source-owner import authority remain inactive. Receipt actor IDs and display names are preserved as historical provenance without creating active destination accounts. Restored folders are closed and have no grant hash; their event history remains. Issue a new equivalent folder if review access is needed again.

The manifest records each exhibit's archive path, expected size and SHA-256, plus whether verified bytes were available when inventoried. A complete archive streams all available verified exhibit bytes. Missing, unreadable or changed bytes remain listed with a reason and keep their receipt facts; unavailable bytes are not silently represented as present. The manifest has a digest over its exact serialized bytes, and each file is checked against its retained receipt digest. If an object changes after inventory and before export, export aborts rather than returning an inconsistent archive.

Restore accepts only an empty Evidence domain and exhibit bucket; destination authentication may already exist. It validates the manifest digest, format, relationships and all entries before writing business rows or exhibit objects. It refuses unsafe paths (absolute, traversal, drive or backslash paths), duplicate or unlisted entries, absent entries marked available, incorrect lengths or digests, unsupported versions, excessive metadata, and nonempty targets. A refusal on an empty destination leaves its business records and bucket empty; a nonempty-target refusal leaves that target's existing data untouched. Restore verifies stored bytes before admitting rows, then adds the records in a database transaction. Receipt facts, origin, actors and supersession are preserved. An unavailable entry remains unavailable after restore.

The archive CLI is separate from Base's generic export/import. It provides a streamed export and a dry-run or confirmed restore. Stop dev before using the local CLI. Its standard output is summary JSON; export dry-run adds per-file inventory descriptors with exhibit IDs, paths, sizes, digests and availability, but no business table rows or internal storage keys. Keep that inventory private metadata. The archive file contains the full manifest, including internal object keys, and available original exhibits; keep it private and do not overwrite the original archive.

Current practical limits: metadata is at most 8 MiB and 20,000 total rows; each exhibit is at most 10 MiB, matching the r1 upload limit. HTTP restore uses private local staging capped at 64 MiB total exhibit bytes. The local CLI uses disk staging and the same entry/metadata validators but has no aggregate archive-size cap. These limits are not a promise of unlimited archive size.


## Implementation status

Baseline: `74d8dbbfd719403a4fd610518df257ee6e3851fb` (current `main` at authoring), matching the 16 October inventory code audit. No source changed since that audit. Inventory’s one done row (recorded period coverage) is retained in GAP-001; eight partial rows are reflected in CONTROL-001, READINESS-001, AUDIT-001, TRUST-001 and the existing custody/agent clauses. Splitting or combining requirements changes clause counts, not the audit’s capability findings. Source inspection and existing tests establish status; this table does not assert every test was rerun in this document round. A build round must execute each applicable acceptance journey before promoting status. `—` means no implementing path, never evidence of completion.

| Clause | Status | Evidence path and remaining gap |
| --- | --- | --- |
| PROGRAM-001 | missing | — |
| PROGRAM-002 | missing | — |
| CONTROL-001 | partial | `src/evidence/storage.ts`; `src/evidence/http.ts`; `tests/evidence.mjs` — Owner-written control, one proof requirement and cadence are implemented; revisions, multiple requirements per control through the UI and framework mappings are not. |
| READINESS-001 | partial | `src/evidence/storage.ts`; `src/evidence/model.ts`; `src/evidence/view.ts`; `tests/evidence.mjs` — The desk organizes controls, receipts and period gaps; framework readiness, effectiveness trends and executive reporting are missing. |
| PROOF-001 | done | `src/evidence/upload.ts`; `src/evidence/storage.ts`; `src/evidence/http.ts`; `tests/evidence.mjs` |
| GAP-001 | done | `src/evidence/model.ts`; `src/evidence/storage.ts`; `tests/evidence.mjs` |
| COLLECTION-001 | missing | — |
| CONNECT-001 | missing | — |
| CLOUD-001 | missing | — |
| CODE-001 | missing | — |
| IDENTITY-001 | missing | — |
| HRIS-001 | missing | — |
| DEVICE-001 | missing | — |
| VULN-001 | missing | — |
| INVENTORY-001 | missing | — |
| TEST-001 | missing | — |
| REMEDY-001 | missing | — |
| WORK-001 | missing | — |
| FOLLOWUP-001 | missing | — |
| RISK-001 | missing | — |
| VENDOR-001 | missing | — |
| VENDOR-002 | missing | — |
| POLICY-001 | missing | — |
| ATTEST-001 | missing | — |
| TRAIN-001 | missing | — |
| LIFECYCLE-001 | missing | — |
| ACCESS-001 | missing | — |
| REVIEW-001 | done | `src/evidence/review/http.ts`; `src/evidence/review/storage.ts`; `tests/review.mjs`; `tests/review-browser.mjs` |
| AUDIT-001 | partial | `src/evidence/review/http.ts`; `src/evidence/review/storage.ts`; `tests/review.mjs` — Expiring scoped read-only folders and access history exist; authenticated auditor collaboration, requests, comments and findings are missing. |
| TRUST-001 | partial | `src/evidence/review/http.ts`; `tests/review.mjs` — Scoped expiring reviewer downloads are implemented; trust publication, customer access requests, NDA integrations and domains are missing. |
| ANSWER-001 | missing | — |
| IMPORT-001 | done | `src/evidence/import/http.ts`; `src/evidence/import/plan.ts`; `tests/import.mjs`; `docs/DRATA-IMPORT.md` |
| MIGRATE-001 | partial | `src/evidence/import/plan.ts`; `src/evidence/import/http.ts`; `tests/import.mjs` — Only the documented Drata archive shape is implemented and exercised with synthetic fixtures; Vanta, Secureframe, broader objects and live migration validation are missing. |
| CUSTODY-001 | done | `src/evidence/archive/http.ts`; `src/evidence/archive/restore.ts`; `tests/archive.mjs`; `scripts/archive.mjs` |
| PORTABLE-001 | partial | `src/evidence/archive/inventory.ts`; `src/evidence/archive/restore.ts`; `src/evidence/import/archive-schema.ts`; `tests/archive.mjs` — Existing custody transfer is complete for its implemented domain; target program records, whole-product erasure fences and a permanent product action audit are not implemented. |
| AUTH-001 | partial | `src/auth.server.ts`; `src/evidence/http.ts`; `tests/evidence.mjs`; `tests/email-link.mjs`; `tests/agent.mjs` — Native owner sessions, same-origin guards and scoped prepare-only agents exist; organizational roles, SSO, SCIM and delegated approvals are missing. |
| SECURE-001 | partial | `src/evidence/upload.ts`; `src/evidence/storage.ts`; `src/evidence/review/http.ts`; `tests/evidence.mjs`; `tests/review.mjs` — Owner access, verified attachment responses and narrowly scoped reviewer projections exist; target record permissions, complete flow declarations and new provider/key custody do not. |
| ERASE-001 | missing | — |
| LOG-001 | partial | `src/evidence/review/storage.ts`; `src/evidence/agent/storage.ts`; `tests/review.mjs`; `tests/agent.mjs`; `tests/import.mjs` — Reviewer access events, agent decisions and import custody history exist; a unified product action audit and erasure anonymization do not. |
| OPS-001 | partial | `SEED-COMMAND-CONTRACT.md`; `src/auth.server.ts`; `tests/evidence.mjs`; `tests/archive.mjs`; `tests/email-link.mjs` — Current CLI/auth/custody journeys are exercised; target collectors, durable scheduled obligations, all-operation outcomes and provider cost disclosure are missing. |
| MOBILE-001 | partial | `tests/browser.mjs`; `tests/review-browser.mjs`; `src/evidence/view.ts`; `public/desk.css`; `public/review.css` — Existing owner/reviewer custody flows have 1440/390 browser journeys; new program/employee workflows, mobile camera validation and independent accessibility conformance are unproven. |
| PUBLIC-001 | done | `src/auth.server.ts`; `tests/site.mjs`; `tests/evidence.mjs`; `tests/browser.mjs`; `tests/review-browser.mjs` |
| AGENT-001 | done | `src/evidence/agent/http.ts`; `src/evidence/agent/storage.ts`; `tests/agent.mjs`; `docs/AGENT-COMMANDS.md` |
| AGENT-002 | missing | — |
| AGENT-003 | missing | — |
| AGENT-004 | missing | — |
| AGENT-005 | missing | — |
| AGENT-006 | missing | — |
| AI-001 | missing | — |
| BOUNDARY-001 | partial | `src/evidence/model.ts`; `src/evidence/review/http.ts`; `tests/evidence.mjs`; `tests/review.mjs` — The current desk distinguishes assertion/custody from control operation and shares reviewer evidence; target program applicability, specialist handoffs, agreements and cost disclosures are unbuilt. |

**Clause totals:** 50 — 7 done / 12 partial / 31 missing.
