# Remediation tracker connections

The owner connects a separate issue-write credential at **Ticket destinations**.
Source collection never borrows it. A project read must succeed before the
connection is saved. Credentials are encrypted, excluded from archives, and must
be reauthorized after restore. Provider subscription costs are shown in USD
before connection; Evidence charges USD 0.

Evidence owns the compliance obligation and verification. Tracker assignee and
status are read back from the tracker; closing a ticket queues a real source
re-test and cannot by itself verify a fix. Comments move both ways. A native due
field changed in the tracker becomes a visible conflict with the local value and
time; the owner chooses which value to retain. Native field refusals, authorization
loss and deleted tickets are visible on the obligation. Replayed signed events
and unchanged repeated reads do not produce duplicate state changes.

Each linked ticket is polled every ten minutes by the five-minute scheduler.
Polling remains active when a webhook is absent. The built-in poll processes at
most fifty distinct destination/remote-ticket pairs per scheduler invocation. Every
linked item of a whole-test ticket is included together, so one closure re-tests
the full linked population. Hosted capacity above this batch size has not been measured. Source-read failure never fabricates a pass.

| Tracker | Project field and API address | Field details and official API |
| --- | --- | --- |
| GitLab Issues | Project ID or path; default `https://gitlab.com/api/v4` | Native assignee, labels and due date; priority is a scoped label. [Issues](https://docs.gitlab.com/api/issues/), [notes](https://docs.gitlab.com/api/notes/). |
| Azure Boards | Project name; `https://dev.azure.com/organization` | Work-item type defaults to Task. Native priority and tags; map a writable DateTime due-date field (default `Microsoft.VSTS.Scheduling.DueDate`, or e.g. `Custom.RemediationDue` on your process). Create and subsequent target changes write UTC midnight, and reads compare the UTC calendar day. Invalid dates stay unknown; missing native dates show a conflict. Unsupported fields produce visible failures. Existing text-only tickets need owner conflict resolution to populate the native field. Reopen uses New. [Work items](https://learn.microsoft.com/rest/api/azure/devops/wit/work-items), [comments](https://learn.microsoft.com/rest/api/azure/devops/wit/comments). |
| Shortcut | Numeric project ID; default `https://api.app.shortcut.com/api/v3` | Native deadline, labels and owners; priority is a mapped native Priority enum custom field. Reopen uses the current workflow unstarted state. [REST API](https://developer.shortcut.com/api/rest/v3). |
| ClickUp | List ID; default `https://api.clickup.com/api/v2` | Native priority, tags, assignees and date-only UTC deadline. Reopen uses an open list status. [API](https://developer.clickup.com/reference/createtask). |
| monday.com | Board ID; default `https://api.monday.com/v2` | Needs a long-text column, tags column, date column, people column and status columns titled Status and Priority, with the mapped priority labels. Description and source links are written in that long-text column; labels use a native tags column in the same mutation as the item, so a failed secondary update cannot create a duplicate ticket. [Items](https://developer.monday.com/api-reference/reference/items), [updates](https://developer.monday.com/api-reference/reference/updates). |
| Basecamp | `account-id/project-id/todolist-id`; default `https://3.basecampapi.com` | OAuth bearer token; native assignee and due date. Priority/labels are description text. Date updates preserve content, description, assignees, subscribers and start date. Comment pagination follows same-account Link headers. [To-dos](https://github.com/basecamp/bc3-api/blob/master/sections/todos.md), [comments](https://github.com/basecamp/bc3-api/blob/master/sections/comments.md). |
| Freshservice | Group ID; `https://tenant.freshservice.com/api/v2` | API key and requester account email. Native priority, tags, responder and date-only UTC deadline. Comments are private notes. Status 4/5 closes; reopen uses 2. [API](https://api.freshservice.com/v2/). |
| YouTrack | Project ID; `https://tenant.youtrack.cloud/api` | Permanent token. Needs Priority, Due Date, Assignee and State custom fields with the configured enum names. Labels use native tags resolved by exact name; reopen uses Open. Dates use UTC midnight. [Issues](https://www.jetbrains.com/help/youtrack/devportal/resource-api-issues.html). |

The original Vector, Jira Cloud, GitHub Issues, Linear and Asana adapters remain
available. Their existing connection forms describe their grants and fields.
GitHub Issues has no native due-date field; its editable `Evidence due date: YYYY-MM-DD` body line is synchronized. Removing it creates a conflict; malformed dates stay unavailable. Changes preserve the other issue text. Vector and Linear labels resolve native IDs. Asana labels resolve workspace tags and Priority uses the project’s native enum custom field. Missing or ambiguous native mappings refuse creation before a ticket exists.

## Webhooks

GitLab issue/note webhooks use `X-Gitlab-Token` and a delivery UUID; ClickUp uses
its webhook secret and `X-Signature`. Paste the secret when connecting. Configure
the callback URL shown by Evidence in the provider. A webhook prompts a fresh
read rather than trusting the payload as a verified state.

For Asana, connect the project and choose **Register Asana webhook** on the
destination page. Evidence requests the registration with an owner-created,
one-use callback target, accepts Asana's `X-Hook-Secret` handshake only for that
target, and then requires `X-Hook-Signature` over the exact request body. Failed
registration removes that attempted signing secret and leaves polling active.
Task events and comment events with a task parent are read back; repeated batches
are admitted once. See Asana's [webhooks guide](https://developers.asana.com/docs/webhooks-guide).
Registration requires Asana to reach the HTTPS callback on the installation;
a purely local installation can continue polling.

For Shortcut, paste the outgoing webhook secret when connecting and configure
the displayed callback URL in Shortcut. The exact body must carry the
`Payload-Signature` HMAC-SHA256 header. Event UUIDs are admitted once; every linked
story in a batch is read once, including batches with no `primary_id`.
Payload values never establish tracker state. See the official
[Shortcut outgoing webhook v1 schema](https://developer.shortcut.com/api/webhook/v1).

Azure Boards service hooks use the displayed HTTPS callback, full resource details,
and Basic username `evidence` with the callback password pasted at connection.
Select work-item and comment events. [Service hooks](https://learn.microsoft.com/en-us/azure/devops/service-hooks/services/webhooks).

monday callbacks require an integration-app OAuth token and the app Signing Secret.
Create board webhooks using that app token. Signed JWTs must name the exact callback
and be unexpired. Unsigned personal-token callbacks are refused. URL verification
only echoes a bounded challenge and cannot change a ticket.
[Webhooks](https://developer.monday.com/api-reference/reference/webhooks),
[authorization](https://developer.monday.com/apps/docs/integration-authorization).

Freshservice Workflow Automator supports POST with Requires Authentication: username
`evidence` and the pasted callback password. Configure Advanced JSON as
`{"ticket_id":"{{ticket.raw_id}}","group_id":"GROUP_ID","event":"{{Triggered event}}","updated_at":"{{ticket.modified_on}}"}`,
replacing GROUP_ID with the connected group ID. Use the numeric raw ID rather
than the INC display ID. [Workflow webhooks](https://support.freshservice.com/support/solutions/articles/157143-using-webhooks-with-the-workflow-automator),
[placeholders](https://support.freshservice.com/support/solutions/articles/239543-list-of-dynamic-placeholders).

YouTrack Webhook Triggers use the callback and pasted `X-YouTrack-Token` for the
connected project. [Triggers](https://www.jetbrains.com/help/youtrack/cloud/webhook-triggers.html).

Basecamp events are unsigned. Choose **Register Basecamp callback** on the
connected destination: Evidence registers an HTTPS payload URL with a unique
256-bit per-destination secret, sealed at rest. The full address is never shown
in the owner page, API responses, audit or archive. Possession permits only a
fresh authorized read of an already linked task, after exact account/project
checks and event-ID deduplication. To-do and comment events are supported; a
callback payload is never tracker truth. A local HTTP installation needs a
publicly reachable HTTPS address before registration can succeed.

The scheduler checks Basecamp registration hourly. Deactivation, changed URL or
types, lost authorization, or an unavailable check destroys local callback
authority and shows the problem on the destination page. Register again to issue
a fresh secret. Ten-minute polling stays active as a backstop. Revocation destroys
the secret; archive restore excludes it and leaves the destination inactive.
Failed registration is labelled unconfirmed; check the provider before retrying,
since a lost response may leave an unusable registration there. An interrupted
registration can be retried after one hour. See the official
[Basecamp webhook API](https://github.com/basecamp/bc3-api/blob/master/sections/webhooks.md).


## Acceptance boundaries

WORK-001 remains partial. `tests/trackers.mjs` names the clause for all thirteen
providers, including native field requests, deadlines/conflicts, failure recovery,
source re-tests and credential-free restore. New authenticated webhook journeys
cover Azure Boards, monday, Freshservice and YouTrack. Mapped Evidence-origin tracker assignee/status writes now use the live human owner
session, explicit native identities, a fresh read before writing and a confirming
read-back. The field editor refuses a changed selected field with both values and
UTC time in Sync history; a fresh read and explicit new decision are required.
Unknown identities refuse writes. A read-before-write check cannot lock concurrent
provider edits after the read. Unconfirmed writes remain uncertain.
Separate Evidence owner/state edits do not satisfy those writes.
Remaining: the Vector API-003 comment-read receiver contract and inbound comment
text with author/time/stable-ID/link/truncation/privacy proof; the current API
returns activity metadata only.
Basecamp registration, callback replay/boundaries, hourly deactivation, polling
backstop and secret-free restore are covered by WORK-001 journeys. Each tracker has the live Gap
**not yet run against a live account**; no provider verification is claimed.

## Human tracker field edits

On an obligation, choose **Edit tracker fields**. This reads the tracker, then
offers only the destination's explicit assignee and status mappings. Choose
a change and enter its reason. Provider status values are native IDs except
GitHub `open`/`closed`, GitLab `opened`/`closed`, Asana and Basecamp
`incomplete`/`completed`, Azure Boards state names, ClickUp status strings,
monday status indices and Freshservice numeric status values. Jira resolves
exactly one currently available transition into the mapped destination status.
Assignees use native user IDs, GitHub logins or Azure identity IDs.
Missing identities or mappings are refused; names never infer identity.
Closing from Evidence still queues a source re-test and cannot verify a failure.
AUTH-001 inherits scoped human access before delegated roles ship.
