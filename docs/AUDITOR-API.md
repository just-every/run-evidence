# Native auditor engagement API

The owner uses an authenticated native session and same-origin JSON requests to explicitly authorize each engagement. An auditor signs in using the invitation email link, then uses their own native session at the auditor API. A dedicated auditor identity has no owner or employee product access. Native auditor authorization does not configure Google, Entra or Okta sign-in; those providers remain in AUTH-001.

All mutations require an Origin header matching the installation. Responses are private and are never cached. Auditor grants expire at their exact UTC instant, may be revoked independently for each engagement, and are checked again before a response is returned. Only an owner can import requests, submit exhibits, grant access or close work. Auditors can read authorized period evidence and append comments and decisions; they cannot change evidence, controls or test results.

Use the installation origin before every route below. Replace brace parameters with the returned record identifier.

| Method | Owner route | JSON input or result |
| --- | --- | --- |
| POST | `/api/audit-engagements` | `name`, inclusive UTC `period_from` and `period_to` dates, and `control_ids` array. Returns the engagement. |
| GET | `/api/audit-engagements` | Lists engagements. |
| POST | `/api/audit-engagements/{engagement}/auditors` | `email`, `name`, `reason` and future UTC `expires_at`. Returns a grant identifier. A new dedicated identity receives a native invitation; an already active auditor reuses their sign-in. |
| POST | `/api/audit-engagements/{engagement}/auditors/{grant}/revoke` | `reason`. Revokes that grant; original submissions and decisions remain available to the owner. |
| POST | `/api/audit-engagements/{engagement}/requests` | `requests`: a JSON-encoded array, with 1 to 100 objects. Each has `title`, in-scope `control_id`, current `owner_person_id` from People, and UTC `due_date`. Validation admits the whole list or none. A one-row list creates one request. |
| POST | `/api/audit-engagements/{engagement}/requests/{request}/submissions` | `receipt_id`: an immutable receipt already uploaded to that request's control. Its entire covered interval must fit inside the engagement period. Every resubmission creates a new numbered revision. |
| POST | `/api/audit-engagements/{engagement}/requests/{request}/comments` | `body`. Retains an attributable owner reply. |
| POST | `/api/audit-engagements/{engagement}/requests/{request}/close` | `reason`. Requires the latest submission to have a latest auditor decision of accepted. |
| POST | `/api/audit-engagements/{engagement}/close` | `reason`. Requires at least one request and every request closed. Ends auditor access. |
| GET | `/api/audit-engagements/{engagement}` | Current request states, assignments, due dates, retained submissions, decisions, comments and period observations. |
| GET | `/api/audit-engagements/{engagement}/pack` | Audited JSON period-pack export, using the same evidence projection as the auditor API. |

| Method | Auditor route | JSON input or result |
| --- | --- | --- |
| GET | `/api/auditor/{engagement}` | Authorized engagement and request evidence. |
| GET | `/api/auditor/{engagement}/pack` | Same period-pack projection. |
| POST | `/api/auditor/{engagement}/requests/{request}/comments` | `body`. Appends an attributable comment to an open request. |
| POST | `/api/auditor/{engagement}/requests/{request}/decisions` | Exact latest `submission_id`, `state` of `accepted`, `rejected` or `needs-more`, and `reason`. A stale submission is refused. |
| GET | `/api/auditor/{engagement}/requests/{request}/receipts/{receipt}` | Download a submitted original as a sandboxed attachment. Unsubmitted and out-of-period receipts are refused. |
| GET | `/api/auditor/{engagement}/requests/{request}/observations/{observation}` | The selected control's in-period observation with source provenance. Other observations are refused. |

Period observations retain their result, observation time and original source reference. Connected sources identify the connector and account; a source-reported observation without a provider connection does not fabricate either value. Receipts include source, server receipt time, covered interval and SHA-256. The pack also lists approved exceptions intersecting the period. This request flow does not implement AUDIT-003's request-free sharing, Restricted detail level or stale-interval review. Independent request-free review decisions use the separate doors below.

Program readiness counts audit engagements and requests as records, with record links. Closing a request never creates a readiness pass. Open request assignments join the existing Handover page when their owner leaves, including the business-day window, single or bulk reassignment with a reason, and escalation. Assignments do not grant authentication.

Custody archives retain all engagement, request, receipt-reference, comment and decision records. Restored auditor grants are revoked, native sessions are not transferred, and sharing and mail remain behind the existing restore capability gates. The destination owner must explicitly authorize any new access.

Approved native authorization policy (ct, 23 October 2026 at 14:35Z): auditors use identities separate from People and existing non-auditor operators; only an owner grants access, with a recorded reason and expiry. The public-door journey also asserts refusal at non-audit product doors and at exact grant expiry; AUDIT-001 is complete for the native explicitly authorized API.


## Request-free selected revisions (AUDIT-003 foundation)

At creation an engagement accepts `detail_level` of Full (the default) or Restricted and a `hidden_attributes` array of attribute names. These settings are fixed for the engagement and retained by custody restore. Restricted request-free projection is not implemented: both sharing and importing request evidence into a Restricted engagement return 409. There is no fallback that discloses Full evidence. A different detail level requires a new engagement.

The following owner routes use the same native owner and origin checks as request administration:

| Method | Owner route | Input or result |
| --- | --- | --- |
| POST | `/api/audit-engagements/{engagement}/shares` | `kind` (control, test, policy or document), `subject_id` and required `reason`. Retains the selected definition or approved document revision. Tests must map to an in-scope control; controls must be in scope. Policies must be published and program documents approved. A record already actively shared returns 409. |
| POST | `/api/audit-engagements/{engagement}/shares/{share}/unshare` | Required `reason`. Ends access immediately and records the withdrawal, retaining its exact prior snapshot in owner custody. A later share is a new grant. |
| GET | `/api/audit-engagements/{engagement}/evidence` | Audited read-only preview of all active selected revisions. |
| GET | `/api/audit-engagements/{engagement}/evidence/{share}` | Same preview restricted to one active share. |

An authorized auditor reads the identical projection at `/api/auditor/{engagement}/evidence` or `/api/auditor/{engagement}/evidence/{share}`. Active grants and native sessions are rechecked after recording the view, and the selected shares are read again to fence a concurrent withdrawal. Unknown and withdrawn shares return 404. Auditor sessions cannot create or withdraw shares. The projection carries the detail level and an explicit coverage limitation.

This foundation exposes selected definitions and approved document revisions only. It does not yet expose period observations, historical populations, stale intervals, SLA histories, pseudonyms or complete period-history packs. The period pack now also includes selected revisions, fixed detail settings, independent decisions and replies under `shared_evidence`. The complete observation-history pack and auditor screens remain unbuilt. AUDIT-003 stays partial. Restored share records retain history but never reactivate restored auditor grants.

## Independent continuous-evidence decisions

An authorized auditor posts to `/api/auditor/{engagement}/evidence/{share}/decisions` with `state` of `accepted`, `flagged` or `not-applicable`, `reason`, and `expected_revision` (zero for a first decision). A flag requires a comment in `reason`; not-applicable requires a reason. Accepted permits an empty reason. The current revision must match; stale writes return 409. Each success appends a numbered immutable decision attributed to the actual native session. Active test, policy and approved document shares are eligible; a control share is not independently decidable. Grant expiry, revocation, session validity, engagement close-out and active sharing are checked inside the write. A withdrawn share cannot acquire another decision.

Only an owner posts to `/api/audit-engagements/{engagement}/evidence/{share}/replies` with the exact `decision_id` and required `body`. Replies append their own numbered history and retain the decision being answered. Both histories appear in the shared projection and the period pack, separate from request decisions, and survive restart and custody restore. Unsharing removes access to both histories from the auditor while retaining owner custody records. A restored grant remains revoked.

Program readiness and the board show the latest active flags, their auditor names and comments, with a link to the selected evidence and complete review history. Superseding a flag or withdrawing its share removes it from this current flag list. These flags count review records only: decisions never change test results, observations, criteria, mappings or readiness passes. Period observations, historical populations, SLA history and Restricted disclosure remain unimplemented; AUDIT-003 remains partial.
