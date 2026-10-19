# Backup and disaster recovery

An Evidence archive carries business records and retained bytes together: programs, custom frameworks and mappings, control and requirement revisions, exact evaluated observations, immutable receipts, policies and personnel work, risks and vendors, remediation and delivery history, access and review decisions, import custody, agent decisions and the product action audit. Population uploads, framework spreadsheets and retest documents retain their originals. Unavailable bytes stay explicitly unavailable. An archive proves custody of what was recorded; it does not prove that a control operated.

Keep archives and erasure journals private. They contain sensitive business evidence. Authentication, receiving-owner identity, sessions, provider secrets and execution credentials stay local and never travel as authority in an archive.

## Keep a usable recovery set

Keep these together in a private backup location:

- The latest complete `.evidence` archive and the latest source-lineage erasure journal. Keep later journals even when retaining older archives.
- The matching Evidence checkout, its lockfile and migrations, Node 22 and its installed frozen dependencies. Retain these before an outage so recovery does not require a package registry or the original hosted service.
- Installation and local-storage instructions, and the recovery owner’s separately held access material. Do not put secrets in the archive or repository.

An archive from before an erasure cannot reveal an erasure performed afterward. Evidence refuses that old archive when the receiving installation or a supplied later journal knows about the erasure. A fresh destination given no later journal labels the result **erasure history unverified**, asks for the latest journal, and requires explicit acknowledgement before proceeding without it. That acknowledgement does not establish that no later erasures exist. Actual erasure, retention holds and audit anonymization are ERASE-001’s obligations; archive recovery never invents them.

## Export from Yours

Open **Yours**, then **Evidence archive**. Inspect record counts, available bytes and unavailable entries. Download the archive and the latest erasure journal. Preserve both in your recovery set.

The archive streams records and file parts. It does not stop at the former 20,000-record or 64 MiB aggregate boundaries. Each frame is bounded; large transfers use multiple parts. Every portable table and blob is accounted for, and unknown tables, columns or object namespaces refuse export. A concurrent source mutation or changed file aborts the export rather than claiming a complete snapshot. Retain only completed exports.

## Prepare a separate empty destination

Never reset the only installation to test a backup. Prepare a separate Evidence checkout and local database/bucket. Destination owner authentication may already exist, and remains the destination’s own identity after restore.

For an online preparation, start a separate installation with `npx -y @runeditrun/rer dev just-every/run-evidence --dir evidence-restore`, open its private local owner link and complete setup. For an outage recovery, use the already prepared checkout and dependencies in the recovery set; the local archive command opens only local D1/R2 bindings and does not contact the lost hosted installation.

Stop the development process from its own terminal with **Ctrl-C** before local archive commands. Do not run two processes against the same local storage while recovering.

## Review and restore in the console

In the empty destination, open **Yours** and choose the archive plus the latest erasure journal. The browser uploads bounded parts and shows progress. Run the dry run and inspect counts, unavailable bytes, journal history and validation results before confirming the exact staged transfer. An interrupted or refused transfer admits no business records; choose the same file to resume its staged upload. The owner-only upload API also permits cancelling that upload.

The final admission is transactional. Receipt facts, original actor provenance, revisions, removed requirements and earlier failures retain their meaning. Unknown namespaces, corrupt or missing parts, mismatched fingerprints and a nonempty destination are refused. Older v1–v9 archives remain readable, but cannot recover fields or bytes they never carried.

## Recover offline with the local command

From the source checkout, while it is stopped:

```sh
node scripts/archive.mjs export --output /private/backups/evidence.evidence
node scripts/archive.mjs journal --output /private/backups/evidence-journal.json
```

From the separate empty destination checkout, using the archive and latest journal copied into the recovery environment:

```sh
node scripts/archive.mjs restore --input /private/backups/evidence.evidence --journal /private/backups/evidence-journal.json --dry-run
node scripts/archive.mjs restore --input /private/backups/evidence.evidence --journal /private/backups/evidence-journal.json --yes
```

Inspect the dry run before the confirming command. `--config PATH` and `--state PATH` select the destination’s local configuration and storage; they never select remote bindings. If no later journal can be recovered, the dry run remains explicitly unverified. Only after investigating that gap, add `--accept-unverified-history` to acknowledge recovery without a verified later journal. Do not describe that recovery as protected from unknown later erasures.

Reconcile record counts and unavailable entries, open earlier control/framework revisions, and download retained files to compare their fingerprints. Keep the source recovery set until the destination is checked.

## Restore execution authority separately

Restore does not replay messages, collection, source writes or external sharing. A persisted recovery barrier survives restart. Restored reviewer links remain permanently closed, and restored agent/API credentials cannot authenticate.

Use the archive’s reauthorization controls to authorize only the intended capability: schedules, mail, collections, writes or shares. For a connector, select that connector’s identity and reconnect it with a fresh owner-authorized credential; authorizing one connector does not authorize other connectors. Existing archived credentials do not return. Create fresh review folders and agent credentials through their normal owner approval flows when needed.

Base’s generic product transfer remains separate from this complete Evidence domain archive. Keep backups, local state and credentials out of git.
