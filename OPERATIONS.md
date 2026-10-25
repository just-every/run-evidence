# Operations

`rer dev` installs locked dependencies, prepares local D1/R2 and starts the app. `rer dev --stop` stops this checkout. `rer build` builds without tests; `rer verify` builds, typechecks and runs the public-door integration and browser journeys. CI runs one Verify per main commit.

Before configuring a paid provider or running deployment, review
[provider costs in USD](docs/PROVIDER-COSTS.md). Cloudflare hosts in your account;
mail is billed by the selected mail provider. Free allowances are shared with
other applications in that account. Record your intended usage in the provider
calculator and review its USD estimate before enabling credentials. Local
operation and the development outbox carry USD 0 in provider charges.

`rer deploy --dry-run` validates the Worker, D1 migrations, exhibit R2 binding and deployment declaration without provider calls. See README.md for the actual `rer deploy` inputs. Project and deployed resource identities remain unchanged from Evidence.

Use the Evidence archive UI or `node scripts/archive.mjs` for complete custody transfer. Base's generic export/import is not the domain archive. Local state, setup values, grants, API tokens and exports are private. Export before destructive `rer reset --yes`; reset removes the local installation. Imported receipts are retained when a batch is undone. Review links close on restore; agent credentials are excluded.

After intentional source changes: stage files, run `node scripts/generate-edition.mjs`, then `node scripts/edition-authoring/cli.mjs lock` and `check`. Commit the recipe, lock and retained origins. Do not edit lock hashes by hand. Publication scans run on the exact committed tree before push.

Hosted packaging uses the seed-owned `packaging.json`. Run `pnpm run build`, then `pnpm delivery:spec` to generate the committed deployment specification. `pnpm check:deployment-spec` refuses a stale projection after a real build. Package with `node scripts/delivery/base/cli.mjs package --config packaging.json --output rer-package`; generated packages and delivery artifacts are ignored. The Managed workflow is dispatch only and uses the pinned trusted delivery workflow. Hosted setup declares the selected mail provider and sender as public inputs and the provider credential as a required private input. RER managed mail additionally uses its assigned relay URL. See README.md for direct deployment inputs.
