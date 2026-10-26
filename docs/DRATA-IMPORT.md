# Drata evidence move-in

The first kit reads the **static HTML table and ZIP folder layout documented by
Drata** in [Using the Drata Evidence Package and Manifest File](https://help.drata.com/en/articles/12739202-using-the-drata-evidence-package-and-manifest-file)
(published February 3, 2026; inspected October 15, 2026). It makes no provider
calls and does not claim tested compatibility with a real tenant export.

Drata documents `evidence_manifest.html`, shortened files under `Evidence/`,
`ControlEvidence/`, `AuditInfo.txt`, and `Controls-to-Requirements.csv`. The
manifest has four columns: Requirement, Control, Original Path, and Abbreviated
Filename (/Evidence). This kit finds one static HTML table with those headings
(case and column order are immaterial), and reads its ordinary rows and relative
file links. `Evidence/1.pdf` and `./Evidence/1.pdf` links are accepted. HTML entity
references and URL-escaped filenames are decoded before exact path matching.
Scripts and styles are ignored, never executed. The manifest is downloaded as an
attachment, never previewed inline. Tables generated only by JavaScript, changed
headings, rowspans/colspans, ZIP64, encrypted ZIPs, and nested Evidence paths are
outside this first parser's supported shape. An unsupported shape refuses; it
does not invent records. Optional metadata/CSV/control-folder files stay in the
original ZIP and are not interpreted as instructions or source timestamps.

The fixtures in `tests/fixtures/drata/` are synthetic examples of this documented
table layout, with short filenames, framework relationships, an absent file,
extra package files, and stored/deflated ZIP generation. They are test data only,
not a captured Drata export or production examples seeded into the app.

## Owner flow

Open `/app/import`, upload the ZIP, and inspect the dry-run. It reports control
and evidence counts, available and missing references, unreferenced files,
archive/manifest SHA-256, and the size/digest of every available referenced file.
No controls, receipts or Base import jobs exist at this point. The original ZIP
is retained in R2 and its digest checked by readback.

For each source control the owner chooses to create a plain control, map to an
existing proof requirement, or leave it out. Creating one requires a control in
plain words, a named proof, one existing group and a cadence. Every included
mapping requires an owner-assigned historical coverage date range. These dates
are **owner claims**, not dates supplied or verified by Drata. Saving mapping
prepares a Base plan and its exact fingerprint, without creating a job. The owner
then checks the approval box and submits that fingerprint. There is no automatic
approval, connector authorization or imported authentication identity.

Source account, source export time and source collection time are unknown for
this documented table shape, and remain null. ZIP timestamps and path names are
never used to infer them. Receipt `added_at` is when Evidence first received the
ZIP, not when the control ran. Source requirement, original path, shortened path,
package digest and original bytes remain in retained provenance. Source control
identities derive from visible control text; source evidence identities derive
from all four table values, scoped to the ZIP digest. The same package cannot be
silently applied again under a different review's native IDs: Base refuses its
conflicting source identity. Replaying the same approved operation is idempotent.

Files missing from the ZIP remain diagnostics and source records; they never get
a receipt. Unreferenced files remain accessible through the original ZIP. All
created evidence receipts have `origin=imported`. Their historical periods never
satisfy a current proof gap or produce a pass. A later native upload or decision
is separate evidence and keeps its own provenance.

## Durability and undo

The committed Base import-kit D1 implementation is vendored unchanged under
`src/evidence/import/base/`, from commit
`4a7833932a723c203191e84f1de905d84e4cbf1c`; `SOURCE.md` records custody. It stores
plans, plan chunks, exact ZIP and manifest originals, sources, per-effect
provenance, batches and reversal progress in D1. Approval is stored separately
and cannot be changed after the fact. Each invocation processes at most five
source records in one batch; use Continue to resume. Retry after a failed job
creation uses the approved fingerprint. R2 additions are written with fresh,
immutable object keys and verified before any receipt is published. A storage
failure may leave retained unlinked bytes, never a successful completeness claim.

Undo (or rollback for a partially applied job) reverses only active import links.
Controls, requirements, receipt actors, immutable receipts, exhibits, original ZIP,
manifest, provenance, approval and byte custody remain. Native uploads, later
control edits and later business approvals are not deleted or rewritten. Repeated
Undo/Continue calls resume the persisted reversal direction. Imported history is
still downloadable after unlinking.

Every import HTTP door checks host, same-origin policy, native session and owner
role. The durable Base batch additionally fences the current native session,
operator role/status/version, expiry and approved review binding. Each review is
bound to its initiating owner identity. Restored history preserves that original
identity as inert provenance; it does not authorize the destination owner to run
its old plans or approvals.

Limits: 20 MiB ZIP input, 25 MiB total expanded bytes, 10 MiB per file, 512 KiB
manifest, 150 ZIP entries, 50 controls, 100 manifest rows. Paths cannot be absolute,
traverse, contain alternate separators, drives, repeated/ambiguous encodings,
control characters, or case-insensitive duplicate names. ZIP CRC, local/central
headers, non-overlapping file ranges, byte lengths and SHA-256 are checked. No ZIP
entry is extracted to the filesystem. The owner archive's metadata bound can
refuse a large journal honestly; that does not discard stored custody.

## Integration contract

Register `importHandler(clock?)` from `src/evidence/import/http.ts` before the
broader Evidence handler. Routes are `/app/import` and `/api/import`; upload is
`POST .../drata` with multipart `file`. A review is `.../<review-id>`; its
`source` and `manifest` endpoints download retained originals. `POST .../mapping`
accepts `{mapping:[{source_id,action,name,proof,group,cadence,requirement_id,
covered_from,covered_to}]}` (fields depend on action). `POST .../commit` requires
`{approve:"commit",fingerprint}`. Continue is `POST .../resume` with `{}`;
undo requires `POST .../undo` with `{approve:"undo"}`. HTML forms implement the
same flow with the existing Evidence Base theme/frame and no redesign.

Apply additive migration `0010_import.sql`. `import_additions` is the immutable
ownership registry; `import_active` contains currently linked targets. A control
target ID is its native `controls.id`, with `requirement_id` in `value_json`. A
receipt target ID is its native receipt ID. The proof desk should hide an unlinked
imported requirement unless it has later native proof or independent decisions;
receipt history/byte downloads remain retained. Exclude imported origin from
coverage calculations regardless of whether its import remains linked.

`archive.ts` exports:

- `exportImportArchive(env)` (also `importInventory`) returns `{rows,files}`.
- `validateImportExtension(value,baseRows?)` validates fixed columns, retained
  plans/digests, ownership references and optional native domain references.
- `restoreImportStatements(extension)` returns `{sql,params?}[]` for the caller's
  **single restore transaction**, including suspension/reinstallation of Base's
  derived-state triggers. Domain tables must be inserted before these statements.
- `importTableColumns` inventories every table for emptiness and export checks.
- `importRestoreTriggers` lists only the committed Base trigger definitions.

BLOB `bytes` fields in `ik_originals`, `ik_d1_original_chunks`, and `ik_stages` use
uppercase hex in archive rows and become bound BLOBs during restore. Source ZIP
file descriptors have `path`, `object_key`, `size`, `sha256`, `available`; their
path/key are `import-sources/<review-id>`, up to 20 MiB. Include available sources
in the archive stream and preserve missing-source descriptors. The archive must
never recreate auth sessions, execute a plan, infer an approval, or automatically
resume a job. Existing active links and all undo/history state restore as data.

Parent-run integration command: `rer run test:import`. It uses the real
workerd/D1/R2 runtime in `tests/helpers/runtime.mjs`, including full owner archive
export/restore. No package/dependency changes are required by this kit.
