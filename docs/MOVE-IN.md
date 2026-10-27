# Move in from Vanta, Drata or Secureframe

Evidence reads each incumbent separately from its documented export, makes no provider calls and is not affiliated with any of them. Compatibility has been checked against fixtures built from each provider's published schema (Vanta's Manage and Auditor API responses, Secureframe's API responses, Drata's evidence package); this release has not been run against a live tenant, and the live-account journey is a named gap. Credentials are never read from a ZIP and nothing is connected by importing: reconnect each source from **Connections** to start fresh observations.

## Vanta and Secureframe

Upload one ZIP per incumbent under **Move in**. It holds the API list responses exactly as returned, one JSON file per page, under `vanta/` or `secureframe/` (see **Supported export shapes** in the product for the folder layout), plus any downloaded files (`vanta/documents/<id>/files/<upload id>`, `secureframe/files/<evidence id>`) and an optional `export-info.json` with `exported_at`. A malformed page refuses the whole ZIP; a malformed record is refused alone.

The preview reconciles ten record classes separately: frameworks, controls and mappings; test history; policies with approval history and attestations; people; vendors; risks; access-review decisions; audit requests; trust-center and answer-library content; and original exhibits. Each shows what the export holds, what will be admitted, what is **unsupported** (a record the incumbent exports that Evidence cannot carry, with its reason) and what is **refused** (invalid or internally inconsistent, with its reason). Where an incumbent exports no records of a class, the preview names what is missing and the authorized API or manual route to bring it in.

People who share an email in the export, and people whose email already exists in People, are groups you decide (same person, different people, or link to the existing person). Nothing is merged or matched automatically, and People is never changed.

After approval the records are history: labeled imported, with the incumbent's name, original ids, original timestamps and the export date, never verified, never current proof and never counted as a source observation. **Export imported records** downloads them (JSON or CSV, audited); original exhibit bytes download with their SHA-256. **Undo** removes the live links and keeps the retained additions, the source ZIP and every later decision. Import custody travels in the Evidence archive.

## Drata

## Before you start

Keep the original ZIP private and unmodified. The supported package contains `evidence_manifest.html` and shortened files directly under `Evidence/`. The manifest table has Requirement, Control, Original Path and Abbreviated Filename (/Evidence) columns.

Input is limited to 20 MiB, with at most 150 ZIP entries, 50 controls and 100 manifest rows. Total expanded bytes are limited to 25 MiB; each evidence file is at most 10 MiB and the manifest is at most 512 KiB. Unsupported layouts are refused rather than guessed.

## Check the ZIP

Open **Move in** in your own installation. Under Drata, choose the **Audit evidence ZIP**, then **Check Drata ZIP and review**.

The dry run shows control and evidence counts, files available and missing, unreferenced files and fingerprints for the package, manifest and available referenced files. At this stage, no controls or receipts have been admitted. The original ZIP is retained in custody.

## Review the mapping

For every source control, choose one of **Create plain control**, **Map to existing proof** or **Leave out**. A new control needs a plain-words name, named proof, group and cadence.

Assign historical covered dates to every included mapping. These dates are your claims, not dates verified or supplied by Drata. Source account and export and collection times remain unknown for this documented manifest shape. Evidence does not infer them from ZIP timestamps or filenames.

Review all counts, the reconciliation by record class, missing-file diagnostics (refused) and digests. Drata's evidence package holds controls and their files only, so every other class is named as not exported with its manual route. Missing files remain diagnostics and source records; they never receive a receipt. Unreferenced files remain in the retained original ZIP.

## Approve admission

After reviewing the mapping, select **Approve this import**, then **Approve and import** in your owner session. Approval applies to the exact prepared fingerprint. Use **Continue** if the import needs more than one batch.

Admitted receipts have imported origin. Their files, source paths, manifest relationships and package fingerprints retain their provenance. Imported historical coverage never satisfies a current proof gap or claims an observed control operated. Add native proof separately when you have it.

## Inspect history or undo

Open **Import history**, then the import's **Durable import journal** to inspect its progress and retained originals.

**Undo imported additions** removes active links admitted by that import. It preserves the original ZIP, manifest, immutable receipts, files, actors, provenance and approvals. It does not delete later native uploads, control edits or decisions. Repeated Undo or Continue actions resume the recorded reversal direction.

For exact parser limits and technical custody behavior, read [Drata evidence move-in](DRATA-IMPORT.md). Include import custody in your [Evidence archive](BACKUP-RESTORE.md).
