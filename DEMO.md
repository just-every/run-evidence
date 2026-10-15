# Evidence Demo

After `rer setup`, run `rer demo` and open its private `RER_OPEN` link. It opens
signed in as the owner with first-run setup complete. Stop with `rer demo --stop`.
The title and product label say **Evidence Demo**, with no injected bar or outbox.
Each run uses fresh `.rer/demo/` data, removed on stop; `.wrangler/state` is retained.

`src/demo.ts` loads 15 controls across Access, Data, Change, People and Vendors,
27 immutable receipts and downloadable sample exhibits, three review folders
(open, closed and expired), access history and two prepare-only agent grants.
Dates follow the current day. Covered, due soon, overdue and missing proof are
normal audit-workspace states. All retained sample exhibit bytes are available.
The Northstar Studio records are explicitly illustrative, manually asserted
sample evidence; they do not assert that any real business operated a control.
The hook never fetches and uses fixed IDs with conflict-safe inserts.

All vendored Base modules and the CLI use the same published RER release.
Base's signed owner claim signs hosted visitors in through `/auth/owner-claim`;
this optional handler is enabled only when trusted claim keys are configured.
No demo-specific authentication route exists.

Evidence has no public URL checker, model call, collector or third-party account
integration. Its external effect is authentication/invitation mail. Demo mail
validates and returns successful development delivery without contacting a
provider or retaining a message. Public browser documentation links remain real.
Review-folder creation, receipt storage and downloads are real local operations;
the demo host gates access to that visitor's private container.

The `Run demo` workflow reads the `run-demo` environment and deploys manually.
Dispatch `test_only=true` for `demo.test.run-evidence.com` with Cloudflare's
published passing Turnstile keys; dispatch again with `remove=true` to delete
that host and read back its removal. Production dispatch uses the environment's
real Turnstile keys at `demo.run-evidence.com`. No repository variable is needed.
Each visitor has an isolated container, ending after 60 minutes or 15 idle minutes.
`deploy-demo.json` carries only plain container settings, never credentials.
