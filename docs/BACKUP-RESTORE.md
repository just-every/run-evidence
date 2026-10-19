# Backup and restore

An Evidence archive carries the business records and retained exhibit bytes together. It includes controls, requirements, immutable receipts, review folders, access events, import custody agent preparations and decisions, and original CSV/XLSX population files. Missing population bytes remain listed as unavailable; older archives that never carried those bytes cannot recover them. Treat the downloaded archive as sensitive business evidence.

## Export from Yours

Open **Yours** to reach **Evidence archive**. Read the **Export archive** inventory, including counts, available exhibit bytes and missing files. **View archive manifest** shows original attribution and fingerprints. Select **↓ Download archive** and keep the file in a private backup location.

The download takes a fresh inventory. If available bytes change during the stream, the export fails. Download again to capture the updated inventory. Missing or changed bytes remain explicitly listed; an archive does not conceal them.

Authentication credentials and access tokens are excluded. An archive is a backup, not a publication format. Redact evidence separately before sharing it outside your business.

## Prepare an empty destination

Restore requires an empty Evidence database and exhibit bucket. Destination authentication may already exist. Never reset your only installation to test a backup.

Start Evidence in a separate directory with `npx -y @runeditrun/rer dev just-every/run-evidence --dir evidence-restore`. The checkout gets separate local state and selects a free port. Open its private owner link and confirm setup. Keep your original installation and archive intact.

## Dry-run and confirm restore

In the empty destination, open **Yours**, then **Restore from archive**. Select your **Archive file** and choose **Run dry run**. Inspect the counts, fingerprints and missing-file report before choosing **Confirm restore**.

The dry run validates the entire archive before confirmation. Restore brings back records and available bytes with original receipt facts and actor attribution. Restored review folders stay permanently closed. Agent credentials stay inert. Restoring a journal does not execute an old import plan or authorize an old approval.

Open the Proof desk and receipt history in the destination. Download retained files you need to check. Create fresh review folders and agent access when needed; archived links and credentials do not become usable again.

## Limits

Metadata is limited to 8 MiB and 20,000 rows; each exhibit to 10 MiB. Browser restore stages up to 64 MiB of present exhibit bytes. For larger archives, use the local archive command; it has no aggregate exhibit-byte limit and validates the same archive format.

## Use the local archive command

Stop development first, then run from the relevant Evidence checkout:

```sh
rer dev --stop
node scripts/archive.mjs export --output exports/evidence.evidence
```

Run the restore commands from the separate empty destination checkout, with the archive at the path you supply:

```sh
node scripts/archive.mjs restore --input /private/path/evidence.evidence --dry-run
node scripts/archive.mjs restore --input /private/path/evidence.evidence --yes
```

Inspect the dry run before running the confirming command. Keep archives, local state and credentials out of git. Base's generic `rer export` is separate from this complete Evidence custody archive.
