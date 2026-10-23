# Original dependency manifest custody

This owner-session API retains original source files separately from the existing
package inventory. It supports GitHub, GitLab, Bitbucket Cloud and Azure DevOps.
It does not declare a control pass, vulnerability retest, AI approval or provider
verification. The normalized inventory keeps its existing source semantics.

## Owner consent and capture

Use an authenticated owner session at the installation's own origin. API bearer
tokens, supplier links and anonymous requests cannot grant, capture or download
originals. State-changing requests require the normal same-origin checks.

1. Select repositories on the connection. Capture requires 1–20 selected repositories.
2. `GET /api/connections/{id}/manifests` returns the exact credential revision,
   current grant, supported paths and retained snapshot metadata.
3. `POST /api/connections/{id}/manifest-grants` with JSON fields `decision: grant`,
   `reason`, `credential_revision` from that state and `acknowledge_originals: yes`.
   The acknowledgement explicitly permits private originals in owner-requested
   custody exports. The append-only decision records the owner, reason and sequence.
4. `POST /api/connections/{id}/manifests` performs a manual capture. It resolves
   each repository's default branch once, then reads only `package.json`,
   `package-lock.json`, `requirements.txt` and `go.mod` at that immutable commit.
   All provider requests are GETs to the configured provider origin; authenticated
   redirects are refused. No source-supplied download URL is followed.
5. List snapshots again and follow a snapshot's `download_url`. Downloads check
   the retained byte count and SHA-256 before returning an inert attachment.
6. Revoke capture with `POST /api/connections/{id}/manifest-grants`, fields
   `decision: revoke` and `reason`. A later grant must name the current credential.

Rotation invalidates the grant even when the new token has the same value.
Every source GET rechecks the latest grant, credential and selected repository;
a read already in flight cannot commit after authority changes. Revocation stops
new collection; it does not destroy retained history. Grant sequences survive
restore, which leaves connections and write authority inactive until separately
reauthorized. AUTH-001 inherits any later delegated authority; SECURE-001 and
ERASE-001 inherit encryption, retention, authorized erasure and export policy.

## Bounds and honest outcomes

Each file must be nonempty UTF-8, at most 128 KiB. JSON files must parse. The
reader refuses recognized credential fields, credential-bearing URLs, private-key
markers and literal or encoded reflections of the current source credential.
This conservative filter is not comprehensive secret detection. No refused bytes
are retained. The owner must review whether source files are suitable to retain.

Snapshot metadata names the connection, repository, immutable source revision,
root path, SHA-256, byte count, source permalink, Evidence read time and consent
decision. Exact whitespace and line endings remain unchanged. GitHub and Azure
Git blob hashes and GitLab content hashes are checked against the bytes; a
Bitbucket original is bound by the immutable commit in its fixed source path.
A changed branch cannot mix commits within one repository's capture.

The response lists captured snapshot ids, absent paths and gaps separately.
Unreadable, malformed, excessive or unsafe files produce a visible partial result;
absence never creates package evidence or a passing control. An identical
connection/repository/commit/path/digest does not create another snapshot.
Original files and metadata join the streaming custody archive; missing or changed
bytes remain unavailable. Originals do not enter logs, provider cursors or model
requests. Grant, capture and download decisions are audited without source keys.

This API has no dedicated screen or scheduled capture yet. Recursive paths,
other manifest formats, the other providers' normalized vulnerability feeds and
unavailable historical source outcomes remain CODE-001 gaps. Original-file
retention/export uses an adopted deny-by-default owner-consent policy pending ct
approval; CODE-001 remains PARTIAL. No live account has been exercised.

## Source formats and proof

Reader shapes follow GitHub REST repository, branch and Contents APIs; GitLab
Projects, Branches and Repository Files APIs; Bitbucket Cloud Repositories,
Branches and Source APIs; and Azure DevOps Git Repositories, Refs and Items 7.1
APIs. Only the explicitly consumed identity, revision, size, encoding and digest
fields influence admission.

`tests/helpers/code-manifests-journey.mjs`, invoked by the existing dependency
scenario in `tests/github.mjs`, exercises two selected repositories on each
provider through the owner HTTP doors. It proves consent, exact revision/bytes,
unsafe and denied reads, immutable idempotence, revocation, credential rotation,
private downloads and complete custody restore with authority inactive.
