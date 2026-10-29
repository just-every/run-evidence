# Agent folder preparation

These commands enter the shared company-agent door described in [AGENT-DOOR.md](AGENT-DOOR.md). Before they can act, adopt the signed company policy or, on a standalone installation, use the native owner session at `/agents` to choose a complete preparation policy. Unanswered policy and Pause refuse effects. MCP offers the same three jobs. Set an `Idempotency-Key` header on HTTP preparation to replay a retained result; changed arguments conflict.

Sign in with the owner's native session and open `/app/agent` (the local owner
persona also works). Give the
agent a labelled, expiring **prepare-only** credential. Copy it once into a
private environment variable; subsequent pages and archives cannot recover it.
Revoke access on the same page. Credentials restored from an archive are inert.

The agent can inspect controls, receipt metadata and honest gaps, prepare a
selected folder proposal, and list its own proposals. It cannot upload evidence,
approve, publish a folder, create a reviewer link or act through an owner session.
No LLM or provider connection is involved.

```sh
rer run agent desk --origin https://evidence.example --token-env EVIDENCE_AGENT_TOKEN
rer run agent desk --origin https://evidence.example --token-env EVIDENCE_AGENT_TOKEN --date 2026-10-11
rer run agent prepare-folder --origin https://evidence.example --token-env EVIDENCE_AGENT_TOKEN --input folder.json
rer run agent proposals --origin https://evidence.example --token-env EVIDENCE_AGENT_TOKEN
```

Never pass the credential as a command argument or commit it in a file. The CLI
does not print it and refuses redirects. Use HTTPS; HTTP is allowed on localhost.
The folder JSON names retained control IDs from `desk`:

```json
{
  "reviewer_label": "Customer security review",
  "period_from": "2026-10-01",
  "period_to": "2026-10-31",
  "expires_at": "2026-12-01T00:00:00Z",
  "control_ids": ["CONTROL_ID_FROM_DESK"]
}
```

The owner reviews each proposal at `/app/agent`. Its immutable fingerprint covers
the exact folder selection and prepared evidence/gap snapshot. Approval requires
that fingerprint and a native owner session; a token cannot approve even with an
ambient owner cookie. The decision retains the actor, timestamp, fingerprint and
folder ID. Rejection is final. Concurrent or repeated decisions create no extra
folder. Approval recomputes the selected evidence and gaps; changed receipts,
byte availability or gap state return HTTP 409 and require preparing and reviewing
a new proposal. An expired proposal must be prepared again with a future expiry.

Approval creates the folder through normal review storage and shows its reviewer
link once to the owner. The proposal remains an immutable preparation snapshot;
the approved folder uses the selected controls and period as its scope, including
later in-scope receipts. New uploads or unavailable bytes can change that live view. Stored fingerprints
prove byte identity, not that a control operated or an exhibit is true.

The HTTP interface uses `Authorization: Bearer …` for `GET /api/agent/desk`,
`POST /api/agent/prepare-folder` and `GET /api/agent/proposals`. Owner management
uses same-origin native sessions under `/app/agent` and `/api/agent`. All responses
are private and uncached. Metadata archives retain proposals and decisions but
exclude credential digests; restores never reactivate agent access.
