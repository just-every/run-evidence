# Controls, proof and review folders

The Proof desk answers a narrow question: what proof have you recorded for each control and period? It gives each control its own state, without an aggregate compliance score.

## Add controls in plain words

Use **Add a control** on the Proof desk. Fill in **Control in plain words**, **Group**, **Named proof** and **Cadence**, then select **Add control**.

Groups are Access, Data, Change, People and Vendors. Cadences are daily, weekly, monthly and quarterly. Name the proof specifically enough that you know what to add next time.

## Add and replace proof

Open **Upload proof & view history** on a control. In **Add proof**, select a file, state its source and enter the inclusive UTC covered dates. Files must be nonempty and no larger than 10 MiB. Files are downloaded, never previewed in Evidence.

**Store proof & issue receipt** retains the bytes and creates an immutable receipt. The receipt records the source, period, actor, storage time, byte size and SHA-256 fingerprint. Every download checks the stored bytes against that fingerprint.

To replace proof, select the old receipt under **Supersede a receipt (explicit replacement)** when adding the new file. Otherwise leave **Keep all existing receipts current** selected. Replacing proof retains the original receipt and file. Open **Receipt history** to read either receipt and download its retained bytes.

## Review a date

Choose a date under **Review a date**, then **Show period**. Each control reports its selected period in UTC and a proof state:

- **covered**: retained current native proof covers the selected period, outside the due-soon window.
- **due soon**: current proof covers the period, and its cadence is nearing the next deadline.
- **overdue**: proof history exists, but covering proof is absent after the deadline or the latest proof has expired for today.
- **missing**: no proof has been recorded, or none applies before an overdue condition.
- **superseded-only**: only replaced proof applies.
- **unavailable bytes**: a recorded file is missing or no longer matches its fingerprint.

These states describe recorded proof. Imported records are supplied history and never establish current coverage. A fingerprint proves byte identity, not the truth of the file or whether a control operated.

## Share a review folder

Open **Review folders** and fill in **Create a review folder**. Give the reviewer a label, select controls, set inclusive UTC covered dates and choose a future expiry. Select **Create folder**.

Copy the **Reviewer link** immediately: it is shown only once. Open **Open reviewer folder** to inspect the result before sharing it. A reviewer needs no account. Treat the link as private access to the selected evidence.

A folder shares every matching receipt in scope, including superseded history. It is a live view of the selected controls and period: later in-scope receipts may appear, and file availability may change. Choose the scope carefully.

## Close a folder and read its access log

In **Current review folders**, select **Close folder** to revoke future access. The link also stops working after expiry. Closing a folder cannot recall files someone already downloaded.

Select **View log** for one folder, or **View all access events** for the complete owner-only history. Allowed and refused views and downloads are recorded. Reviewers cannot read this log.

## Let an agent prepare a folder

In **Agent preparation**, give the agent a labelled, expiring **prepare-only** credential and pass it privately. An agent may inspect metadata and gaps and propose a folder. It cannot approve, share or create a reviewer link.

Review the exact proposal in your owner session. **Approve exact proposal and create folder** issues the folder and shows its link once; **Reject proposal** records a final rejection. If evidence or gaps changed after preparation, prepare a new proposal for review. See [Agent folder preparation](AGENT-COMMANDS.md) for the command interface.

Use [Move in from Drata](MOVE-IN.md) for existing evidence, and [Backup and restore](BACKUP-RESTORE.md) to keep the whole archive.

## Audit

**Audit** lists every recorded owner, API-token, system, reviewer-folder and agent-approval action, newest first, with actor, subject and outcome (succeeded, refused, failed or uncertain). Entries are append-only. Filter by UTC dates (both inclusive), an action prefix such as `import.` and an outcome, then **Export CSV** or **Export JSON**; each export is recorded as `audit.exported`. Move-in uploads, mapping, commits, resumes and undo are recorded with their outcome, including refusals. Every stored proof file and every replacement is recorded with its receipt and the receipt it supersedes.
