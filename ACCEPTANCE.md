# Target acceptance

Target date: **16 October 2026**. This extends the original first-release journey list to the complete Evidence product. Every named contract clause has one acceptance item below, in the existing journey-list form. Status describes current code at `74d8dbbfd719403a4fd610518df257ee6e3851fb`, not a promised release or a test-run receipt. `done` clauses have implemented behavior and cited existing tests; `partial` and `missing` items are work for build rounds. Planned UI names are acceptance destinations, not present capabilities.

A passing proof-custody test cannot stand in for a passing compliance/control test. Provider integrations require authorized real sandbox source/readback acceptance before they are done; unit fakes at network/paid edges alone cannot establish provider operation. No live provider, model, SSO, migration or regulated-data acceptance is claimed here. Keep original failures, unknown periods, denied authority and unavailable bytes in the end-state evidence. Use realistic US business data without secrets in logs or committed fixtures.

## Journeys by clause

### Program and readiness

- **PROGRAM-001 — Framework programs and applicability · missing.** From the program-setup UI, create each of the four core programs for a US SaaS business, choose two scoped products and different periods, review applicability with an assessor, then upgrade one framework edition. Reopen the program and export it: owners, exclusions, edition history and unresolved obligations survive; excluded work is visible and no certification is asserted.

  Current evidence: —.

- **PROGRAM-002 — Reusable mappings and accountable ownership · missing.** In the program UI map an access-review control to SOC 2, ISO 27001 and HIPAA, assign an owner and contributor, attach period evidence once, and inspect all three mappings. Remove an asset from scope with a reason: earlier denominators and the changed-definition label remain in the audit-period report.

  Current evidence: —.

- **CONTROL-001 — Custom controls and testing intent · partial.** Create a custom production-access control through the control form, add two evidence requirements and a custom framework mapping, revise its test intent after a failed observation, then view both revisions in the historical report. The earlier failure keeps its original meaning.

  Current evidence: `src/evidence/storage.ts`; `src/evidence/http.ts`; `tests/evidence.mjs`. Current limit: Owner-written control, one proof requirement and cadence are implemented; revisions, multiple requirements per control through the UI and framework mappings are not.

- **READINESS-001 — Readiness, trend and executive reports · partial.** From readiness, compare current and prior audit periods with a stale connector, failed test, accepted exception and missing policy attestation. Follow every displayed total to records, export the report, and reconcile counts and period boundaries. A filtered or failed read cannot create a passing result.

  Current evidence: `src/evidence/storage.ts`; `src/evidence/model.ts`; `src/evidence/view.ts`; `tests/evidence.mjs`. Current limit: The desk organizes controls, receipts and period gaps; framework readiness, effectiveness trends and executive reporting are missing.

### Evidence provenance and continuous observation

- **PROOF-001 — Immutable exhibits and attributable receipts · done.** Use `/app/controls` and the requirement upload form, attempt forged receipt facts, replace an exhibit, reload its original receipt and download both versions. Attempt a double replacement, oversized upload and changed/missing object: refuse unsafe writes/downloads and retain facts. `tests/evidence.mjs` exercises these production HTTP doors.

  Current evidence: `src/evidence/upload.ts`; `src/evidence/storage.ts`; `src/evidence/http.ts`; `tests/evidence.mjs`.

- **GAP-001 — Honest period-specific proof coverage · done.** At the desk select daily, weekly, monthly and quarterly periods, advance across their deadlines and inspect a superseded period, imported-only proof and changed/missing R2 bytes. Reopen a completed historical period and confirm the original state logic. `tests/evidence.mjs` exercises these cases through `/api/desk` and receipt downloads.

  Current evidence: `src/evidence/model.ts`; `src/evidence/storage.ts`; `tests/evidence.mjs`.

- **COLLECTION-001 — Scheduled source collection with visible failures · missing.** Connect a real authorized sandbox via the Connections UI, schedule collection, close the browser, change the source and inspect the next run. Revoke a required scope, throttle a page and interrupt a run; reconnect and resume. The run history and period report preserve missing coverage, failure and recovery separately; only actual source reads issue observed receipts.

  Current evidence: —.

- **CONNECT-001 — Least-privilege integration custody and custom collectors · missing.** Authorize, rotate, revoke and reconnect a provider through Connections; attempt cross-tenant use and export/restore. Validate that secrets never appear and restored connectors remain inactive. Install one owner-reviewed private collector, inspect unsupported resources and a lost connection, and reconcile its read-only output with the actual private source.

  Current evidence: —.

- **CLOUD-001 — AWS, Google Cloud and Microsoft Azure · missing.** For each provider, connect an authorized sandbox through Connections, discover a child account/project/subscription, and run a public-storage and privileged-MFA test. Change a setting in the real provider, re-test, and revoke one read permission. The failing resource, missing coverage, original observations and recovery are individually visible.

  Current evidence: —.

- **CODE-001 — GitHub and GitLab change assurance · missing.** Connect each code host, select two repositories and run branch-protection and reviewed-change tests. Merge an authorized reviewed change, remove protection on one repository and revoke access to the other. Inspect source links, event period coverage, failure and unknown states without exposing repository secrets.

  Current evidence: —.

- **IDENTITY-001 — Google Workspace, Microsoft 365, Entra ID and Okta · missing.** For each named identity service connect a tenant via Connections, ingest an admin, employee, guest and service account, and test MFA and inactive-user access. Disable one real account and deny one scope. Reconcile duplicates with a human decision and inspect fresh source readback and incomplete coverage.

  Current evidence: —.

- **HRIS-001 — BambooHR, Gusto and Rippling personnel sources · missing.** Connect each named HRIS, import a joiner, mover and leaver, then correct a start date and terminate an account in the real source. The People UI shows source priority, conflict review, correct obligations and no collected payroll or tax identifiers.

  Current evidence: —.

- **DEVICE-001 — Jamf, Microsoft Intune and CrowdStrike posture · missing.** Connect each named service, match a device to a person, change encryption/patch or sensor-health state in a sandbox and run a fresh test. A missing device feed or unmatched endpoint stays a gap; the original failed posture and correction remain attributable.

  Current evidence: —.

- **VULN-001 — Tenable and Qualys vulnerability evidence · missing.** Connect each scanner via Connections, ingest a finding, link it to a control and remediation task, accept a time-bounded exception and let it expire. Correct the sandbox issue and perform a fresh scanner read; only verified resolution closes the compliance obligation, with original findings retained.

  Current evidence: —.

- **INVENTORY-001 — Unified assets, people and ownership · missing.** Open Inventory after connecting HRIS, identity, cloud and MDM sources; reconcile a duplicate person/device, assign an unowned service and retire an asset. Export the scope and reconcile counts with source lists. Removing connector permission cannot retire an asset or silently shrink test coverage.

  Current evidence: —.

- **TEST-001 — Continuous control tests and exception discipline · missing.** From a mapped control enable a scheduled MFA or reviewed-deployment test, fail a real source setting and inspect all resource results. Tune scope with an expiring exception, interrupt collection, and revise criteria. A later pass, expired exception or revised denominator never erases the earlier failure or fills an unobserved period.

  Current evidence: —.

### Remediation and follow-through

- **REMEDY-001 — Failed test to verified remediation · missing.** Fail a real connected control, follow its Remediate action, assign an owner and due date, attach a change and mark work done before fixing the source. The obligation remains open. Fix the source, re-test and observe verified closure; regress it and confirm reopening with both observations retained.

  Current evidence: —.

- **WORK-001 — Vector, Jira and Linear remediation links · missing.** For each destination connect an authorized project, create a task from one failed control, change assignee/status on both sides and deliver the same event twice. Inspect conflict and delivery failures, then close the remote task while the test still fails: Evidence keeps the compliance obligation open until re-test.

  Current evidence: —.

- **FOLLOWUP-001 — Email, Slack and Microsoft Teams follow-up · missing.** Configure each named channel/provider, let a due obligation escalate across a DST/business-calendar boundary with the browser closed, then restart the worker. Simulate a network-edge timeout and reconnect authorization; inspect delivery uncertainty without duplicate task closure. Complete or pause the obligation and verify later reminders stop while history remains.

  Current evidence: —.

### Risk and third parties

- **RISK-001 — Risk register and treatment lifecycle · missing.** Create a risk from a failing control in Risk Register, score it, assign mitigation, approve a time-bounded residual-risk acceptance and export the register. Let approval expire and inspect escalation; a passing re-test updates treatment evidence without rewriting the original assessment.

  Current evidence: —.

- **VENDOR-001 — Vendor inventory and security diligence · missing.** Onboard a US SaaS supplier through Vendors, request a SOC 2 report and BAA where applicable, collect a questionnaire response and record a finding. Approve with an expiring condition, reach renewal, and inspect overdue reassessment reminders and the unchanged original documents. An expired supplier link cannot read or mutate another vendor.

  Current evidence: —.

- **VENDOR-002 — Vendor discovery and risk-based follow-through · missing.** Connect an authorized application source and one named spend source, discover an unknown vendor and duplicate, review proposed matching/tier, then approve diligence. Change its access and reach its review date: a new assessment starts, missing replies escalate and rejected candidates receive no external requests.

  Current evidence: —.

### Policies, employees and access

- **POLICY-001 — Policy library, approval and version control · missing.** From Policies tailor a template to connected business facts, review an exact revision, reject a changed draft, then publish and map it to two frameworks. Reach its review deadline and publish a replacement: original approval and attestations remain, with new required acknowledgments visible.

  Current evidence: —.

- **ATTEST-001 — Employee policy attestations · missing.** Assign a policy revision to an employee and contractor, sign in as each and acknowledge one while leaving the other overdue. Publish a material revision and inspect reassignment/reminders. Terminate one person and confirm denied access with retained time/version/identity evidence in the audit export.

  Current evidence: —.

- **TRAIN-001 — Security awareness and KnowBe4 evidence · missing.** Create an onboarding and annual campaign in Training, enroll a new hire, complete an approved internal course and ingest a real KnowBe4 sandbox completion. Leave another learner overdue, amend the schedule, and verify reminders, original result provenance and an auditor export without fabricated completions.

  Current evidence: —.

- **LIFECYCLE-001 — Joiner, mover and leaver compliance · missing.** Change a joiner, mover and leaver in an authorized HRIS; follow their checklists in People, assign tasks, and attempt to close leaver work with an active Okta account. It remains open and escalates. Disable the real account, re-read identity/device sources and verify closure with historical worker evidence preserved.

  Current evidence: —.

- **ACCESS-001 — Quarterly access-review campaigns · missing.** Start a quarterly review from Access Reviews, have two resource owners decide on employee, guest and privileged service access, and leave one decision overdue. Request revocation, keep the source account active and inspect unresolved work. Revoke in the source and re-test; export complete decisions, population and period evidence.

  Current evidence: —.

### Audit collaboration

- **REVIEW-001 — Selected expiring evidence folders · done.** Issue a folder through `/api/folders`, open its `/review/{token}` page and download only in-period exhibits. Try a crossing-period receipt, foreign control, write, altered token, expiry during a read and closed folder. Owner event history retains allowed/refused attempts without raw links. `tests/review.mjs` and `tests/review-browser.mjs` cover these doors.

  Current evidence: `src/evidence/review/http.ts`; `src/evidence/review/storage.ts`; `tests/review.mjs`; `tests/review-browser.mjs`.

- **AUDIT-001 — Period-specific auditor workspace and request lists · partial.** Invite an auditor to one engagement, import a request list, assign a request, comment and submit a period-specific exhibit. As auditor reject it, request more evidence and accept the next submission. Export the pack; another engagement and revoked auditor remain inaccessible, and the original submission and decisions remain available to authorized owners.

  Current evidence: `src/evidence/review/http.ts`; `src/evidence/review/storage.ts`; `tests/review.mjs`. Current limit: Expiring scoped read-only folders and access history exist; authenticated auditor collaboration, requests, comments and findings are missing.

### Customer assurance

- **TRUST-001 — Published and permissioned trust center · partial.** Publish an approved statement, request a restricted SOC 2 report as a prospect, complete an NDA through each named e-signature integration, approve one recipient and deny another. Check expiry/revocation, downloads and custom-domain access from a signed-out browser. An unapproved draft and another prospect’s documents never appear.

  Current evidence: `src/evidence/review/http.ts`; `tests/review.mjs`. Current limit: Scoped expiring reviewer downloads are implemented; trust publication, customer access requests, NDA integrations and domains are missing.

- **ANSWER-001 — Cited security-questionnaire completion · missing.** Upload representative XLSX, CSV and DOCX customer questionnaires in Questionnaires, generate a cited draft with one unsupported and one conflicting question, inspect citations, edit and approve an exact version. Modify a source after approval and attempt reuse/submission: require a new decision. Export and reopen the original formats without losing question placement, IDs or flagged gaps.

  Current evidence: —.

### Portability and migration

- **IMPORT-001 — Reviewed Drata archive admission and undo · done.** Through Move-in, inspect a documented-shape Drata ZIP, review mappings and refuse unsafe/malformed artifacts, admit with a journal, then undo active links. Inspect retained originals and import history after undo, restart and archive restore. `tests/import.mjs` exercises these routes; a real customer export remains separately required under MIGRATE-001.

  Current evidence: `src/evidence/import/http.ts`; `src/evidence/import/plan.ts`; `tests/import.mjs`; `docs/DRATA-IMPORT.md`.

- **MIGRATE-001 — Switch from Vanta, Drata and Secureframe · partial.** For each incumbent, use a representative authorized customer export through Move-in, preview and reconcile source totals and unsupported fields, resolve a duplicate identity, admit, export and undo. Reconnect one actual source and verify imported history stays distinct from fresh observations. If an incumbent does not export a record type, the UI names it and offers an authorized API/manual mapping route without silently dropping it.

  Current evidence: `src/evidence/import/plan.ts`; `src/evidence/import/http.ts`; `tests/import.mjs`. Current limit: Only the documented Drata archive shape is implemented and exercised with synthetic fixtures; Vanta, Secureframe, broader objects and live migration validation are missing.

- **CUSTODY-001 — Complete custody archive and empty-target restore · done.** Export through `/api/archive/export`, inspect the manifest, dry-run and restore into empty real D1/R2; compare every portable record and byte. Try altered digests, traversal, missing/unlisted files, unavailable bytes and a nonempty target. Refusal preserves the target; successful restore leaves grants inactive. `tests/archive.mjs` and `tests/review-browser.mjs` exercise HTTP/CLI custody journeys.

  Current evidence: `src/evidence/archive/http.ts`; `src/evidence/archive/restore.ts`; `tests/archive.mjs`; `scripts/archive.mjs`.

- **PORTABLE-001 — Full-program transfer and Base replacement obligations · partial.** Use the console and local archive command to export a populated program containing every record class; restore offline into an empty installation with a different owner. Reconcile table/blob inventory, original history, unavailable bytes and erasure fences. Verify no message, source mutation or external grant replays, then explicitly reauthorize one connector. Reject an unknown table and a pre-erasure archive without the required later journal.

  Current evidence: `src/evidence/archive/inventory.ts`; `src/evidence/archive/restore.ts`; `src/evidence/import/archive-schema.ts`; `tests/archive.mjs`. Current limit: Existing custody transfer is complete for its implemented domain; target program records, whole-product erasure fences and a permanent product action audit are not implemented.

### Access, integrity and operation

- **AUTH-001 — Roles, SSO and scoped authorization · partial.** Sign in through native authentication and each named SSO provider; provision and deprovision a contributor via SCIM. Attempt foreign-team reads, employee exports, self-approval and cross-origin writes; refuse them at HTTP doors. Revoke a session/token and confirm all next requests fail while authorized control owners can submit only their scoped evidence.

  Current evidence: `src/auth.server.ts`; `src/evidence/http.ts`; `tests/evidence.mjs`; `tests/email-link.mjs`; `tests/agent.mjs`. Current limit: Native owner sessions, same-origin guards and scoped prepare-only agents exist; organizational roles, SSO, SCIM and delegated approvals are missing.

- **SECURE-001 — Restricted evidence and declared external flows · partial.** Upload hostile HTML/SVG and a sensitive employee document, verify safe attachment handling, then try unauthorized record reads and publication. Enable one model/connector only after reviewing its data flow, rotate its key and simulate unavailable custody. Inspect logs and exports for secret exclusion and explicit failure; revoked access fails on the next read.

  Current evidence: `src/evidence/upload.ts`; `src/evidence/storage.ts`; `src/evidence/review/http.ts`; `tests/evidence.mjs`; `tests/review.mjs`. Current limit: Owner access, verified attachment responses and narrowly scoped reviewer projections exist; target record permissions, complete flow declarations and new provider/key custody do not.

- **ERASE-001 — Explicit erasure, holds and restore fencing · missing.** In Privacy, preview and confirm each entity and business erasure with linked imports, receipts, blobs and active shares. Verify exact stored bytes/derivatives disappear, all grants fail, held items are disclosed and actor references anonymize. Restore a pre-erasure archive with the later journal: erased content and authority cannot resurrect. Interrupt a provider deletion and inspect pending work rather than a false completion.

  Current evidence: —.

- **LOG-001 — Permanent accountable action audit · partial.** Perform an import/undo, folder read/refusal, approval, source change, failed send and erasure through their public doors. Inspect and export the audit, restart, then restore. Every attempted sensitive action and its outcome remains attributable without secrets; an erased actor is anonymous and an interrupted send remains uncertain until resolved.

  Current evidence: `src/evidence/review/storage.ts`; `src/evidence/agent/storage.ts`; `tests/review.mjs`; `tests/agent.mjs`; `tests/import.mjs`. Current limit: Reviewer access events, agent decisions and import custody history exist; a unified product action audit and erasure anonymization do not.

- **OPS-001 — Durable operation, health and recovery · partial.** Use documented setup/dev/build commands, omit a required setting, restart during a collection and notification, and interrupt storage. Inspect health and durable outcomes, recover from a complete backup and apply an additive migration without changing historical evidence. Attempt a documented size bound and inspect explicit refusal and the USD cost/configuration explanation.

  Current evidence: `SEED-COMMAND-CONTRACT.md`; `src/auth.server.ts`; `tests/evidence.mjs`; `tests/archive.mjs`; `tests/email-link.mjs`. Current limit: Current CLI/auth/custody journeys are exercised; target collectors, durable scheduled obligations, all-operation outcomes and provider cost disclosure are missing.

- **MOBILE-001 — Responsive and accessible complete workflows · partial.** With realistic program data, use desktop and phone browsers to complete each role’s journey, upload a phone file/photo, resolve an error and return from a task notification. Inspect every end state at both widths, use keyboard navigation and a screen reader, and verify no hidden controls, color-only states or cross-role disclosures.

  Current evidence: `tests/browser.mjs`; `tests/review-browser.mjs`; `src/evidence/view.ts`; `public/desk.css`; `public/review.css`. Current limit: Existing owner/reviewer custody flows have 1440/390 browser journeys; new program/employee workflows, mobile camera validation and independent accessibility conformance are unproven.

- **PUBLIC-001 — Preserve the approved installation and run surfaces · done.** Build the run site, follow the homepage Run/docs links without JavaScript, and inspect installed Lobby before and after setup. Existing browser journeys inspect the approved owner/reviewer flows at 1440 and 390. `tests/site.mjs`, `tests/evidence.mjs`, `tests/browser.mjs` and `tests/review-browser.mjs` are the existing checks.

  Current evidence: `src/auth.server.ts`; `tests/site.mjs`; `tests/evidence.mjs`; `tests/browser.mjs`; `tests/review-browser.mjs`.

### Push further: agents accountable to the compliance job

- **AGENT-001 — Prepare-only proposals with exact human approval · done.** Issue a prepare token, inspect gaps and propose a folder through agent commands/API. Attempt direct sharing, owner-only mutation, approval with an agent token and stale-snapshot approval; refuse each. Have the owner approve the current snapshot, revisit its immutable decision and revoke the token. `tests/agent.mjs` exercises these doors.

  Current evidence: `src/evidence/agent/http.ts`; `src/evidence/agent/storage.ts`; `tests/agent.mjs`; `docs/AGENT-COMMANDS.md`.

- **AGENT-002 — Prove operation across the audit period · missing.** From a period report ask the agent to investigate a control that passes its latest snapshot but had a documented mid-period privilege/merge violation and a missing event window. Follow its citations to original sources; both the failure and unknown interval appear. Reject its proposed exception and verify no mapping, pass or auditor decision changes.

  Current evidence: —.

- **AGENT-003 — Investigate, fix narrowly and re-test the real system · missing.** Fail a real sandbox control, ask the agent to investigate and propose a change, reject one revision and approve the next with one-resource authority. Attempt an out-of-scope write and revoke an in-flight grant: prevent further unauthorized work. Execute the permitted fix, read back from the real provider, independently re-test and verify closure without erasing the original failure. A failed fix stays open with escalation and rollback evidence.

  Current evidence: —.

- **AGENT-004 — Maintain collectors without manufacturing evidence · missing.** Break a sandbox connector scope/schema, remove an asset from a page and stale its source timestamp. Ask the agent for a diagnosis and connector patch, review the diff and approve read-only scopes, then compare output with the actual source inventory. Original gaps remain, and no production activation or unsupported pass happens before approval.

  Current evidence: —.

- **AGENT-005 — Keep customer promises current · missing.** Approve an answer and trust statement linked to a passing control and contract obligation, then fail the control and change the source policy. Inspect invalidation, affected customer commitments and cited revision. Attempt to reuse/export/send the stale answer; require a fresh authorized decision and retain the prior external version and recipient history.

  Current evidence: —.

- **AGENT-006 — Tailor policies, risks and structured obligations · missing.** Ask the agent to interpret a US customer security addendum and selected framework material alongside the actual asset inventory. Inspect clause citations, proposed controls, policy/risk diffs and one ambiguous obligation. Reject a proposed interpretation and approve another: only the approved exact revision enters the program and downstream work.

  Current evidence: —.

- **AI-001 — AI inventory and governance · missing.** Discover an unapproved AI tool through an authorized source, review its data access and owner, link a risk and acceptable-use policy, and approve only a bounded use case. Change its permissions, rerun governance checks and inspect the reopened review. An unapproved provider cannot receive evidence or execute an agent job.

  Current evidence: —.

### Honest product boundaries

- **BOUNDARY-001 — US-first scope and independent specialist services · partial.** Onboard a US business, choose a HIPAA/PCI scope, inspect data-processing prerequisites and assessor handoff, review USD module/provider costs, and export an evidence pack for an independent assessor. Follow linked remediation to Vector and source checks to the named specialist providers. No UI/report claims certification, legal sufficiency or operation of an external system without source evidence.

  Current evidence: `src/evidence/model.ts`; `src/evidence/review/http.ts`; `tests/evidence.mjs`; `tests/review.mjs`. Current limit: The current desk distinguishes assertion/custody from control operation and shares reviewer evidence; target program applicability, specialist handoffs, agreements and cost disclosures are unbuilt.

## Running the relevant checks

The current public-door suites are `tests/evidence.mjs` (native owner access, receipts and periods), `tests/review.mjs` (scoped public folders), `tests/archive.mjs` (HTTP/CLI custody transfer), `tests/import.mjs` (Drata-shaped import and undo), `tests/agent.mjs` (prepare-only authority and exact approval), and `tests/email-link.mjs` (native sign-in). Browser journeys are `tests/browser.mjs` and `tests/review-browser.mjs` at 1440 and 390; `tests/site.mjs` follows the built public run/docs site. Use the pinned CLI and commands in README.md and SEED-COMMAND-CONTRACT.md. Run touched checks locally and the complete existing Verify wall in CI; no release status above bypasses it. `node scripts/edition-authoring/cli.mjs check` validates source provenance, including these documents.

For each new user flow, build rounds must exercise the named public door, persistence/restart, refusal/error path, actor permissions and final state in the journey. Inspect each changed screen at 1440 and 390 with realistic data; provider acknowledgments are separate from source truth and human decisions. Certification, independent assessor judgment, legal applicability, outside-provider reliability and copies already downloaded remain the declared boundaries in BOUNDARY-001, rather than fabricated acceptance results.

**Clause totals:** 50 — 7 done / 12 partial / 31 missing.
