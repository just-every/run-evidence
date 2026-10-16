# Evidence public API (v1)

The v1 API lets scripts and private collectors push resources and evidence into
Evidence, define custom tests, push risks, and read program state. The OpenAPI
3.1 description is served by every installation at `/v1/openapi.json`.

## Tokens

Issue tokens under **Connections → API tokens**. A token is shown once; Evidence
keeps only its SHA-256 fingerprint. Each token names its scopes and expires within
a year. Revoke it on the same page; the next call fails.

| Scope | Allows |
| --- | --- |
| `read` | `GET /v1/{programs,controls,requirements,tests,test-results,remediation,policies,people,vendors,risks,resources}` |
| `resource-push` | `PUT /v1/resource-types/{type}`, `PUT /v1/resources/{type}`, `DELETE /v1/resources/{type}/{uniqueId}` |
| `evidence-push` | `POST /v1/evidence` |
| `test-write` | `POST /v1/tests`, `POST /v1/tests/{id}/runs` |
| `risk-push` | `POST /v1/risks` |

No scope approves, publishes, changes roles or acts as the owner. A token is bound
to the installation that issued it; another installation refuses it. Cookies are
ignored on `/v1`. Each token may make 120 calls a minute; past that, calls answer
`429` with `Retry-After` and `retry_after_seconds`. Every call is recorded with its
token, route and status, never the token itself.

## Pushing resources

```sh
curl -X PUT "$EVIDENCE/v1/resource-types/internal_service" \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"schema":{"fields":{"mfa_enforced":"boolean","owner":"string"},"required":["mfa_enforced"]}}'

curl -X PUT "$EVIDENCE/v1/resources/internal_service" \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"resources":[{"uniqueId":"billing","attributes":{"mfa_enforced":false,"owner":"platform"}}],"fullSync":true}'
```

- Upserts are idempotent by `uniqueId`: an identical payload changes nothing, not
  even the update time.
- With `fullSync: true`, resources of the type that the payload omits are marked
  removed. Their history stays; nothing is deleted.
- Each item is validated on its own: invalid items come back `rejected` with
  reasons while valid items are admitted.
- Pushed resources are labelled **source-reported** with the token's name and
  owner, distinct from connector reads (**source-observed**) and manual uploads.
- A push that changes resources is a source-change event: tests over the type run
  at once.

## Custom tests

```json
{ "name": "Internal services enforce MFA", "resourceType": "internal_service",
  "criteria": [{ "attribute": "mfa_enforced", "op": "equals", "value": true }],
  "cadence": "hourly", "category": "identity", "severity": "high", "controls": ["AC-05"] }
```

Criteria use `equals`, `min` or `max`. An attribute the source does not expose is
**unknown**, never a pass. Each run appends immutable observations; failing items
open remediation obligations with SLA clocks.

## Evidence documents

`POST /v1/evidence` (multipart: `requirement_id`, `file`, `covered_from`,
`covered_to`, optional `effective_date` and `source`) issues a normal receipt. Its
origin stays `manually-asserted`; its source names the token and owner.

## Reading state

Collections page by change time: `?limit=1..200&cursor=…&changed_since=ISO8601`.
Follow `next_cursor` until it is `null`.

## Versions

Breaking changes ship as `/v2`. A deprecated version keeps working for at least
12 months after its successor ships.
