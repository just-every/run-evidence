# Evidence rulings

Each ruling below shaped a clause in [CONTRACT.md](CONTRACT.md); the clause states the outcome and the ruling states why. RL-1 to RL-14 moved out of the contract when it was rewritten to the RER contract standard on 28 October 2026; RL-101 and above are ct's ruling pass of 28 October 2026, copied verbatim.

### RL-1 — Official-schema fakes and the live provider journey

Date: 19 October 2026 · Ruled by: ct · Governs: COLLECTION-001, CODE-001, WORK-001, MIGRATE-001

For COLLECTION-001, CODE-001, WORK-001 and MIGRATE-001, the ct ruling of 19 October 2026 permits DONE for built doors proven against official-schema fakes, with the unrun live journey retained as a named Gap and no provider-verification claim.

In the rewrite to the RER contract standard, the unrun live journeys of these clauses are Field proof register rows (R-3, R-4, R-6) rather than Gaps.

### RL-2 — Forwarded source events

Date: 22 October 2026 23:45Z · Ruled by: ct · Governs: COLLECTION-001; inherited by API-001, AUTH-001, SECURE-001, CODE-001, CLOUD-002, APPS-001, MONITOR-001, HRIS-001 and DEVICE-001

**Source-event default approved with riders (ct, 22 October 2026 23:45Z):** Forwarded events use `/v1/connections/{id}/events`, an expiring `resource-push` API token and a separate owner-only, per-connection grant with a recorded reason. New connections deny events. Store only the token digest, show the token once and never export it. Expiry or failed registration destroys token authority; restoration leaves it inactive (WORK-001). Native provider webhook provisioning is not claimed. The event is an unverified hint: only its fingerprint, authenticated token reference, received time and optional explicitly unverified reported time enter the durable queue; no payload becomes evidence and an event never issues an evidence receipt. Only an actual authorized source read produces source-observed evidence; API-001 pushed records remain source-reported. The next scheduler run performs a real authorized read even before the elapsed interval is due, honoring source backoff. Duplicate event ids for the same token and connection share one queue entry; replay and duplicate deliveries are idempotent. Restart reconciles an already committed collection before another read; pending events cannot revive restored token or connection authority. Removing a grant, revocation and expiry prevent pending dispatch. Owner pages show original event queue records and collection outcomes. API-001, AUTH-001, SECURE-001 and later source providers under CODE-001, CLOUD-002, APPS-001, MONITOR-001, HRIS-001 and DEVICE-001 inherit these event-authentication, no-payload-evidence, audit and restore obligations. The grant and its reason are audited. COLLECTION-001 remains PARTIAL for the remaining acceptance and named Gaps below.

### RL-3 — Bitbucket write-capable scope exception

Date: 22 October 2026 23:45Z · Ruled by: ct · Governs: CODE-001, CONNECT-001

**Bitbucket grant exception approved with riders (ct, 22 October 2026 23:45Z):** Bitbucket requires `repository:admin` (or `admin:repository:bitbucket`) even for a GET of branch restrictions. Its write-capable scope is a named exception to CONNECT-001's read-only default, permitted only for restriction reads; prefer a read-only scope as soon as Bitbucket offers one. The connection screen discloses the write-capable scope. Connections are denied until the owner explicitly acknowledges that write-capable provider scope and records a reason in the audit; rotation renews that consent. The credential is sealed, bound to its workspace, used only for GET requests to the fixed Bitbucket API origin, never followed across authenticated redirects, destroyed on revocation and inactive after restore. No provider write is implemented or claimed. AUTH-001, SECURE-001 and future Bitbucket capabilities inherit the separate consent, audit and no-replay obligations. Acceptance includes GET-only calls with any non-GET call refused, and an audited owner consent reason before credential use and again on rotation. These are mapped by the Bitbucket authority journey in the Status Evidence cell. CODE-001 remains PARTIAL until its remaining acceptance is proved.

### RL-4 — Original-manifest custody default (adopted pending ct; decided by RL-103)

Date: 23 October 2026 · Ruled by: the CODE-001 build round, pending ct; ct decided it in RL-103 on 28 October 2026 · Governs: CODE-001

**Original-manifest custody default adopted (23 October 2026; ct approval pending):** A separate owner-only, per-connection, credential-bound audited grant explicitly acknowledges retaining private originals and including them in owner-requested custody exports. Denied by default; rotation, revocation and restore cannot carry authority forward. The manual owner API reads the four named root paths at a once-resolved immutable commit in each of 1–20 selected repositories, with GET-only fixed-origin reads and no followed source URL. Each nonempty UTF-8 original (at most 128 KiB) retains exact bytes, SHA-256, size, repository, commit, path, source link, read time and its consent decision. Recognized credential markers, source-credential reflections, invalid encoding and mismatching source hashes refuse admission; the filter is not comprehensive secret detection. Every request rechecks authority and commit admission checks it atomically. Absent files and unreadable/unsafe/bounded reads remain explicit; no original creates a passing test or AI approval. Downloads are private owner-only inert attachments and byte-checked. Retained originals and ordered grants survive custody restore while source and write authority remain inactive. AUTH-001, SECURE-001 and ERASE-001 inherit delegated authority, encryption/retention, export and authorized erasure obligations. See `docs/CODE-MANIFESTS.md`. There is no dedicated screen, recursive traversal or scheduled original capture; other formats remain unproved. This privacy/custody default needs ct approval, so CODE-001 stays PARTIAL.

### RL-5 — SAQ A worksheet scope and required explanations

Date: 22 October 2026 · Ruled by: ct · Governs: PROGRAM-006 (formerly part of PROGRAM-003)

Also (ct 22 Oct 2026): the SAQ A worksheet lists only SAQ A's requirement ids and names its SAQ revision; a not-applicable or CCW response without its explanation blocks approval.

### RL-6 — Licensed questionnaire workbooks

Date: 22 October 2026 · Ruled by: ct · Governs: VENDOR-001

Also (ct 22 Oct 2026): import a CAIQ v4.0.x and a SIG Lite workbook with a licence confirmation (each refused without one, including under a name without 'SIG'), admit a SIG Core-sized workbook, send each, and receive a supplier's completed CAIQ as per-question answers keyed by CAIQ id.

Licensed questionnaires (ct 22 Oct 2026). Evidence ships the SIG Lite, SIG Core and CSA CAIQ v4 template types: question ids, domains, scoping and answer forms (SIG yes/no/not applicable with comment; CAIQ yes/no/not applicable, SSRM control ownership and implementation description). Their licensed text loads only by importing the owner's licensed workbook (SIG of a named year; CAIQ v4.0.x), which keeps every id, domain and scoping rule, records edition, licensee and confirming person, and refuses any SIG or CAIQ workbook without that confirmation whatever its name. A supplier may answer by uploading its completed workbook of the same edition; answers are kept per question id and stay unverified. The import maps the question worksheet's columns, preserves the original row values and explicit scoping rule/decision, and records its fingerprint. A scoped workbook comes from its licensed authoring tool; Evidence does not execute Excel macros. Up to 10,000 questions and 10 MiB are admitted. Out-of-scope ids remain in the request without requiring an answer. Until CSA or Shared Assessments licenses Evidence to ship their text, Evidence's own questionnaire is 'CCM v4 control questionnaire (Evidence wording)', never 'CAIQ'.

### RL-7 — Failure notices link to the private obligation page

Date: 21 October 2026 · Ruled by: ct · Governs: FOLLOWUP-002

Per ct (21 October 2026) the in-channel step is a private link, not a Slack interactive message or Teams bot.

### RL-8 — Erasure authority and holds

Date: 22 October 2026 · Ruled by: ct · Governs: ERASE-001

Authority (ct 22 Oct 2026). Today only the owner previews, confirms, authorizes holds and releases them. An exact preview fingerprint and typed ERASE are required, and each is audited. After AUTH-001, a scoped privacy/legal role does the same within its scope, and the owner may restrict it. A hold names its authorizer, reason and review date, never releases automatically, and is released only by an attributed person with a reason. An overdue review shows on the desk and notifies the authorizer. A hold on a person, vendor, engagement or business covers every record classified under it. Entity erasure erases every record not under a hold and keeps the held ones. The receipt lists each held item, why it is kept, who authorized the hold and its review date. Records that are not yet classified, and imported exhibits, refuse execution. The clause remains partial. Mirrored tracker comment text, including held text, belongs to this clause before that capability ships. Older archives are refused against the later lineage journal, as PORTABLE-001 specifies; an unverified fresh destination still requires the latest journal or its explicit unverified-history acknowledgement.

Also (ct 22 Oct 2026): a hold on an engagement blocks erasure of its exhibit. A person erasure with one held exhibit erases the rest and its receipt discloses the held one. A hold past its review date shows overdue and is still active. A non-owner without the scoped role is refused every privacy door.

### RL-9 — Native auditor identity and grant policy

Date: 23 October 2026 14:35Z · Ruled by: ct · Governs: AUDIT-001

ct approved the dedicated native identity and grant policy on 23 October 2026 at 14:35Z. Auditors are refused at non-audit product doors and at the exact engagement-grant expiry, as asserted by the named native journey.

### RL-10 — Customer-facing notifications are carried separately

Date: 25 October 2026 20:08Z · Ruled by: ct · Governs: TRUST-005, TRUST-003

The ct ruling of 25 October 2026 at 20:08Z carries this notification obligation separately. Customer-facing sends require enabled owner publication authorization; visitor confirmations also require the enabled confirmation authorization at consent activation. Both start disabled.

  ct ruling, 25 October 2026 at 20:08Z: owner-only grants require reason and expiry; links are issued once and only their hashes are stored; grants cover named records with explicit read and submit rights; every use is audited. The native journey now proves this complete scope, including admin refusal, required fields, read-only versus submit rights, another record and future-record denial, exact-record notification eligibility, attributable comments that never alter the statement, every recognized use audited, expiry and revocation, one-time link response with only the digest stored, restart and inactive-grant restore. Browser grant issuance, comment submission and read-only end states pass at both widths. TRUST-001 and TRUST-002 retain their inherited document, NDA, domain and CRM obligations. Public publication and visitor-confirmation mail start disabled; customer-facing publication and confirmation notifications are proved separately under TRUST-005. No CRM or inferred customer identity grants access.

### RL-11 — Delegated-role default (adopted pending ct; decided by RL-102)

Date: 26 October 2026 · Ruled by: the AUTH-001 build round, pending ct; ct decided it in RL-102 on 28 October 2026 · Governs: AUTH-001, LIFECYCLE-002, WORK-003

**Delegated-role default adopted (26 October 2026; ct approval pending):** The owner keeps native email-link sign-in and every door. Delegation is deny by default: a door that no role names stays owner-only. Administrator and compliance manager open program work (programs, controls, frameworks, tests, policies, vendors, risks, tailoring and review settings) and the proof desk; only the owner grants administrator, restricted record areas (personnel, findings, connector-data), SCIM tokens, the second-factor requirement and invitations. Control owner and contributor reach only the controls their grants or current control assignments name (business scope follows assignments; team and control grants add more); a contributor cannot download exhibits. A risk approver reads risks and accepts residual risk only. Policy decisions, residual-risk acceptances and tailoring decisions refuse the person who drafted, assessed or prepared them. Employees keep their own tasks and auditors their engagement door; agent, API and SCIM tokens never open an owner door, and every grant, revocation, session end and refusal is audited with its reason. Single sign-on uses Base's OpenID Connect providers, offered only when their Worker bindings exist; Okta and Entra ID name a person only through the subject map SCIM fills, and a SCIM-provisioned person signs in only through their provider while the owner's email link remains the audited break-glass door. SCIM deprovisioning ends the account, sessions, subject and roles in one transaction. A required second factor refuses any provider sign-in whose ID token does not prove one. Grants, SCIM state and SSO state are authority and never travel in an archive. See `docs/ACCESS.md`. LIFECYCLE-002 inherits the role model's manager relation and named policy approvers before they ship; WORK-001 tracker writes stay owner-only until a later clause names a scoped human role for them.

### RL-12 — Restricted-record and flow default (adopted pending ct; decided by RL-104)

Date: 26 October 2026 · Ruled by: the SECURE-001 build round, pending ct; ct decided it in RL-104 on 28 October 2026 · Governs: SECURE-001, AGENT-006

**Restricted-record and flow default adopted (26 October 2026; ct approval pending):** A receipt marked sensitive at upload or later is private to the owner and to named need-to-know holders (the uploader first); a delegated role without a grant sees neither the record nor its file, and each refusal is audited and listed as a suspected disclosure. A reviewer folder or auditor engagement never receives a sensitive record until the owner publishes it with a reason, and withdrawing the publication ends it on the next request. Personnel records, findings and connector data are restricted areas that a delegated role reaches only through an owner-issued area grant. Provider credentials and model keys are AES-256-GCM ciphertext under a named custody key (`session`, or any key in `CUSTODY_KEYS`), re-sealed under the current key by an owner action, and a credential whose key is absent fails every user explicitly and is never opened with another key; exhibit bytes rely on storage-provider encryption at rest and archives carry no credentials, grants, publications or declarations. A model provider is reachable only through a flow declared in Connections (provider, model, purpose, exact data classes, retention, region, account), reviewed by exact fingerprint before enablement; each call is refused before anything leaves when a data class is undeclared, the payload exceeds the minimum-necessary bound or it carries a credential, and is recorded by payload digest and size only. See `docs/KEY-CUSTODY.md`. AGENT-006 is the first purpose; later model clauses (AGENT-007, TRUST-004, ANSWER-001 drafting) inherit the declaration, refusal and custody obligations before they ship.

### RL-13 — Model interpretation for policy tailoring (adopted pending ct; decided by RL-101)

Date: 26 October 2026 · Ruled by: the AGENT-006 build round, pending ct; ct decided it in RL-101 on 28 October 2026 · Governs: AGENT-006

Interpretation (26 October 2026; ct approval pending): the owner or a delegated program role can ask a model to draft the policy addition, risk, obligation text, assumptions and conflicts from the selected passages and inventory, only through the enabled policy-tailoring flow declared under SECURE-001. The call sends the selected customer passage, framework passage, approved policy text, in-scope assets, candidate control and risk method, never a secret or an exhibit file. Every model citation must quote its source verbatim or the whole proposal is refused; a deadline exists only where the source states one; the ambiguity test of the source and the model's judgement both demand explicit acknowledgement; model output grants no authority and the proposal is decided by exact hash like a deterministic one.

### RL-14 — The complete Evidence target replaces the first-release exclusions

Date: 16 October 2026 · Ruled by: the owner · Governs: every clause; in particular PROGRAM-001, LIBRARY-001, POLICY-001, COLLECTION-001 and ANSWER-001

The owner-approved 16 October target replaces the earlier first-release exclusions of frameworks, policy templates, collectors and questionnaires.

### RL-101 — AGENT-006: Tailor policies, risks and structured obligations

Date: 2026-10-28 · Ruled by: ct · Governs: AGENT-006

Question: May policy/risk tailoring rely on the current role model and declared-model-flow boundary?

Adopted/proposed default: Cited preparation, exact-revision reviewer decisions, atomic downstream changes and no authority from model text.

Outcome: **adopt with rider**. Use AUTH-001’s scoped reviewer authorization and SECURE-001’s declared-flow custody by citation, preserve exact-source citations and uncertainty, and bind every downstream effect to its exact authorized revision; company policy determines agent review/approval classes.

Why: Vanta makes AI optional and bounds access by role/object assignment. No common norm is established by the reviewed sources for Evidence’s exact proposal hashes or separation-of-duties implementation; these conservative controls protect policy integrity without claiming that model text has legal or operational authority.

- [Source 1](https://help.vanta.com/en/articles/11345385-managing-user-roles): Vanta separates admin, editor, collaborator and employee rights; collaborators reach assigned objects and custom permissions can narrow access.
- [Source 2](https://help.vanta.com/en/articles/11345365-enabling-or-disabling-vanta-ai): Admins or Editors can disable optional AI processing; disabling stops processing by the feature’s third-party services.

Main evidence: `CONTRACT.md:689` at `c252c8f42873fc076c22ba9e50105e69eb8bf6e6`.

Placement: AGENT-006 cites AUTH-001 and SECURE-001 once and states only tailoring/source/atomic-effect deltas.

Engineering/proof retained: This decision does not certify interpretation as legal advice, provider deletion, implementation completeness or a legal sign-off.

### RL-102 — AUTH-001: Roles, SSO and scoped authorization

Date: 2026-10-28 · Ruled by: ct · Governs: AUTH-001

Question: May scoped delegated compliance roles operate while privileged unassigned doors remain denied?

Adopted/proposed default: Deny-by-default named role/area grants, assignment-scoped controls, separate reviewer, owner custody/admin grants and immediate deprovision.

Outcome: **adopt with rider**. Approve the named role and area-grant matrix, assignment-bound control access, separate preparer/decider, current authorization, SCIM deprovision and archive-inert grants; unlisted doors remain denied, while future scoped human roles may be added only explicitly and agent permissions remain within the represented person’s role and company policy.

Why: Vanta separates broad administration from assigned-object collaborators and employee-only tasks. No common norm is established by the reviewed sources for Evidence’s exact role names or owner-only grant issuer; these local boundaries are safe and lawful ordinary product decisions, not owner-reserved account operations.

- [Source 1](https://help.vanta.com/en/articles/11345385-managing-user-roles): Vanta separates admin, editor, collaborator and employee rights; collaborators reach assigned objects and custom permissions can narrow access.
- [Source 2](https://help.vanta.com/en/articles/11345590-user-permissions-by-product-area): Sensitive document access and policy contents require separate permissions; control ownership alone does not grant policy contents.

- [Source 3](https://help.drata.com/en/articles/13604055-manage-user-roles-in-drata): Drata admins assign roles; restricted views can limit control/risk managers to owned or assigned items.

Comparison: Vanta and Drata both separate administration from assignment-scoped work; their role names and broader default views differ, so the exact local matrix is chosen conservatively.

Main evidence: `CONTRACT.md:612` at `c252c8f42873fc076c22ba9e50105e69eb8bf6e6`.

Placement: AUTH-001 owns the role matrix once; receiving clauses cite it rather than restate authority.

Engineering/proof retained: Google/Entra live tenant sign-in and a live public Okta SCIM push remain unproved; existing tracker-write limits and provider-specific identity evidence remain.

### RL-103 — CODE-001: GitHub, GitLab, Bitbucket Cloud and Azure DevOps change assurance

Date: 2026-10-28 · Ruled by: ct · Governs: CODE-001

Question: May private repository originals be captured or exported only after explicit source and custody consent?

Adopted/proposed default: Deny private originals/export unless the owner explicitly enables the precise scope and custody.

Outcome: **adopt with rider**. Keep private-original capture and custody export denied until an authorized connection manager explicitly selects repositories, immutable paths/revisions, purpose and recipient custody; preserve read-only source access, private downloads, secret exclusion and disabled restored grants.

Why: Vanta’s GitHub integration defaults to read-only and selects repositories, but its documentation says it does not read source-file contents. Therefore the reviewed sources establish no common norm for compliance-tool raw-original capture/export: explicit narrow custody consent is the safest Evidence-specific extension.

- [Source 1](https://help.vanta.com/en/articles/14845240-github-integration-guide): GitHub integration defaults to read-only with repository selection; Vanta says it does not read repository code/file contents.

Main evidence: `CONTRACT.md:198` at `c252c8f42873fc076c22ba9e50105e69eb8bf6e6`.

Placement: CODE-001 owns private-original capture/export selection; cite CONNECT-001 and SECURE-001 for common secret/flow custody.

Engineering/proof retained: The separately approved Bitbucket write-capable read exception stays unchanged. Recursive formats, schedules, normalized findings and unknown historical approvals remain engineering gaps.

### RL-104 — SECURE-001: Restricted evidence and declared external flows

Date: 2026-10-28 · Ruled by: ct · Governs: SECURE-001

Question: May restricted records and exact declared external model flows use the adopted custody boundary?

Adopted/proposed default: Need-to-know record/area grants, reasoned explicit publication, sealed provider keys and exact declared flow before enablement.

Outcome: **adopt with rider**. Adopt private-by-default sensitive records, current need-to-know grants, explicit revocable publication and exact provider/model/purpose/data-class/retention/region/account declaration; refuse undeclared or secret-bearing payloads, audit without content, fail explicitly on missing custody keys and keep restored authority inactive.

Why: Vanta limits sensitive documents separately from broad editor access and lets authorized admins/editors disable AI processing. No common norm is established by the reviewed sources for Evidence’s exact key ring or declaration fingerprint; conservative explicit custody is chosen. Storage-provider encryption is accurately disclosed rather than relabeled application sealing.

- [Source 1](https://help.vanta.com/en/articles/11345479-managing-documents): Sensitive documents are limited to owners/admins; auditors receive temporary access during a scheduled audit.
- [Source 2](https://help.vanta.com/en/articles/11345365-enabling-or-disabling-vanta-ai): Admins or Editors can disable optional AI processing; disabling stops processing by the feature’s third-party services.

- [Source 3](https://help.drata.com/en/articles/15122885-read-only-and-restricted-view-roles): Drata distinguishes read-only broad access from restricted access to owned or assigned controls/risks.

Comparison: Vanta sensitive-document controls and Drata restricted-view roles support need-to-know boundaries but do not establish Evidence’s exact provider-flow/key-custody scheme.

Main evidence: `CONTRACT.md:622` at `c252c8f42873fc076c22ba9e50105e69eb8bf6e6`.

Placement: SECURE-001 owns restricted/flow custody once; AGENT-006 and later model purposes cite it.

Engineering/proof retained: A denied read is an access refusal, not proof that a disclosure actually occurred; suspected-disclosure records must say so. Actual provider retention/region and encryption/key-loss evidence remain separately required.
