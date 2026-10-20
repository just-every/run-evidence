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
most fifty due ticket rows per scheduler invocation; hosted capacity above this
batch size has not been measured. Source-read failure never fabricates a pass.

| Tracker | Project field and API address | Field details and official API |
| --- | --- | --- |
| GitLab Issues | Project ID or path; default `https://gitlab.com/api/v4` | Native assignee, labels and due date; priority is a scoped label. [Issues](https://docs.gitlab.com/api/issues/), [notes](https://docs.gitlab.com/api/notes/). |
| Azure Boards | Project name; `https://dev.azure.com/organization` | Work-item type defaults to Task. Native priority and tags; initial deadline is description text. Reopen uses New. [Work items](https://learn.microsoft.com/rest/api/azure/devops/wit/work-items), [comments](https://learn.microsoft.com/rest/api/azure/devops/wit/comments). |
| Shortcut | Numeric project ID; default `https://api.app.shortcut.com/api/v3` | Native deadline, labels and owners; priority is description text. Reopen uses the current workflow unstarted state. [REST API](https://developer.shortcut.com/api/rest/v3). |
| ClickUp | List ID; default `https://api.clickup.com/api/v2` | Native priority, tags, assignees and date-only UTC deadline. Reopen uses an open list status. [API](https://developer.clickup.com/reference/createtask). |
| monday.com | Board ID; default `https://api.monday.com/v2` | Needs a date column, people column and status columns titled Status and Priority, with the mapped priority labels. Description, source links and labels are the first update. [Items](https://developer.monday.com/api-reference/reference/items), [updates](https://developer.monday.com/api-reference/reference/updates). |
| Basecamp | `account-id/project-id/todolist-id`; default `https://3.basecampapi.com` | OAuth bearer token; native assignee and due date. Priority/labels are description text. Date updates preserve content, description, assignees, subscribers and start date. Comment pagination follows same-account Link headers. [To-dos](https://github.com/basecamp/bc3-api/blob/master/sections/todos.md), [comments](https://github.com/basecamp/bc3-api/blob/master/sections/comments.md). |
| Freshservice | Group ID; `https://tenant.freshservice.com/api/v2` | API key and requester account email. Native priority, tags, responder and date-only UTC deadline. Comments are private notes. Status 4/5 closes; reopen uses 2. [API](https://api.freshservice.com/v2/). |
| YouTrack | Project ID; `https://tenant.youtrack.cloud/api` | Permanent token. Needs Priority, Due Date, Assignee and State custom fields with the configured enum names. Labels are description text; reopen uses Open. Dates use UTC midnight. [Issues](https://www.jetbrains.com/help/youtrack/devportal/resource-api-issues.html). |

The original Vector, Jira Cloud, GitHub Issues, Linear and Asana adapters remain
available. Their existing connection forms describe their grants and fields.
GitHub Issues has no native due-date field; its deadline is ticket text.

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

Provider-specific inbound webhook registration/verification for Azure Boards,
Shortcut, monday.com, Basecamp, Freshservice and YouTrack remains unbuilt. Those
adapters currently use polling even though their providers offer webhooks.

## Acceptance boundaries

WORK-001 remains partial. Text-only field fallbacks are labeled, and later Azure
target-date edits are not synchronized to the description yet. The full native
field/conflict and inbound replay matrix is still required for all thirteen
destinations. The network fakes in the public-door journeys use documented
provider shapes. Each tracker still has the live Gap **not yet run against a
live account**; no provider verification or live-account operation is claimed.
