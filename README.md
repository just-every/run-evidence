# Evidence

Evidence is an MIT audit-evidence desk for one business: write controls, keep proof on cadence, see honest gaps, share an expiring auditor folder, and take your archive with you. A fingerprint proves unchanged bytes; it does not certify a business or prove a control operated.

## Run

Install Node.js 22 or newer and Git, then run one line. It installs the shared command, clones Evidence and starts it:

```sh
npx -y @runeditrun/rer dev just-every/run-evidence
```

To start it again later, run `cd run-evidence && rer dev`.

`rer dev` installs the pinned dependencies, selects Node 22.20.0, applies the D1 migrations, prepares a local owner and starts the app. Open its private `RER_OPEN` link on this computer, then confirm first-run setup. The installed `/` is the Lobby; the desk is `/app`. The printed `RER_SITE` address opens the run site and on-site guides. Keep that link private. Local sign-in uses the private owner link and sends no email; no Cloudflare or model account is needed. To use your own mailbox locally, run `rer setup --owner-email you@example.com` before the first launch. Stop with `rer dev --stop`.

## Run site and guides

`rer build --site` builds the marketing homepage, `/run`, and `/docs` from this README and `docs/*.md`. The site is independent of your private installation and contains no business records. `rer dev` prints its local `RER_SITE` address. The main “Run Evidence” action opens the installation instructions at `/run`.

The [getting started guide](docs/GETTING-STARTED.md) introduces the owner journey; the other on-site guides cover controls and proof, review folders, moving in, archive backup and restore, and agent preparation. The public run site is at https://run-evidence.com and deploys automatically from `main` through GitHub Actions.

## Use the desk

1. **Controls and proof.** Add a control in plain words, select a group, name the proof and pick its cadence. Open “Upload proof & view history,” choose a nonempty file up to 10 MiB, state its source and inclusive UTC covered dates, then store it. Open the receipt and download the retained bytes. An explicit replacement retains the old receipt and file.
2. **Gaps.** Select a date on the proof desk. Each requirement shows covered, due soon, overdue, missing, superseded-only or unavailable bytes. These states describe recorded proof, not compliance. Imported artifacts are supplied history and do not establish current coverage.
3. **Auditor folder.** Open Review folders, select controls, covered dates and a future expiry. Copy the one-time link and open it in a separate private browser. Every matching receipt, including superseded history, is shared. Inspect before sharing. Close the folder to revoke future access; downloaded files cannot be recalled. Access history stays owner-only.
4. **Archive.** Open Yours, export the archive and retain it privately. In a separate empty installation, upload it for a dry run, then confirm restore. Records and available exhibit bytes return, including original actor attribution. Restored folders stay closed and credentials are excluded. Missing bytes are explicitly reported.
5. **Agent preparation.** Open Agent preparation, grant a prepare-only token, and give it to your agent privately. The [commands](docs/AGENT-COMMANDS.md) read the desk and propose an audit folder. Review the exact proposal in the app and approve or reject it. Only the owner session can issue the folder; decisions are recorded.
6. **Move in from Drata.** Open Move in, select an audit-evidence ZIP with its HTML manifest, and review the dry run and control mappings. Approve admission only after reviewing counts, missing files and digests. The batch journal records changes. Undo removes active import links while preserving original files, receipts and later decisions. [Supported shape and limits](docs/DRATA-IMPORT.md) distinguish documented-shape fixtures from a verified customer export.

For a second, empty installation, clone into a separate directory and run `rer dev` there. It selects a free port and has separate local state. Never reset your only copy to test restore.

The local archive CLI works with dev stopped:

```sh
node scripts/archive.mjs export --output exports/evidence.evidence
node scripts/archive.mjs restore --input exports/evidence.evidence --dry-run
node scripts/archive.mjs restore --input exports/evidence.evidence --yes
```

Restore requires an empty Evidence database and exhibit bucket. Destination authentication may already exist. Metadata is limited to 8 MiB and 20,000 rows; each exhibit to 10 MiB. HTTP restore stages up to 64 MiB of files; CLI restore has no aggregate file limit. Base's generic `rer export` is separate from this complete evidence archive.

## Deploy

Use your own Cloudflare account with Workers, D1 and R2 enabled. Create a scoped API token that can manage these resources and their migrations. Configure an email delivery provider for hosted sign-in. This release declares Resend: set `MAIL_FROM` in `deploy.json` to an address on your verified sender domain, then commit that change. Do not commit secrets or local state.

Create a private mode-0600 file outside the checkout with `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `OWNER_EMAIL` and `MAIL_API_KEY`. Use a real owner mailbox for hosted sign-in. RER can generate the session and first-owner setup secrets; it retires the setup token after claiming the owner.

```sh
rer dev --stop
rer deploy --dry-run
rer deploy --environment production --env-file /absolute/path/to/private-deploy.env
```

The dry run builds and validates without provider requests. The real command provisions D1 and R2, applies migrations, deploys the Worker and claims the first owner. Open the printed application address, sign in through the delivered email link and finish setup. Reuse the same environment and private deployment state for subsequent deployments. Builds and deployment do not run tests. This repository's validation uses local Cloudflare runtimes; live provider delivery is outside this first release's test boundary.

## Develop

```sh
rer build
pnpm typecheck
node tests/evidence.mjs
rer verify
```

Run touched test files during development; GitHub Verify runs all public-door checks. `tests/import.mjs` and `tests/agent.mjs` cover the new trust boundaries. Browser journeys use Chromium (`pnpm exec playwright install chromium`) at 1440 and 390. The integration checks use real local D1/R2, native sessions and the production HTTP handler. [ACCEPTANCE.md](ACCEPTANCE.md) is the first-release scope; [CONTRACT.md](CONTRACT.md) describes receipt and review semantics.

Local data is in `.wrangler/state`; credentials and runtime state are ignored. Research and acceptance screenshots are kept outside this public repository. No policy templates, framework mappings, certification, live collectors or payment features are included.

The product carries forward private Evidence revision `a65a3cbd193f35b9ab8a8a639fea430aeb6b110d`. Current Base runtime and import-kit source start at `4a7833932a723c203191e84f1de905d84e4cbf1c`; `base-copies.json` records exact copies, and historical migrations retain their original pins.

See [DEMO.md](DEMO.md) for local and hosted throwaway demos.
