# Move in from Drata

Evidence can read an audit-evidence ZIP with the static HTML manifest shape documented by Drata. It makes no provider calls. Compatibility has been checked against documented-shape test fixtures; this release does not claim validation against a real tenant export.

## Before you start

Keep the original ZIP private and unmodified. The supported package contains `evidence_manifest.html` and shortened files directly under `Evidence/`. The manifest table has Requirement, Control, Original Path and Abbreviated Filename (/Evidence) columns.

Input is limited to 20 MiB, with at most 150 ZIP entries, 50 controls and 100 manifest rows. Total expanded bytes are limited to 25 MiB; each evidence file is at most 10 MiB and the manifest is at most 512 KiB. Unsupported layouts are refused rather than guessed.

## Check the ZIP

Open **Move in** in your own installation. Choose the **Audit evidence ZIP (up to 20 MiB)**, then **Check ZIP and review mapping**.

The dry run shows control and evidence counts, files available and missing, unreferenced files and fingerprints for the package, manifest and available referenced files. At this stage, no controls or receipts have been admitted. The original ZIP is retained in custody.

## Review the mapping

For every source control, choose one of **Create plain control**, **Map to existing proof** or **Leave out**. A new control needs a plain-words name, named proof, group and cadence.

Assign historical covered dates to every included mapping. These dates are your claims, not dates verified or supplied by Drata. Source account and export and collection times remain unknown for this documented manifest shape. Evidence does not infer them from ZIP timestamps or filenames.

Review all counts, missing-file diagnostics and digests. Missing files remain diagnostics and source records; they never receive a receipt. Unreferenced files remain in the retained original ZIP.

## Approve admission

After reviewing the mapping, select **Approve this import**, then **Approve and import** in your owner session. Approval applies to the exact prepared fingerprint. Use **Continue** if the import needs more than one batch.

Admitted receipts have imported origin. Their files, source paths, manifest relationships and package fingerprints retain their provenance. Imported historical coverage never satisfies a current proof gap or claims an observed control operated. Add native proof separately when you have it.

## Inspect history or undo

Open **Import history**, then the import's **Durable import journal** to inspect its progress and retained originals.

**Undo imported additions** removes active links admitted by that import. It preserves the original ZIP, manifest, immutable receipts, files, actors, provenance and approvals. It does not delete later native uploads, control edits or decisions. Repeated Undo or Continue actions resume the recorded reversal direction.

For exact parser limits and technical custody behavior, read [Drata evidence move-in](DRATA-IMPORT.md). Include import custody in your [Evidence archive](BACKUP-RESTORE.md).
