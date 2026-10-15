# Getting started

Evidence keeps audit evidence for one business. You write the controls, add proof and share selected records through an expiring review folder. A stored fingerprint proves unchanged bytes; it does not prove that a control operated or certify your business.

## Run Evidence on your computer

Install Node.js 22 or newer, Git and pnpm 10.12.4. These commands work on macOS, Linux or Windows with WSL2.

Install the shared Run Edit Run command once:

```sh
curl -fsSL https://runeditrun.com/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"
```

Or install it with npm:

```sh
npm install -g @runeditrun/rer
```

Get Evidence and start it:

```sh
git clone https://github.com/just-every/run-evidence.git
cd run-evidence
rer dev
```

`rer dev` installs the pinned dependencies, selects the required Node version, applies local migrations, prepares a local owner and starts the app. Open the private `RER_OPEN` link it prints on this computer. Keep this link private: it signs you in as the local owner.

## Confirm your installation

On **Finish setup**, review the owner name and email. Select **I confirm this owner account is ready to use.**, then **Finish setup**. The **Proof desk** is the main workspace.

No external email is sent during local development. Email sign-in uses the local development outbox. No provider account is needed to run locally. To use your own mailbox as the local owner, run this before the first launch:

```sh
rer setup --owner-email you@example.com
```

## Keep your first proof

1. On the Proof desk, use **Add a control**. Write what you do in plain words, choose a group, name the proof you want to keep and choose its cadence.
2. Open **Upload proof & view history** on that control.
3. Choose a nonempty file up to 10 MiB. State where it came from and its inclusive **Covered from (UTC)** and **Covered through (UTC)** dates.
4. Select **Store proof & issue receipt**. Open the receipt to inspect its SHA-256 fingerprint, attribution and covered period. Use **Download retained file** to retrieve the stored bytes.

Your installation starts empty. The examples on the public site are illustrations; Evidence does not seed business records for you.

## Stop and return

Stop the managed development server when you are done:

```sh
rer dev --stop
```

Run `rer dev` from the same checkout to return. A compatible repeat invocation reuses the running app and prints its addresses. Your local data stays in `.wrangler/state`; do not delete this directory to restart the app.

Next, read [Controls, proof and review folders](MAIN-FLOWS.md). Before moving or replacing an installation, read [Backup and restore](BACKUP-RESTORE.md).
