# Evidence Agent surface (draft)

Draft Agent surface for Evidence, written by ct on 28 October 2026 to the contract standard's section 13. It maps every Core clause of `CONTRACT.md` at main `906a1bbec67879ae25ac4621e65256dc08998f3b` (80 Core clauses). It is not part of CONTRACT.md yet: the seed's contract cleanup folds the `### Agent surface` area below into CONTRACT.md as the last area under Target clauses, and the rows under "Status rows" into its Status table. Old clauses whose text fixes what happens to an agent's step: AGENT-001, AGENT-002, AGENT-003, AGENT-004, AGENT-005, AGENT-006, AGENT-007, AI-001, API-001, APPS-001, AUTH-001, CONTROL-001, VENDOR-002, WORK-001; the cleanup rewords them as the class the step carries.

### Agent surface

**Specialist: Compliance operations lead.** It keeps the business's controls, period evidence, remediation, personnel obligations, supplier diligence and customer assurances current and traceable to their sources.

Inherits BASE-AGENT-001 to BASE-AGENT-013. The company's policy decides every call.

**How Evidence computes each class.** The server derives classes and facts from typed arguments, native target records, current recipient membership, stored source relationships and the content actually accessed; caller assertions and instructions inside records cannot lower them. A local record read does not itself contact its source provider. Every row denotes a target tool; Today names the current native action, including partial implementations, and does not claim an existing MCP tool.

- *standard:* local reads, retained drafts, prospective definitions, reversible assignments and internal messages or record shares. Facts: affected item count. Appending a revision preserves its predecessor; undoing a business change keeps custody and history.
- *external:* a call contacts an outside provider, sends outside the business, or exposes records to an outside audience. Facts: actual recipients or destination accounts, recipient count and counterparty: known for an existing vendor/customer or a company-trusted domain, new otherwise, public for an open publication. Connecting an existing provider account is not creating one. Replacing content already shared outside carries external too.
- *commitment:* an exact-version sign-off, accepted exception, residual-risk acceptance, auditor disposition, vendor decision or customer security promise that others rely on. Facts: exact revision, counterparty and stated value, or explicitly unstated value. A draft, correction request or dismissal carrying no sign-off is standard.
- *access:* creating, changing or ending staff membership, roles, sessions, collector/API/agent grants, engagement identities or standing customer authority; ownership/handover, privacy classification and source repairs add access when their native targets change effective privileges. Facts: affected people or identities and widens/narrows, calculated against the current effective rights. Item-only sharing is standard or external instead.
- *security:* handling provider credentials or changing encryption custody, MFA, protected-record publication, outbound-flow declarations, callback verification or protective source configuration. Facts: setting, provider/account and scope; secret values are excluded from results and facts.
- *destructive:* executing erasure that cannot be undone in Evidence. Facts: item count and stores affected, with retained holds and unfinished deletion separately identified. Retiring a resource or unlinking a reversible association is standard.
- *sensitive:* the actual returned, stored, deleted or transmitted content includes health, government ID, bank, card or payroll numbers. Facts: record count and protected kind. General personnel names, private code, cost figures and a sensitive label alone do not establish this class; classification uses protected fields and content, conservatively retaining the class when protected contents cannot be determined. Masked projections without protected content do not carry it.
- *live:* a source repair changes a running user-facing service, or a collector revision is activated on the running installation. Facts: service and target environment; an isolated sandbox patch without service users does not acquire live merely from its name.

Evidence uses no money, accounts or gated class: this registry neither charges nor changes a payable price, provisions outside accounts nor performs provider-kept interactive steps. Recorded vendor spend, estimates and provider USD disclosures are facts, not money movement. In the table, a single class is fixed, `a · b` means both, `a or b` is decided per call, and `(+ c)` adds c when its computation applies. Parenthesized additions apply to the entire preceding expression.

| Tool | Does | Core clauses | Risk class | Today |
| --- | --- | --- | --- | --- |
| `evidence.desk.get` | Read period coverage and original receipt facts | GAP-001, PROOF-001 | standard (+ sensitive) | `GET /api/desk` |
| `evidence.receipts.get` | Read one receipt and byte availability | PROOF-001, SECURE-001 | standard (+ sensitive) | `GET /api/receipts/{id}` |
| `evidence.exhibits.read` | Download verified original bytes | PROOF-001, SECURE-001 | standard (+ sensitive) | `GET /api/receipts/{id}/download` |
| `evidence.exhibits.upload` | Append an exhibit or explicit replacement to a requirement | PROOF-001, API-001 | standard or external (+ sensitive) | `POST /app/requirements/{id}/uploads`; `POST /v1/evidence` |
| `evidence.programs.list` | List programs and scope | PROGRAM-001, PROGRAM-004 | standard (+ sensitive) | `GET /api/programs` |
| `evidence.programs.create` | Create a framework program and its initial scope | PROGRAM-001, PROGRAM-004 | standard | `POST /api/programs` |
| `evidence.programs.revise` | Revise scope, figures, applicability or framework edition prospectively | PROGRAM-001, PROGRAM-004 | standard | `POST /api/programs/{id}` and native applicability, inputs, state-changes and editions actions |
| `evidence.controls.get` | Read definitions, mappings, ownership and retained revisions | CONTROL-001, PROGRAM-002 | standard (+ sensitive) | `GET /api/controls/{id}` |
| `evidence.controls.create` | Create a custom control and initial requirement | CONTROL-001 | standard | `POST /app/controls` |
| `evidence.controls.revise` | Append a control definition | CONTROL-001 | standard | `POST /api/controls/{id}/revisions` |
| `evidence.controls.map` | Add an exact framework mapping | CONTROL-001, PROGRAM-002 | standard | `POST /api/controls/{id}/mappings` |
| `evidence.controls.unmap` | Unlink a mapping with retained history | PROGRAM-002 | standard | `POST /api/controls/{id}/mappings/{mapping}/remove` |
| `evidence.controls.assign` | Assign ownership/contribution with effective scope computed | PROGRAM-002, LIFECYCLE-002 | standard (+ access) | `POST /api/controls/{id}/owners` |
| `evidence.controls.scope` | Record a prospective asset-scope revision | PROGRAM-002, INVENTORY-001 | standard | `POST /api/controls/{id}/scope` |
| `evidence.requirements.create` | Add an evidence requirement | CONTROL-001 | standard | `POST /api/controls/{id}/requirements` |
| `evidence.requirements.revise` | Append requirement wording or testing intent | CONTROL-001 | standard | `POST /api/requirements/{id}/revisions` |
| `evidence.requirements.schedule` | Set cadence, anchor or one-cycle renewal date | CADENCE-001 | standard | Native `/api/requirements/{id}/schedule` and `/renewal-date` actions |
| `evidence.frameworks.create` | Create a custom framework without importing a file | CONTROL-001 | standard | `POST /api/frameworks` |
| `evidence.frameworks.revise` | Append a custom requirement revision | CONTROL-001 | standard | `POST /api/frameworks/{id}/requirements/{requirement}` |
| `evidence.library.list` | Read control catalog, remediation guidance and available revisions | LIBRARY-001 | standard | `GET /api/library` |
| `evidence.library.adopt` | Accept a prospective library revision | LIBRARY-001 | commitment | `POST /api/library/revisions/{revision}` |
| `evidence.documents.generate` | Generate a cited framework document draft | PROGRAM-003, PROGRAM-004 | standard (+ sensitive) | `POST /api/programs/{id}/documents` |
| `evidence.documents.get` | Read a document and its exact revisions | PROGRAM-003, PROGRAM-004 | standard (+ sensitive) | `GET /api/programs/{id}/documents/{kind}` |
| `evidence.documents.revise` | Append an edited document revision | PROGRAM-003, PROGRAM-004 | standard (+ sensitive) | `POST /api/programs/{id}/documents/{kind}/revisions` |
| `evidence.documents.reconcile` | Append reconciliation against current program facts | PROGRAM-003, PROGRAM-004 | standard (+ sensitive) | `POST /api/programs/{id}/documents/{kind}/reconcile` |
| `evidence.documents.decide` | Record an exact document sign-off | PROGRAM-003, PROGRAM-004 | commitment (+ sensitive) | Native document `/approvals` action |
| `evidence.documents.export` | Export a document at a selected revision | PROGRAM-003, PROGRAM-004 | standard (+ sensitive) | `GET /api/programs/{id}/documents/{kind}/export` |
| `evidence.program_audits.record` | Record an internal audit and independence statement | PROGRAM-003 | standard | `POST /api/programs/{id}/audits` |
| `evidence.program_findings.record` | Record an internal-audit nonconformity or corrective action | PROGRAM-003 | standard | Native program audit `/findings` action |
| `evidence.management_meetings.record` | Record management inputs, decisions and actions | PROGRAM-003 | commitment | `POST /api/programs/{id}/management-reviews` |
| `evidence.readiness.get` | Read readiness, denominators and historical trend | READINESS-001, GAP-001 | standard (+ sensitive) | `GET /api/programs/{id}`; native readiness computation |
| `evidence.reports.export` | Export the board report or assessor handoff with prerequisites and USD costs | READINESS-001, BOUNDARY-001 | standard (+ sensitive) | `GET /api/programs/{id}/board`; `/handoff` |
| `evidence.resources.list` | Read retained source resources and versions | API-001, INVENTORY-001 | standard (+ sensitive) | `GET /v1/resources`; `GET /api/inventory/record` |
| `evidence.resource_types.define` | Define a typed pushed-resource schema | API-001 | standard | `PUT /v1/resource-types/{type}` |
| `evidence.resources.upsert` | Upsert source-reported resources without inventing observations | API-001, INVENTORY-001 | standard (+ sensitive) | `PUT /v1/resources/{type}` |
| `evidence.resources.retire` | Mark absent or explicitly removed resources with retained history | API-001, INVENTORY-001 | standard | `DELETE /v1/resources/{type}/{uniqueId}`; native full-sync semantics |
| `evidence.vulnerabilities.list` | Read source and manual findings, SLA history and retest provenance | VULN-001, VULN-002 | standard (+ sensitive) | `GET /api/vulnerabilities`; `/api/vulnerabilities/source-findings`; current source subset only |
| `evidence.vulnerabilities.mark_fixed` | Record awaiting-verification state without closing a finding | VULN-001, VULN-002 | standard | Native vulnerability `/fixed` action; scanner lifecycle none |
| `evidence.vulnerability_retests.attach` | Retain an immutable tester letter or report for a finding | VULN-002 | standard (+ sensitive) | Native vulnerability `/retests` action |
| `evidence.vulnerability_retests.decide` | Accept exact retest evidence or dismiss it with a reason | VULN-002 | standard or commitment (+ sensitive) | Native vulnerability retest `/decision` action |
| `evidence.inventory.group` | Group or separate canonical reporting identities without merging People | INVENTORY-001 | standard | `POST /api/inventory/groups` |
| `evidence.inventory.annotate` | Record owner, criticality, scope or lifecycle metadata | INVENTORY-001 | standard | `POST /api/inventory/decisions` |
| `evidence.identities.match` | Record an explicit source-account to People match | IDENTITY-001, CODE-001, INVENTORY-001 | standard | `POST /api/identities/{id}/match` |
| `evidence.connections.list` | Read connection scopes, catalog coverage, failures and cost disclosures | CONNECT-001, COLLECTION-001 | standard | `GET /api/connections` |
| `evidence.connections.authorize` | Bind an existing source account and its credential to exact scopes | CONNECT-001, CLOUD-001, CLOUD-002, CODE-001, IDENTITY-001, APPS-001, MONITOR-001, HRIS-001, DEVICE-001, VULN-001, ISSUES-001, VENDOR-002, AI-001 | access · security (+ external) | `POST /api/connections` for current hosted sources; later sources none |
| `evidence.connections.rotate` | Replace a bound source credential | CONNECT-001, SECURE-001 | access · security | `POST /api/connections/{id}/rotate` |
| `evidence.connections.revoke` | End source authority and destroy its credential | CONNECT-001 | access · security | `POST /api/connections/{id}/revoke` |
| `evidence.connections.select` | Revise selected repositories or account scope | CODE-001, CONNECT-001 | access | `POST /api/connections/{id}/repositories` |
| `evidence.connections.schedule` | Set an elapsed collection schedule | COLLECTION-001 | standard | `POST /api/connections/{id}/schedule` |
| `evidence.connections.grant_events` | Change a connection-bound event-token grant | COLLECTION-001, API-001 | access · security | `POST /api/connections/{id}/events/permissions` |
| `evidence.connections.collect` | Read the selected hosted source and retain observations and explicit gaps | COLLECTION-001, CLOUD-001, CLOUD-002, CODE-001, IDENTITY-001, APPS-001, MONITOR-001, HRIS-001, DEVICE-001, VULN-001, ISSUES-001, VENDOR-002, AI-001 | external (+ sensitive) | `POST /api/connections/{id}/collect` for current sources; future source collectors none |
| `evidence.connections.report` | Read period context, attempts, unknown windows and source references | COLLECTION-001, CODE-001 | standard (+ sensitive) | `GET /api/connections/{id}/report` |
| `evidence.source_events.record` | Admit an idempotent source hint without issuing a receipt | COLLECTION-001, API-001 | standard | `POST /v1/connections/{id}/events` |
| `evidence.collectors.register` | Register an exact private collector profile and receiving grant | CONNECT-001 | access · security | `POST /api/collectors` |
| `evidence.collectors.rotate` | Replace a collector receiving credential | CONNECT-001 | access · security | `POST /api/collectors/{id}/rotate` |
| `evidence.manifests.capture` | Retain exact selected repository originals under the source grant | CODE-001 | external (+ sensitive) | Native `src/evidence/connect/manifests.ts` actions; current four root paths only |
| `evidence.tests.list` | Read criteria, observation histories and catalog guidance | TEST-001, LIBRARY-001 | standard (+ sensitive) | `GET /api/tests`; `GET /api/tests/{id}` |
| `evidence.tests.create` | Define a custom test and mapped controls | TEST-001, API-001 | standard | `POST /api/tests`; `POST /v1/tests` |
| `evidence.tests.revise` | Append prospective criteria and cadence | TEST-001 | standard | `POST /api/tests/{id}/revisions` |
| `evidence.tests.run` | Evaluate retained resources without refreshing source timestamps | TEST-001, API-001 | standard (+ sensitive) | `POST /api/tests/{id}/run`; `POST /v1/tests/{id}/runs` |
| `evidence.exceptions.decide` | Record or dismiss an exact expiring exception | TEST-001, REMEDY-002 | standard or commitment | `POST /api/tests/{id}/exceptions` for current exception acceptance; dismissal none |
| `evidence.remediation.list` | Read obligations, per-item SLA clocks and verification history | REMEDY-001, REMEDY-002, WORK-002 | standard (+ sensitive) | `GET /api/remediation`; `GET /api/remediation/{id}` |
| `evidence.remediation.assign` | Assign or reassign accountable ownership with a reason | REMEDY-001, FOLLOWUP-002, LIFECYCLE-002 | standard | Native remediation `/assign` and `/reassign` actions |
| `evidence.remediation.acknowledge` | Record an attributable acknowledgment without closure | FOLLOWUP-002 | standard | `POST /api/remediation/{id}/acknowledge` |
| `evidence.remediation.comment` | Append an internal obligation comment | REMEDY-001 | standard (+ sensitive) | `POST /api/remediation/{id}/comments` |
| `evidence.remediation.record_change` | Attach the claimed change and keep verification separate | REMEDY-001 | standard (+ sensitive) | `POST /api/remediation/{id}/changes` |
| `evidence.remediation.mark_fixed` | Record awaiting-verification state | REMEDY-001 | standard | `POST /api/remediation/{id}/done` |
| `evidence.remediation.retest` | Read the real source again and independently evaluate the item | REMEDY-001, REMEDY-002 | external (+ sensitive) | `POST /api/remediation/{id}/retest` |
| `evidence.sla.revise` | Set prospective category/severity remediation deadlines | REMEDY-002 | standard | `POST /api/remediation/sla` |
| `evidence.trackers.connect` | Bind a destination and its read/write credential | WORK-001 | access · security (+ external) | `POST /api/trackers` |
| `evidence.trackers.rotate` | Rotate a tracker credential | WORK-001 | access · security | `POST /api/trackers/{id}/rotate` |
| `evidence.trackers.revoke` | End tracker write and callback authority | WORK-001 | access · security | `POST /api/trackers/{id}/revoke` |
| `evidence.trackers.map` | Set native field identities and ownership rules | WORK-001 | standard | `POST /api/trackers/{id}/mapping` |
| `evidence.trackers.register_callback` | Register a provider callback and its verification material | WORK-001 | external · access · security | Native tracker `/basecamp-webhook` and `/asana-webhook` actions |
| `evidence.tickets.create` | Create a mapped ticket in its selected destination | WORK-001, WORK-002 | standard or external (+ sensitive) | Native remediation `/tickets` and test `/tickets` actions |
| `evidence.tickets.read_fields` | Read native assignable people and statuses | WORK-001 | external | `GET /api/tickets/{id}/fields` |
| `evidence.tickets.update` | Write exact mapped tracker fields after conflict checks | WORK-001 | standard or external | `POST /api/tickets/{id}/fields` |
| `evidence.tickets.sync` | Read back remote fields and comments without treating closure as proof | WORK-001, WORK-002 | external (+ sensitive) | `POST /api/tickets/{id}/sync` |
| `evidence.tickets.resolve` | Resolve a recorded sync conflict at its exact revision | WORK-001 | standard or external (+ sensitive) | `POST /api/tickets/{id}/resolve` |
| `evidence.ticket_rules.revise` | Set per-item or whole-test ticket granularity | WORK-002 | standard | Native test `/ticket-settings` and `/api/tickets/defaults` actions |
| `evidence.followups.list` | Read pending, accepted, failed and uncertain deliveries | FOLLOWUP-001, FOLLOWUP-002 | standard (+ sensitive) | `GET /api/followups` |
| `evidence.followups.configure` | Set business calendar, escalation, cadence and recipient preferences | FOLLOWUP-001 | standard | Native `/api/followups/settings` and `/preferences` actions |
| `evidence.channels.connect` | Bind an existing mail, Slack or Teams channel credential | FOLLOWUP-001 | access · security (+ external) | `POST /api/followups/channels` |
| `evidence.channels.rotate` | Rotate channel verification or provider credentials | FOLLOWUP-001 | access · security | `POST /api/followups/channels/{id}/rotate` |
| `evidence.channels.revoke` | End channel authority | FOLLOWUP-001 | access · security | `POST /api/followups/channels/{id}/revoke` |
| `evidence.followups.send` | Send one reminder, failure notice or digest to computed recipients | FOLLOWUP-001, FOLLOWUP-002 | standard or external (+ sensitive) | Native `src/evidence/followup/send.ts` scheduler action |
| `evidence.followups.pause` | Pause a named obligation reminder cycle | FOLLOWUP-001 | standard | `POST /api/remediation/{id}/followups/pause` |
| `evidence.followups.resume` | Resume a named reminder cycle without replay | FOLLOWUP-001 | standard | `POST /api/remediation/{id}/followups/resume` |
| `evidence.followups.resolve` | Append a reasoned resolution beside an uncertain delivery | FOLLOWUP-001, LOG-001 | standard | `POST /api/followups/{id}/resolve` |
| `evidence.risks.list` | Read assessments, methods, treatment and expiry | RISK-001, RISK-002 | standard (+ sensitive) | `GET /api/risks`; native register export |
| `evidence.risks.create` | Create a risk from the form, library or API | RISK-001, RISK-002, API-001 | standard | `POST /api/risks`; `/api/risks/library`; `/v1/risks` |
| `evidence.risk_methods.revise` | Version scoring scales, matrix and thresholds | RISK-002 | standard | `POST /api/risks/method` |
| `evidence.risks.assess` | Append an assessment using its exact method revision | RISK-001, RISK-002 | standard | `POST /api/risks/{id}/assessments` |
| `evidence.risks.link` | Link a control, incident, vendor or affected asset | RISK-001 | standard | `POST /api/risks/{id}/links` |
| `evidence.treatments.record` | Record treatment ownership, deadlines and verification work | RISK-001 | standard | `POST /api/risks/{id}/treatments` |
| `evidence.risk_acceptances.record` | Accept time-bounded residual risk | RISK-001 | commitment | `POST /api/risks/{id}/acceptances` |
| `evidence.vendors.list` | Read supplier profiles, diligence and discovery candidates | VENDOR-001, VENDOR-002 | standard (+ sensitive) | `GET /api/vendors`; discovery candidates none |
| `evidence.vendors.create` | Record a supplier identity and business owner | VENDOR-001, VENDOR-002 | standard | `POST /api/vendors` |
| `evidence.vendors.revise` | Append profile, data-access or tier facts | VENDOR-001 | standard | `POST /api/vendors/{id}` |
| `evidence.vendor_documents.upload` | Retain an immutable supplier original | VENDOR-001 | standard (+ sensitive) | `POST /api/vendors/{id}/documents` |
| `evidence.vendor_documents.read` | Read a verified original or cited page | VENDOR-001, VENDOR-003 | standard (+ sensitive) | Native vendor document `/download` and document-review `/pages/{page}` actions |
| `evidence.supplier_requests.issue` | Issue an expiring supplier request without sending a message | VENDOR-001 | external (+ sensitive) | `POST /api/vendors/{id}/requests` |
| `evidence.supplier_requests.close` | Close an exact request link | VENDOR-001 | standard | Native vendor request or link `/close` action |
| `evidence.vendor_findings.record` | Record a cited document or answer finding | VENDOR-001, VENDOR-003 | standard (+ sensitive) | `POST /api/vendors/{id}/findings` |
| `evidence.vendor_decisions.record` | Record a supplier or finding disposition at its exact revision | VENDOR-001, VENDOR-003 | standard or commitment | Native vendor `/approvals` and finding `/decision` actions |
| `evidence.vendor_readings.prepare` | Extract cited SOC fields, CUECs, exceptions and bridge gaps | VENDOR-003 | standard (+ sensitive) | Native document or request `/reviews` action; readable PDF/text/transcript only |
| `evidence.vendor_readings.correct` | Append a source-supported extraction correction | VENDOR-003 | standard (+ sensitive) | Native document-review `/correct` action |
| `evidence.vendor_readings.decide` | Accept cited findings and CUECs or dismiss the proposal | VENDOR-003 | standard or commitment (+ sensitive) | Native document-review `/decision` action |
| `evidence.policies.list` | Read templates, exact revisions and assignment state | POLICY-001 | standard (+ sensitive) | `GET /api/policies`; native policy builder |
| `evidence.policies.draft` | Append a policy revision from a template or edited text | POLICY-001 | standard (+ sensitive) | `POST /api/policies`; native policy `/templates/{template}` action |
| `evidence.policy_decisions.record` | Record an exact policy sign-off or request changes | POLICY-001 | standard or commitment | Native policy revision `/decision` action |
| `evidence.policies.publish` | Publish the selected current policy revision internally | POLICY-001 | commitment | Native policy revision `/publish` action |
| `evidence.policy_assignments.create` | Assign a published version without inventing assent | POLICY-001 | standard | `POST /api/attestations/assign` |
| `evidence.training.list` | Read curricula, campaigns, attempts and completion provenance | TRAIN-001 | standard | `GET /api/training`; `/api/training/export` |
| `evidence.training_campaigns.create` | Assign a role/program-specific training campaign | TRAIN-001 | standard | `POST /api/training/campaigns` |
| `evidence.training_campaigns.schedule` | Revise campaign dates without rewriting attempts | TRAIN-001 | standard | Native training campaign `/schedule` action |
| `evidence.training_courses.adopt` | Adopt a shipped course revision prospectively | TRAIN-001 | commitment | Native training course `/adopt` action |
| `evidence.training_completions.record` | Record an externally supplied or internal completion with honest provenance | TRAIN-001 | commitment | Native training internal `/completions` action; KnowBe4 collection via connections |
| `evidence.people.list` | Read the sponsor-visible workforce roster | LIFECYCLE-001, LIFECYCLE-002, API-001 | standard (+ sensitive) | `GET /api/people`; checklist state none |
| `evidence.people.create` | Add a roster person without creating sign-in authority | INVENTORY-001, LIFECYCLE-001 | standard | `POST /api/people` |
| `evidence.people.invite` | Issue a scoped staff invitation | AUTH-001, LIFECYCLE-001 | access (+ external) | Native `/api/roles/invitations` and person `/invite` actions |
| `evidence.people.depart` | Record departure and end membership with retained attribution | LIFECYCLE-002, AUTH-001 | access | `POST /api/people/{id}/depart` |
| `evidence.checklists.get` | Read joiner, mover and leaver verification work | LIFECYCLE-001 | standard (+ sensitive) | none |
| `evidence.checklists.verify` | Read back required accounts, devices and background-check completion | LIFECYCLE-001 | external (+ sensitive) | none |
| `evidence.handover.list` | Read every responsibility flagged after departure | LIFECYCLE-002 | standard | `GET /api/handover` |
| `evidence.handover.reassign` | Reassign responsibilities with reasons and effective scope computed | LIFECYCLE-002 | standard (+ access) | `POST /api/handover/reassign`; person `/handover` action |
| `evidence.roles.list` | Read current scoped roles and authority | AUTH-001 | standard | `GET /api/roles` |
| `evidence.roles.grant` | Grant a named role or record-area authority | AUTH-001, ERASE-001 | access | `POST /api/roles/grants` |
| `evidence.roles.revoke` | End an exact role grant | AUTH-001 | access | Native role grant `/revoke` action |
| `evidence.sessions.end` | End selected staff sessions | AUTH-001 | access | `POST /api/roles/sessions/end` |
| `evidence.tokens.issue` | Issue a scoped API, agent or SCIM credential | API-001, AGENT-001, AUTH-001 | access · security | Native `/api/api-tokens`, `/api/agent/tokens` and `/api/roles/scim-tokens` actions |
| `evidence.tokens.revoke` | End an API, agent or SCIM credential | API-001, AGENT-001, AUTH-001 | access · security | Native token `/revoke` actions |
| `evidence.mfa.configure` | Change the provider second-factor requirement | AUTH-001 | access · security | `POST /api/roles/mfa` |
| `evidence.access_campaigns.list` | Read frozen account populations and unresolved readback | ACCESS-001 | standard (+ sensitive) | `GET /api/access-reviews` |
| `evidence.access_campaigns.create` | Freeze a scoped campaign with its cadence and due date | ACCESS-001 | standard | `POST /api/access-reviews` |
| `evidence.access_decisions.record` | Record retain, revoke or change intent without pretending execution | ACCESS-001 | commitment | Native signed-in member access-decision action in `src/evidence/me/http.ts` |
| `evidence.access_items.delegate` | Assign a campaign decision to an eligible colleague | ACCESS-001 | standard | Native access-review item `/delegate` action |
| `evidence.access_items.exclude` | Record a reasoned population exclusion with retained history | ACCESS-001 | commitment | Native access-review item `/exclude` action |
| `evidence.access_items.attach` | Attach immutable manual revocation evidence | ACCESS-001 | standard (+ sensitive) | Native access-review item `/revocation-exhibit` action |
| `evidence.engagements.list` | Read period engagements and request state | AUDIT-001, AUDIT-003 | standard (+ sensitive) | `GET /api/audit-engagements` |
| `evidence.engagements.create` | Create a period-bound engagement and fixed detail projection | AUDIT-001, AUDIT-003 | standard | `POST /api/audit-engagements` |
| `evidence.auditors.grant` | Authorize an engagement-scoped auditor identity | AUDIT-001 | access (+ external) | Native engagement `/auditors` action |
| `evidence.auditors.revoke` | End an engagement auditor grant | AUDIT-001 | access | Native engagement auditor `/revoke` action |
| `evidence.audit_requests.create` | Create an information request and accountable assignment | AUDIT-001 | standard | Native engagement `/requests` action |
| `evidence.audit_requests.comment` | Append a request discussion in its engagement projection | AUDIT-001 | standard or external (+ sensitive) | Native engagement request `/comments` action |
| `evidence.audit_requests.submit` | Submit an exact period exhibit to a request | AUDIT-001 | standard or external (+ sensitive) | Native engagement request `/submissions` action |
| `evidence.audit_decisions.record` | Record an attributable exact-submission auditor decision | AUDIT-001 | commitment | Native auditor engagement request-decision action |
| `evidence.audit_shares.publish` | Expose selected continuous evidence at the fixed detail level | AUDIT-003 | standard or external (+ sensitive) | Native engagement `/shares` action |
| `evidence.audit_shares.withdraw` | Remove an exact evidence share prospectively | AUDIT-003 | standard | Native engagement share `/unshare` action |
| `evidence.audit_evidence.get` | Read or preview the exact auditor projection | AUDIT-003 | standard (+ sensitive) | Native engagement `/evidence` action; `/app/audit-engagements/{id}/preview` |
| `evidence.audit_evidence.decide` | Record a versioned continuous-evidence auditor disposition | AUDIT-003 | commitment | Native auditor evidence-decision action |
| `evidence.audit_packs.export` | Export period scope, provenance, decisions and retained gaps | AUDIT-001, AUDIT-003, BOUNDARY-001 | standard (+ sensitive) | `GET /api/audit-engagements/{id}/pack` |
| `evidence.audit_populations.generate` | Generate a source-reconciled Type II population with gaps | AUDIT-002 | standard (+ sensitive) | none |
| `evidence.audit_samples.select` | Record selected or seeded-random samples and open linked requests | AUDIT-002 | standard | none |
| `evidence.nonoccurrences.record` | Record a complete empty population without claiming a pass | AUDIT-002 | commitment | none |
| `evidence.folders.prepare` | Retain an exact selected-control and period folder proposal | AGENT-001 | standard | `POST /api/agent/prepare-folder` |
| `evidence.folders.issue` | Issue a scoped expiring evidence-folder projection | REVIEW-001, AGENT-001 | standard or external (+ sensitive) | `POST /api/folders`; native exact-proposal decision action |
| `evidence.folders.close` | Close a folder link terminally while retaining its contents | REVIEW-001 | standard | Native folder `/close` action |
| `evidence.questionnaires.list` | Read question placement, citations, flags and source freshness | ANSWER-001, ANSWER-003 | standard (+ sensitive) | `GET /api/questionnaires`; collaboration none |
| `evidence.questionnaires.create` | Capture a native questionnaire and its original template | ANSWER-001, ANSWER-003 | standard (+ sensitive) | `POST /api/questionnaires`; PDF/OCR capture none |
| `evidence.questionnaire_drafts.prepare` | Draft supported exact-source answers and explicit gaps | ANSWER-001 | standard (+ sensitive) | Native questionnaire `/drafts` action; current extractive formats only |
| `evidence.questionnaire_drafts.edit` | Append an edited cited answer revision | ANSWER-001, ANSWER-003 | standard (+ sensitive) | Native questionnaire draft `/edit` action; delegated collaboration none |
| `evidence.questionnaire_decisions.record` | Sign off an exact answer set and recipient | ANSWER-001, AGENT-005 | commitment (+ sensitive) | Native questionnaire draft `/approve` action |
| `evidence.questionnaires.export` | Export the exact current answer revision in the buyer template | ANSWER-001 | standard (+ sensitive) | Native questionnaire draft `/export` and `/citations` actions |
| `evidence.questionnaire_assignments.create` | Assign questions or sections with due dates | ANSWER-003 | standard | none |
| `evidence.customer_promises.link` | Record exact assurance-to-source dependencies | AGENT-005 | standard | Native questionnaire draft and trust update `/dependencies` actions |
| `evidence.customer_promises.refresh` | Prepare a successor using current cited sources | AGENT-005 | standard (+ sensitive) | Native questionnaire draft and trust update `/refresh-source` actions |
| `evidence.trust_updates.draft` | Draft a dated category or subprocessor change notice | TRUST-003, TRUST-005 | standard | `POST /api/trust/updates`; `/api/trust/subprocessors` |
| `evidence.trust_decisions.record` | Sign off an exact statement or notice revision and recipients | TRUST-001, TRUST-003, TRUST-005, AGENT-005 | commitment | Native trust update `/approve` action; full document center none |
| `evidence.trust_updates.publish` | Publish the selected revision to its current audience | TRUST-001, TRUST-003, TRUST-005 | standard or external (+ sensitive) | Native trust update `/publish` action; custom domain center none |
| `evidence.trust_notifications.send` | Dispatch a notice to current eligible category recipients | TRUST-003, TRUST-005 | external (+ sensitive) | `POST /api/trust/deliveries/dispatch` |
| `evidence.subscribers.add` | Record an owner-added subscriber and its consent source | TRUST-003 | standard | `POST /api/trust/subscribers` |
| `evidence.customer_grants.issue` | Authorize exact named-record customer rights | TRUST-001, TRUST-002, TRUST-003 | access (+ external) | `POST /api/trust/customers`; CRM-derived document access none |
| `evidence.customer_grants.revoke` | End a customer grant without recalling downloads | TRUST-001, TRUST-003 | access | Native trust customer `/revoke` action |
| `evidence.crm_rules.revise` | Set source-field-to-document access rules | TRUST-002 | access | none |
| `evidence.trust_questions.answer` | Answer from the visitor projection with resolving citations | TRUST-004 | external (+ sensitive) | none |
| `evidence.period_findings.prepare` | Correlate period sources, failures, contradictions and unknown windows | AGENT-002 | standard (+ sensitive) | `POST /api/controls/{id}/investigate` |
| `evidence.period_findings.get` | Read a fingerprinted investigation and its original sources | AGENT-002 | standard (+ sensitive) | Native control `/investigations/{id}` and `/investigation-source` actions |
| `evidence.period_findings.decide` | Record a findings disposition without altering control results | AGENT-002 | standard | Native control investigation `/decision` action |
| `evidence.tailoring.prepare` | Prepare cited policy, mapping, risk and obligation deltas locally | AGENT-006, CONTROL-001 | standard (+ sensitive) | `POST /api/tailoring` |
| `evidence.tailoring.interpret` | Send minimum declared passages for provider interpretation | AGENT-006, SECURE-001 | external (+ sensitive) | `POST /api/tailoring/interpret` |
| `evidence.tailoring.decide` | Apply an exact interpretation or dismiss it without downstream effects | AGENT-006, CONTROL-001 | standard or commitment (+ sensitive) | Native tailoring proposal `/decision` action |
| `evidence.source_repairs.propose` | Prepare a minimal source change, diff and rollback | AGENT-003 | standard (+ sensitive) | none |
| `evidence.source_repairs.execute` | Apply the exact protective source change through its constrained writer | AGENT-003 | external · security (+ access) (+ live) | none |
| `evidence.source_repairs.rollback` | Apply the recorded protective rollback at its expected source revision | AGENT-003 | external · security (+ access) (+ live) | none |
| `evidence.collector_patches.prepare` | Diagnose scope/schema loss and prepare a sandbox patch | AGENT-004 | standard (+ sensitive) | none |
| `evidence.collector_patches.activate` | Activate an exact collector revision and its declared source scope | AGENT-004 | security · live (+ access) (+ external) | none |
| `evidence.exhibit_findings.prepare` | Cite requirement and exhibit pages for a proposed evidence-quality finding | AGENT-007 | standard (+ sensitive) | none |
| `evidence.exhibit_findings.decide` | Accept or dismiss a quality finding without changing proof facts | AGENT-007 | standard | none |
| `evidence.ai_inventory.list` | Read discovered AI providers, SDKs, use cases and source facts | AI-001 | standard (+ sensitive) | Package/SDK resources in Inventory only; complete governance register none |
| `evidence.ai_usecases.decide` | Record a bounded AI-use sign-off or dismiss a proposed use | AI-001 | standard or commitment | none |
| `evidence.flows.declare` | Record a provider purpose, account and exact outbound data classes | SECURE-001 | security | `POST /api/connections/flows` |
| `evidence.flows.enable` | Enable a fingerprinted outbound declaration without creating an account | SECURE-001 | security | Native flow `/enable` action |
| `evidence.flows.disable` | Disable an outbound declaration | SECURE-001 | security | Native flow `/disable` action |
| `evidence.flow_keys.rotate` | Replace the credential for a declared flow | SECURE-001 | access · security | Native flow `/key` action |
| `evidence.custody_keys.rotate` | Re-seal credentials under the named current custody key | SECURE-001 | security | `POST /api/connections/custody/rotate` |
| `evidence.record_grants.issue` | Grant need-to-know access to an exact protected record | SECURE-001 | access | Native receipt `/grants` action |
| `evidence.record_grants.revoke` | End a protected-record need-to-know grant | SECURE-001 | access | Native receipt grant `/revoke` action |
| `evidence.record_publications.set` | Change protected-record publication to an exact audience | SECURE-001 | security (+ external) (+ sensitive) | Native receipt `/publication` and `/publication/revoke` actions |
| `evidence.privacy.classify` | Append entity membership with native scope checks | ERASE-001 | standard (+ access) | `POST /api/privacy/classifications` |
| `evidence.erasure.prepare` | Preview stores, exact originals, holds and unfinished scope | ERASE-001 | standard (+ sensitive) | `POST /api/privacy/requests` |
| `evidence.erasure.execute` | Erase the exact eligible set and retain partial or pending outcomes | ERASE-001 | destructive (+ access) (+ external) (+ sensitive) | Native privacy request `/confirm` action; current classified-exhibit subset only |
| `evidence.holds.create` | Record a preservation instruction with authorizer, reason and date | ERASE-001 | commitment | `POST /api/privacy/holds` |
| `evidence.holds.release` | Release an exact hold with attributable reason | ERASE-001 | commitment | Native privacy hold `/release` action |
| `evidence.audit_log.list` | Read permanent action history with retained failed and uncertain outcomes | LOG-001 | standard (+ sensitive) | `GET /api/audit` |
| `evidence.audit_log.export` | Export the authorized action audit | LOG-001 | standard (+ sensitive) | `GET /api/audit/export` |
| `evidence.events.list` | Read access-filtered typed changes after a replay cursor | LOG-001 | standard (+ sensitive) | none |
| `evidence.operations.get` | Read durable execution, storage health, queue and backup facts | OPS-001 | standard | `GET /api/operations` |
| `evidence.operations.cancel` | Cancel an owned running step and fence late effects | OPS-001 | standard | Native operation `/cancel` action |
| `evidence.archives.inventory` | Read complete transfer inventory, unavailable bytes and erasure journal | CUSTODY-001, PORTABLE-001 | standard (+ sensitive) | `GET /api/archive/manifest`; `/api/archive/journal` |
| `evidence.archives.export` | Stream an exact complete product archive without credentials or grants | CUSTODY-001, PORTABLE-001 | standard (+ sensitive) | `GET /api/archive/export` |

**Resources.** `evidence://programs/{id}`, `evidence://controls/{id}`, `evidence://requirements/{id}`, `evidence://receipts/{id}`, `evidence://exhibits/{id}`, `evidence://frameworks/{id}`, `evidence://documents/{id}`, `evidence://resources/{id}`, `evidence://connections/{id}`, `evidence://collection_runs/{id}`, `evidence://tests/{id}`, `evidence://observations/{id}`, `evidence://exceptions/{id}`, `evidence://remediation/{id}`, `evidence://tickets/{id}`, `evidence://deliveries/{id}`, `evidence://risks/{id}`, `evidence://vendors/{id}`, `evidence://vendor_documents/{id}`, `evidence://supplier_requests/{id}`, `evidence://policies/{id}`, `evidence://people/{id}`, `evidence://training_assignments/{id}`, `evidence://checklists/{id}`, `evidence://access_campaigns/{id}`, `evidence://engagements/{id}`, `evidence://audit_requests/{id}`, `evidence://audit_populations/{id}`, `evidence://folders/{id}`, `evidence://questionnaires/{id}`, `evidence://trust_updates/{id}`, `evidence://customer_grants/{id}`, `evidence://investigations/{id}`, `evidence://tailoring/{id}`, `evidence://source_repairs/{id}`, `evidence://collector_patches/{id}`, `evidence://exhibit_findings/{id}`, `evidence://ai_usecases/{id}`, `evidence://erasure/{id}`, `evidence://holds/{id}`, `evidence://audit_entries/{id}`, `evidence://operations/{id}`. Each uses the native record projection and revision; an original-byte link retains download rights. External, customer, import, model, source and log text is untrusted. **Events.** `collection.completed`, `collection.failed`, `source.hint_received`, `test.observed`, `remediation.opened`, `remediation.verified`, `ticket.changed`, `delivery.changed`, `person.departed`, `handover.required`, `access_campaign.changed`, `audit_request.changed`, `audit_evidence.decided`, `vendor.changed`, `policy.changed`, `questionnaire.invalidated`, `trust_update.changed`, `finding.prepared`, `erasure.changed`, `hold.overdue`, `operation.changed`. **Prompts.** `period_control_assurance` (COLLECTION-001, TEST-001, AGENT-002); `failed_control_to_fresh_proof` (REMEDY-001, REMEDY-002, WORK-001, AGENT-003); `supplier_diligence` (VENDOR-001, VENDOR-003); `current_customer_assurance` (ANSWER-001, TRUST-003, AGENT-005); `tailor_program_obligations` (CONTROL-001, POLICY-001, RISK-001, AGENT-006).

**Not tools, and why.**
- ATTEST-001: a person's interactive screen records their own policy assent; assignment and roster administration are separate jobs in the table.
- ANSWER-002: device-only capture and fill-back run in the installed browser extension against the person's active portal, including its native field checks and client-reported history.
- DEVICE-002: device-only signed monitor installation, local posture reads and reporting run on the enrolled computer.
- POPULATION-001: the import door admits and reconciles labeled roster, account and device files with original custody.
- IMPORT-001: the import door handles Drata dry run, mapping, admission and undo.
- MIGRATE-001: the import door handles the three incumbent formats, identity decisions, reconciliation and custody-preserving undo.
- MIGRATE-002: the import door records cutover and reconciles imported pre-cutover records with post-cutover provenance and gaps.
- MOBILE-001: a person's interactive screen supplies responsive, keyboard and assistive-technology workflows, including the device camera.
- PUBLIC-001: an operation or installation fact covers the static run site, Lobby and setup-state presentation.
- OPEN-001: an operation or installation fact covers MIT source availability and absence of author-imposed product licensing gates.
- OWN-001: an operation or installation fact covers local lifecycle, owned D1/R2, deployment and absence of an author-hosted dependency.

For mapped jobs, archive restores and file-based framework, risk, finding, licensed-workbook and answer-library admissions remain on the import door; the table supplies their native post-admission work and archive export. Private-source execution and browser screenshot capture stay on their device; connection administration and resulting evidence jobs are tools. Provider sign-in, password, 2FA, consent and hosted checkout stay on a person's interactive screen. Course study and a learner's own assessment stay on that screen; campaign and honest completion-record administration are tools. Independent certification, legal judgment and merchant/QSA attestation are outside specialist services; the handoff is a tool. Company policy editing and Pause are people's controls.

**Limits.** Original exhibit and supplier files retain the native 10 MiB bound. Hosted schedules retain 5–60 minute intervals in multiples of five; source-page and continuation bounds are returned by the selected connector, including its explicit incompleteness reasons. Period investigations retain 5,000 rows, 100,000 comparisons, 512 KiB snapshots and 8 MiB source projections. Vendor readable-document extraction retains 250 pages and 500,000 characters. V10 archives stream bounded pages and frames without a total-size ceiling. Native capacity failures name the limit and retain prior facts. Business limits and spend caps are the company's policy.

**Handoffs.** It listens for source hints, completed or failed collection, test observations, tracker readback, departures, supplier replies, auditor decisions and changed assurance sources. It emits the typed events above with native record URIs: tracker closure requests independent re-testing; a verified source result updates an obligation; source drift invalidates dependent customer material; departure opens ownership handover; accepted supplier text remains a supplier assertion. Operational monitor, scanner, HRIS, identity and tracker responsibilities stay with their named services.

#### SURFACE-001 — One registry for the compliance operations tools

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-002, BASE-AGENT-006, BASE-AGENT-013

**Requirement.** Evidence's registry contains exactly the tools, resource templates, event types and prompts above, with their clause mappings, native actions, possible classes and facts. Current partial actions and absent jobs are distinguished in the registry without changing this target. The delta connects the existing compliance actions to the inherited door.

**Acceptance.**
1. Discovery returns exactly the table's tool names, resource templates, typed events and five prompts in stable order, with each prompt's clause references.
2. Tool clause mappings and the stated non-tool reasons cover the cloned Core set with no unknown ids or overlapping exclusions.
3. Each tool's declared classes equal its table cell; actual receipts include the server-computed facts for that call.
4. A control revision, exhibit replacement, source collection, ticket creation and questionnaire export through the native action and MCP leave equal business state and equivalent audit event types on paired fixtures.
5. The Base harness passes on Evidence's seeded fixtures under both company policies A and B defined in SURFACE-013; the generated manifest and `/docs/agents` agree with this registry.

#### SURFACE-002 — Find the exact period and source records

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-003, BASE-AGENT-005, BASE-AGENT-006, BASE-AGENT-010

**Requirement.** The compliance operations lead reads native readiness, inventory, source versions, immutable observations, personnel work, supplier originals and customer material through the sponsor's actual projection. It can follow a denominator or citation to the original period and revision without creating a new observation.

**Acceptance.**
1. Desk, readiness, board, inventory, risk, personnel, audit-log and operations reads reconcile to native counts; ordinary local reads declare standard with their item count.
2. On the same protected-record fixture, masked metadata without protected content declares standard alone; original bytes, extracted health text or a full ID, bank, card or payroll field add sensitive with exact record count and kind. The same computation applies to local reads, exports, stored drafts and replayed event payloads.
3. A control contributor, compliance manager and engagement auditor each receive exactly the fields their native roles expose; a restricted or foreign id is indistinguishable from missing.
4. The event feed and subscription for the same cursor contain the same event ids and native URIs; losing access removes later disclosure without exposing the hidden record's text.
5. Source, customer, imported, model and log text retain untrusted markers even when embedded in a citation or event.

#### SURFACE-003 — Preserve exhibit custody while computing exposure

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-002, BASE-AGENT-003, BASE-AGENT-006, BASE-AGENT-012

**Requirement.** Exhibit uploads and replacements use Evidence's byte verification, origin vocabulary, period assertions and immutable supersession. Classification follows the actual native projection of the new content, including an already shared destination. A replacement changes neither original custody nor historical observations.

**Acceptance.**
1. An upload ignores caller-supplied actor, digest, origin and receipt time, reads stored bytes and returns an attributable receipt; a pushed document keeps its source-reported attribution.
2. On one requirement fixture, an upload to its internal projection declares standard; the same upload while a known outside vendor can see the period declares external, known, one recipient. Public visibility declares external, public; an unrelated outside recipient declares external, new.
3. Adding a protected health or ID field to that same upload adds sensitive; its redacted counterpart without protected content does not. External and sensitive remain present together when both apply.
4. Replacing an exhibit creates a new receipt while retaining the original bytes, digest, period and supersession chain; two racing replacements yield one successor and a conflict.
5. Changed, absent or unreadable original bytes return unavailable and leave their receipt; oversized uploads name the native limit and invent no success.
6. The same original cannot be hidden by a redacted replacement when both remain inside a live folder's selected control and period projection.

#### SURFACE-004 — Version program decisions without manufacturing readiness

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-002, BASE-AGENT-006, BASE-AGENT-008, BASE-AGENT-012

**Requirement.** Program, framework, library, document, custom-control and exception tools retain prospective revisions, exact source mappings and accountable decisions. Their outputs distinguish a definition, a sign-off and observed operation. An agent's recorded decision never claims a person's own signature or assessor attestation.

**Acceptance.**
1. Creating core and extended programs yields the native requirement mappings, applicability exclusions, external assessment dependencies and framework document set, including honest licensed-content gaps.
2. Revised scope, criteria, cadence, figures or accepted library revision changes future work; earlier runs retain their original definition, library and SLA revisions.
3. For each of exceptions, vendor decisions, vendor readings, vulnerability retests, policy decisions, tailoring and AI-use decisions, dismissing the same proposed revision without a sign-off declares standard; accepting its exact consequential revision declares commitment with counterparty and stated value or explicitly unstated value.
4. Library adoption, document sign-off, management decisions, policy publication, training revision adoption, externally recorded completion, residual-risk acceptance, access decisions, population exclusions, auditor dispositions, questionnaire sign-off, trust sign-off, non-occurrence and hold decisions each declare commitment, not observed operation.
5. Editing the proposal after a consequential decision invalidates reuse; retrying the exact same idempotency key returns the original result and does not duplicate a mapping or decision.
6. Readiness still separates missing proof, failed or unknown tests, open obligations and assessor findings; no decision makes an unknown period pass or asserts certification.

#### SURFACE-005 — Collect sources and maintain the running collector honestly

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-002, BASE-AGENT-006, BASE-AGENT-009, BASE-AGENT-012

**Requirement.** Collection tools use Evidence's source account bindings, documented fields, scheduled context, bounded continuations and source-read clocks. Collector maintenance retains its exact patch and native authority boundary. Source events remain hints, and source absence remains a gap.

**Acceptance.**
1. A hosted collection declares external with its destination account even without a message; a protected field adds sensitive, whereas the same fixture's masked projection does not.
2. Connection authorization, rotation, revocation, collector registration, event grants and callback credentials declare access and security with native direction and setting; changing selected repository authority declares access.
3. On the same authorization fixture, installing a local existing-account credential carries access and security; validating it against an outside provider additionally declares external with that provider as counterparty.
4. Activation of an exact collector revision declares security and live with its setting and running installation; an unchanged grant adds no access, while the same patch expanding source scopes adds access, widens.
5. On the same collector patch, local activation sends nothing outside and adds no external; registration of its selected outside source adds external with provider and destination count.
6. Throttling, denied pages, unsafe continuations, schema drift and missed schedules retain original failures and unknown windows; recovery issues a receipt only after an actual read and does not backdate it.
7. A hint replay admits one queue item, creates no evidence receipt and cannot revive a revoked or restored connection.

#### SURFACE-006 — Carry a failed control to independent fresh proof

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-002, BASE-AGENT-005, BASE-AGENT-006, BASE-AGENT-009, BASE-AGENT-012

**Requirement.** Remediation, tracker and source-repair tools retain the original failure, exact change, execution, rollback and independent source proof. Tracker writes keep native identity mapping and read-before-write conflict checks. Classes follow the actual destination and setting.

**Acceptance.**
1. Creating a ticket, updating fields or resolving a conflict on internal Vector declares standard; the same payload to an outside tracker declares external with destination/recipient facts. Protected content adds sensitive to creation, synchronization or resolution; masked content does not.
2. Tracker field lookup declares external; callback registration declares external, access and security with its setting and authority.
3. On one repair fixture, a protective change declares external and security; changing its role binding adds access with direction, whereas changing only its logging setting adds no access.
4. That patch in an isolated sandbox without users adds no live; the running user-facing service adds live with service identity. Rollback recomputes these facts from its target.
5. Under every policy, repair or rollback widening the sponsor's or agent's own authority is refused before provider writes.
6. Tracker closure triggers item-specific re-testing; still-failing work keeps its SLA clock, and fresh source proof closes only verified items.
7. A conflicting snapshot changes no field; lost provider results stay uncertain beside the attempted revision. Retries cannot duplicate a ticket or invent verification.

#### SURFACE-007 — Administer people and authority within the native role

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-002, BASE-AGENT-005, BASE-AGENT-006, BASE-AGENT-008

**Requirement.** Administration uses native identities and effective scope, including assignment-derived rights. Departure preserves actors and creates handover work.

**Acceptance.**
1. On one assignment/handover fixture, choosing an unprivileged roster person declares standard; choosing an existing scoped role holder adds access with direction from changed effective reach. Departures, roles and sessions declare access.
2. On one invitation fixture, a colleague declares access alone; an outside identity adds external with counterparty and recipient count. Auditor and customer grants use the same computation.
3. API, agent, SCIM and provider credentials and MFA changes declare access and security; flow declarations, enablement/disablement and custody re-sealing declare security with named settings.
4. Connections, collectors, trackers/callbacks, channels, tokens, flow keys, MFA, roles, sessions, people and assignment/handover refuse sponsor/agent own-authority expansion under every policy, including indirect role effects and credential replacement.
5. Auditors, customer grants, CRM rules, record grants, record publications and collector activation refuse the same expansion under every policy before effects.
6. On one publication fixture, changing protected-record publication declares security; an outside audience adds external and protected contents add sensitive. Withdrawing to an internal masked projection adds neither.
7. Training preserves personal attempts; external completion records declare commitment with their source, without claiming agent study or employee assent.
8. Departed responsibilities remain unowned until reassigned with reasons and notices; historical attribution survives, and revocation affects the next disclosure.

#### SURFACE-008 — Keep supplier diligence and risk judgments attributable

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-002, BASE-AGENT-003, BASE-AGENT-006, BASE-AGENT-008

**Requirement.** Supplier and risk work retains source documents, method revisions, explicit identity matches, cited findings, CUECs, conditions and expiry. Source assertions, local extraction and business judgments remain different records.

**Acceptance.**
1. A supplier request declares external with the named vendor and one recipient even when its link has not been emailed; closing the link declares standard and cannot recall an existing download.
2. Readable document extraction cites the exact page and bytes for opinion, exception, period and each CUEC; missing or ambiguous fields stay unresolved, and correcting a field preserves the original proposal.
3. In the same local proposal fixture, a report with ordinary assurance text declares standard; a passage carrying a full regulated ID adds sensitive with its kind and record count, through upload, reading, extraction and correction.
4. An accepted supplier judgment or residual-risk acceptance declares commitment with the exact revision and counterparty; no marketing statement or extraction alone becomes verified source evidence.
5. A changed risk scoring method preserves earlier scales and thresholds; an annual vendor cost is a fact without a money class. A marked-fixed penetration-test finding stays awaiting verification until an exact retest decision or fresh scanner read; that acceptance declares commitment.
6. An expiring condition, bridge-letter gap or unmapped CUEC remains open until its native resolution, and source-linked risk treatment never converts scanner silence into verified closure.

#### SURFACE-009 — Disclose exact assurance material to the actual audience

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-002, BASE-AGENT-003, BASE-AGENT-006, BASE-AGENT-008, BASE-AGENT-012

**Requirement.** Folder, engagement, trust and notification tools preserve selected revisions, period bounds, rights and consent. A customer promise stays distinct from its supporting evidence and a disclosure from its recipient's action.

**Acceptance.**
1. On one fixture, folder issuance, engagement comments/submissions, continuous-evidence sharing or trust publication to a colleague declares standard; a known customer makes the same call external, known, one recipient; an unrelated outside identity external, new; and an open audience external, public.
2. On that same fixture, unmasked health or bank content adds sensitive; the equivalent masked projection does not. The computation also applies to outgoing messages and exports, not just displayed pages.
3. An internal-channel reminder to a colleague declares standard; an outside recipient or provider makes the same send external. A private link without protected content adds no sensitive; a protected attachment does.
4. Trust notification dispatch and visitor Q&A declare external with actual audience facts, and add sensitive only for protected content actually transmitted.
5. Closing a folder or withdrawing a share prevents the next read, including a concurrent disclosure; audit packs and auditor projections exclude out-of-period or unshared material without changing observations.
6. Category withdrawal, expired customer rights and missing consent exclude the recipient; queued mail invalidated by source drift remains suppressed beside any earlier delivered version.
7. Exact questionnaire/trust and auditor sign-offs declare commitment; attribution distinguishes the agent acting for its sponsor from a person's own decision after that person acted.

#### SURFACE-010 — Interpret and check without turning text into authority

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-002, BASE-AGENT-003, BASE-AGENT-006, BASE-AGENT-008, BASE-AGENT-009

**Requirement.** Period investigation, tailoring, questionnaire drafting, evidence-quality checks and AI governance preserve resolving citations, stated assumptions and uncertain coverage. They use Evidence's existing declared outbound-flow and minimum-necessary-content boundaries when invoking an outside provider.

**Acceptance.**
1. A local period investigation or tailoring draft declares standard, adding sensitive for protected content actually processed; the paired fixture with masked passages does not add sensitive.
2. Provider interpretation declares external with the declared provider/account, and adds sensitive for a permitted protected passage; replacing it with masked content removes sensitive. Undeclared data classes, credentials in the payload and missing custody fail before transmission.
3. An investigated latest pass retains an earlier violation, contradictions, unobserved assets and missing period windows; dismissing its finding changes no observation, mapping or assessor decision.
4. The same tailoring revision dismissed without effects declares standard; accepting its exact mapping, risk and obligation changes declares commitment. A subsequent policy draft remains a draft and source drift requires a fresh revision.
5. Questionnaire flags and citation counts reconcile to question totals; unsupported content stays flagged, and a stale source or parent answer cannot be exported for reuse.
6. An exhibit-quality finding names the requirement wording and original page; accepting it changes neither bytes, origin nor requirement satisfaction.
7. AI discovery retains OAuth/organization/SDK/spend source references; a bounded use-case sign-off declares commitment, and discovered package presence alone creates no authority or provider safety claim.

#### SURFACE-011 — Erase the exact eligible set and preserve holds

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-002, BASE-AGENT-005, BASE-AGENT-006, BASE-AGENT-009, BASE-AGENT-012

**Requirement.** Erasure uses exact previews, classification, retention instructions, deletion journals and restore fences, distinguishing preparation from deletion and disclosing partial stores.

**Acceptance.**
1. Preparing a preview declares standard and deletes nothing; executing it declares destructive with item/store counts.
2. On one erasure fixture, an ordinary unshared exhibit adds no sensitive, access or external; its protected variant adds sensitive, removing standing identity grants adds access, narrows, and deleting a controlled provider copy adds external with provider facts. Local-only erasure sends nothing outside.
3. On one classification fixture, unchanged effective privacy reach declares standard alone; bringing an exhibit into another holder's scoped reach adds access, widens. Erasure or classification widening the sponsor's or agent's own authority is refused under every policy before effects.
4. A held original remains available with authorizer, reason and date; overdue holds remain active, and accepted hold/release decisions declare commitment.
5. Changed membership or retention conflicts without newly unauthorized deletion; retrying the same confirmed request continues pending storage work without duplicating receipts.
6. Unsupported entity stores and provider deletion uncertainty remain partial or pending; exhibit-only erasure never reports whole-entity completion.
7. A later erasure journal fences older custody restoration; a fresh installation lacking that history retains its unverified-history disclosure.

#### SURFACE-012 — Keep custody and operational outcomes complete

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-002, BASE-AGENT-003, BASE-AGENT-006, BASE-AGENT-009, BASE-AGENT-010, BASE-AGENT-012

**Requirement.** Archive inventory/export, action history and operational tools retain Evidence's original provenance, unavailable bytes, source failures, exact reasons and incomplete effects. They expose the native capacity bounds and record changes needed by other specialists without turning reported status into independent proof.

**Acceptance.**
1. Inventory and export account for every current domain table and original, preserve missing-byte reasons and reject an unknown namespace; transfer carries no active receiving identity, credential or execution grant.
2. The same archive fixture without protected content declares standard; adding a protected ID or health record adds sensitive with reconciled count and kind. The resulting archive retains source-observed, source-reported, manual and imported provenance separately.
3. Action-log reads, exports and event replay keep agent/sponsor, subject revision, reason, class facts and outcome beside the native immutable business event; failure and later resolution remain separate entries.
4. A request to cancel a running owned step declares standard, fences later native writes and leaves an already submitted outside effect unknown until observed.
5. Source loss, storage failure, restart and inactive restore never replay a message, mutation or grant, and an external backup copy remains unverified until separately checked.
6. A capacity excess returns its named native bound instead of truncating evidence or claiming completeness; costs displayed in USD are estimates or provider disclosures without a money-moving action.

#### SURFACE-013 — A stranger runs a seeded compliance week under two company policies

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-007, BASE-AGENT-009, BASE-AGENT-013

**Requirement.** A stranger agent knows only the installation URL and sponsor connection. It discovers the prompts and runs a seeded compliance week through MCP. Company policy A makes every fleet class autonomous. Company policy B, the held policy, makes standard review and every other class approval. Evidence presets neither.

**Acceptance.**
1. Discovery explains the jobs, capacity limits and record links without installation-specific agent instructions.
2. Under policy A the week completes with no person: collect, investigate a period failure, fix a running service, independently re-test, hand over ownership, assign training, decide vendor/risk work, refresh customer answers, share evidence and erase an eligible exhibit.
3. Policy A's fixtures exercise all eight declared classes, including protected content, an outside customer, protective service change and scoped colleague grant; every audit decision matches that policy revision.
4. Under policy B standard calls complete into the review feed; other classes wait for approval without business effects, then run once after the fixture person approves the exact revision.
5. In the held run, rejecting one outside disclosure sends nothing; changed sources invalidate its pending decision and re-preparation produces a current revision.
6. Retries under either policy return existing receipts; original failures, citations, gaps, former owners and external versions survive.
7. Both policies refuse own-authority expansion and post-revocation reads; agent acts never impersonate personal signature or assent.
8. Generated `/docs/agents` describes both runs and class computations; receipts reconcile to native end-state counts without policy mismatches.

## Status rows

| Clause | Title | Kind | Status | Evidence | Gap |
| --- | --- | --- | --- | --- | --- |
| `SURFACE-001` | One registry for the compliance operations tools | target | missing | | No Evidence MCP registry or Base conformance result implements this table. |
| `SURFACE-002` | Find the exact period and source records | target | missing | | The complete role-exact resource and replay projections are not exposed through MCP. |
| `SURFACE-003` | Preserve exhibit custody while computing exposure | target | missing | | The exhibit actions do not yet compute these MCP exposure and protected-content facts. |
| `SURFACE-004` | Version program decisions without manufacturing readiness | target | missing | | Program decisions are not connected to the policy-neutral MCP registry. |
| `SURFACE-005` | Collect sources and maintain the running collector honestly | target | missing | | Collector administration and maintenance do not yet implement this classified MCP surface. |
| `SURFACE-006` | Carry a failed control to independent fresh proof | target | missing | | The constrained repair writer and unified classified tracker tools are not built. |
| `SURFACE-007` | Administer people and authority within the native role | target | missing | | The complete authority and workforce administration surface is not available through MCP. |
| `SURFACE-008` | Keep supplier diligence and risk judgments attributable | target | missing | | Supplier and risk actions are not wired to the classified MCP specialist. |
| `SURFACE-009` | Disclose exact assurance material to the actual audience | target | missing | | Assurance disclosure and notification tools do not yet implement this MCP classification. |
| `SURFACE-010` | Interpret and check without turning text into authority | target | missing | | The complete cited investigation and interpretation tool families are not exposed through MCP. |
| `SURFACE-011` | Erase the exact eligible set and preserve holds | target | missing | | Erasure does not yet implement the full classified MCP workflow and entity stores. |
| `SURFACE-012` | Keep custody and operational outcomes complete | target | missing | | Custody and operational actions are not connected to the complete MCP surface. |
| `SURFACE-013` | A stranger runs a seeded compliance week under two company policies | target | missing | | The stranger-agent seeded week has not been implemented or demonstrated under either company policy. |
