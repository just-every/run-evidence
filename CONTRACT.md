# Evidence contract

Evidence is a provider-free, owner-operated proof desk for one business. It keeps owner-written controls, named proof and cadence, exhibits, immutable receipts and honest gap states in local D1/R2. R2 adds narrowly scoped review folders and domain-aware custody export/restore. A fingerprint shows that stored bytes match a receipt; it does not prove that a control operated or that an exhibit is true.

| Clause | Release status | Promise and public door |
| --- | --- | --- |
| PROOF-001 | Built in r1 | Owner creates Control → Requirement → Exhibit → Receipt through /app; uploads issue receipts from stored bytes, preserve facts and keep replaced bytes downloadable. |
| GAP-001 | Built in r1 | /app and /api/desk derive one of covered, due soon, overdue, missing, superseded-only, or unavailable bytes per requirement and selected period. There is no aggregate green score. |
| REVIEW-001 | Built in r2 within the acceptance boundary below | Owner selects controls, an inclusive date range and expiry when issuing an external reviewer folder. The one-time bearer link is scoped and checked on each public request. Owner doors are /app/folders and /api/folders; reviewer doors are /review/{token}, /exhibits and /receipts/{id}[/view|/download]. |
| CUSTODY-001 | Built in r2 within the acceptance boundary and size limits below | Owner uses /app/archive and /api/archive/manifest, /export and /restore to inventory, stream, validate and restore Evidence domain records and exhibit bytes. This is separate from Base's generic portability. |
| IMPORT-001 | First release | Drata documented ZIP/HTML shape: owner reviews mappings, explicitly admits a Base journal and unlinks via undo while retaining custody. See docs/DRATA-IMPORT.md. |
| COLLECTION-001 | Later | Permissioned identity, cloud, code-host and staff collectors need owner provider accounts and source-specific proof. |
| ANSWER-001 | Later | Evidence-grounded questionnaire drafts and exact-revision approval need representative questions and authorized sources/accounts. |

| AGENT-001 | First release | Prepare-only credentials inspect gaps and propose scoped folders. Owner sessions approve the current exact snapshot; immutable decisions persist. See docs/AGENT-COMMANDS.md. |

The status wording above does not claim a test run ID. Public-door checks and their current acceptance boundary are named in ACCEPTANCE.md.

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

## REVIEW-001: selected, expiring reviewer access

An owner issues a folder with a reviewer label, one or more existing controls, a start and end date, and a future UTC expiry. The dates are inclusive and the start cannot follow the end. Duplicate control selections collapse to one selection. Issuing creates a random 256-bit bearer token. The creation response is its only display; persistent storage keeps its SHA-256 digest, not the raw token. Owner folder listings and revisits cannot recover the link. Treat the link as a secret: anyone who has it may use the selected reviewer doors until the folder closes or expires.

The reviewer does not sign in and receives no owner session or mutation route. Each page, list, receipt and download request re-reads the stored grant. Authorization requires the matching token, an open folder, a request before expiry, the expected local origin, a read-only GET/HEAD method and the current control and period selection. Expiry is exact: at now equal to expires_at the request is refused. The grant is rechecked immediately before a response is disclosed, so a close or expiry during a storage read cannot preserve a stale response. Public pages and responses are no-store and use no-referrer.

The folder's date interval is inclusive. A receipt is visible only when its whole covered-from/through interval is inside that interval and its requirement belongs to a selected control. A receipt that crosses either boundary is excluded from the list and from direct receipt/view/download access. The gap for each selected requirement uses the r1 calculation at the folder's end date. Covered, due soon and unavailable bytes use only in-scope receipts. Full history preserves whether an in-scope receipt was superseded, and the full-history overdue result is used only when the scoped calculation would be missing. A gap can therefore show overdue or superseded-only because of hidden history, but hidden rows cannot establish covered or unavailable bytes. The hidden receipt fields and bytes stay private.

Reviewer projections contain the selected control and requirement, cadence, gap, in-scope receipt facts, origin and source, period, fingerprint, filename, size, media type, availability, and the in-scope supersession relationship. They omit uploader or owner identity, object-storage keys, private owner routes, other controls/folders and review logs. Downloads are verified attachment/octet-stream responses with nosniff and sandbox policy; unavailable bytes do not produce a successful download. Unknown, changed, closed, expired and out-of-scope requests use the same plain 404 response on reviewer doors. Storage failure returns an unavailable response rather than asserting access or coverage.

Owner-only event history records allowed and refused page/list/receipt/download attempts with time and known folder/exhibit association. Unknown-token attempts have no invented folder association. Events contain no raw token or token-bearing URL. Reviewers cannot see event logs or write findings. This round intentionally omits reviewer findings and auditor-acceptance claims. Closing is terminal; reissue means creating a new folder. Closing cannot revoke a copy a reviewer already downloaded.

Exhibits remain private locally and immutable. There is no automatic pruning or per-receipt allowlist on a review folder: every receipt whose full period is inside the selected interval for a selected control is in scope, including superseded history. Inspect the whole projected list before sharing. A redacted replacement is a new receipt and, when replacing existing proof, explicitly supersedes the prior receipt; the original receipt and bytes stay in history. A redacted replacement does not hide an original that is also inside the folder's control/date scope. A complete archive includes both. Closing a folder cannot revoke a copy a reviewer already downloaded.

## CUSTODY-001: complete domain archive and empty-target restore

The owner archive contains the Evidence controls, requirements, exhibits, receipt facts, receipt-actor provenance, review folders and selected controls, and review events. Archive version 2 also retains import reviews, native links, Base import custody tables and original ZIPs, plus agent token metadata, snapshots and decisions. Version 1 archives remain readable. It never contains reviewer or agent token hashes, owner sessions, passwords or authentication credentials. Restored agent credentials and source-owner import authority remain inactive. Receipt actor IDs and display names are preserved as historical provenance without creating active destination accounts. Restored folders are closed and have no grant hash; their event history remains. Issue a new equivalent folder if review access is needed again.

The manifest records each exhibit's archive path, expected size and SHA-256, plus whether verified bytes were available when inventoried. A complete archive streams all available verified exhibit bytes. Missing, unreadable or changed bytes remain listed with a reason and keep their receipt facts; unavailable bytes are not silently represented as present. The manifest has a digest over its exact serialized bytes, and each file is checked against its retained receipt digest. If an object changes after inventory and before export, export aborts rather than returning an inconsistent archive.

Restore accepts only an empty Evidence domain and exhibit bucket; destination authentication may already exist. It validates the manifest digest, format, relationships and all entries before writing business rows or exhibit objects. It refuses unsafe paths (absolute, traversal, drive or backslash paths), duplicate or unlisted entries, absent entries marked available, incorrect lengths or digests, unsupported versions, excessive metadata, and nonempty targets. A refusal on an empty destination leaves its business records and bucket empty; a nonempty-target refusal leaves that target's existing data untouched. Restore verifies stored bytes before admitting rows, then adds the records in a database transaction. Receipt facts, origin, actors and supersession are preserved. An unavailable entry remains unavailable after restore.

The archive CLI is separate from Base's generic export/import. It provides a streamed export and a dry-run or confirmed restore. Stop dev before using the local CLI. Its standard output is summary JSON; export dry-run adds per-file inventory descriptors with exhibit IDs, paths, sizes, digests and availability, but no business table rows or internal storage keys. Keep that inventory private metadata. The archive file contains the full manifest, including internal object keys, and available original exhibits; keep it private and do not overwrite the original archive.

Current practical limits: metadata is at most 8 MiB and 20,000 total rows; each exhibit is at most 10 MiB, matching the r1 upload limit. HTTP restore uses private local staging capped at 64 MiB total exhibit bytes. The local CLI uses disk staging and the same entry/metadata validators but has no aggregate archive-size cap. These limits are not a promise of unlimited archive size.

## Scope and owner decisions

Defaults remain current Base operator authentication, owner-only domain access, MIT source license, one business, and no shipped framework mappings or compliance templates. These are accepted owner scope choices; changes require an explicit scope decision. Evidence does not certify a business, replace an auditor, supply policies or legal advice, run collectors, answer questionnaires, provide certification seal artwork, or deploy itself. Original migrations remain unchanged; additive migrations carry the importer, agent decisions and current Base authentication schema. Undo does not erase receipts or files; selective custody erasure is outside this first release.

## Run site and presentation

The static run site is separate from each installation. `rer build --site` emits the marketing homepage with its Run Evidence action to `/run`, Base’s installation instructions, and `/docs` rendered from repository Markdown. It loads local assets and works without JavaScript. Site deployment remains disabled until enabled by the run-site gate.

An installed `/` serves Base’s shared Lobby. `/setup/state` reveals only whether the owner has confirmed first-run setup; it admits the configured origin and host. The Lobby offers Finish setup before confirmation and Sign in afterwards, equally for anonymous and signed-in visitors.

The landing, documentation, sign-in, setup and app share one token palette and self-hosted Onest/JetBrains Mono fonts. Acrylic drawings contain accessible text; state colour is confined to small dots. The phone app keeps the complete flows in a scrolling layout, with horizontal navigation and all owner form labels intact.
