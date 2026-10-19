# Reviewed private Git collector

From Connections choose **Install a reviewed private Git collector**. Review
`scripts/private-collector.mjs` and `scripts/private-collector/git.mjs`, the fields
shown on the registration page, and the read permissions. Register a label and
copy the one-time receiving token into your private service environment as
`EVIDENCE_COLLECTOR_TOKEN`. Keep the label the same in the installation command.
No repository path or Git credential is stored in Evidence.

On the computer with read access to your private repository, clone the public
Evidence source, or copy the CLI and its adjacent `private-collector` directory.
Node 22+ and Git are the only dependencies. Run the command shown by your
connection, replacing the local path. Use absolute paths when running from cron;
run at least hourly even with the browser closed. `--help` documents the exact
command. HTTPS is required except on loopback. Redirects are refused.

The fixed collector reads only local Git metadata: repository label, local branch
count, distinct branch-head count, HEAD commit ID/time and bare state. It never
fetches, writes, runs hooks, reads file contents, or sends authors, remote URLs,
paths or credentials. An empty repository can report null HEAD/time. Git's
optional locks, fsmonitor and lazy fetching are disabled. Missing/unreadable
repositories send a failed report without resource data, and the CLI exits
nonzero. A transport failure exits nonzero and never claims acceptance.

The registered connection is the source identity. `private-git/v1` reports enter
through `POST /collectors/{connection}/observations` with this connection's
Bearer token, separately from the source-reported `/v1/resources` API. Only the
reviewed fields are admitted; changing the profile requires owner review and
registration. Reads must have an ISO timestamp within the last hour, with up to
five minutes of clock skew. Repeated or older read timestamps are refused.
Successful source reads retain source time, server receiving time, profile
revision and coverage. A source failure retains the resource and earlier
observations, clears its usable source timestamp, and re-tests it as unknown.

Define tests over `private.git.repository` in Tests. Hosted branch protection,
review/check policies, repository privacy, membership/MFA and dependency/secret
alerts are unsupported by local Git. A criterion over one of these absent
attributes is unknown, never passing. Attach manual evidence to the relevant
control's requirement, or connect the actual hosting provider. Local metadata is
not a hosted policy verification.

Tests use the existing observation cadence: a source read older than 1.5 times
the test cadence plus one hour becomes unknown (2½ hours for hourly tests).
Missing collection does not remove the repository or refresh a previous pass.
Collection history distinguishes failure, successful recovery and missing reads.

The receiving credential is stored as SHA-256 only and is never recoverable
from lists, history or exports. Rotate to invalidate a lost token immediately;
revoke to end collection. The token can only report its connection, never read
Evidence, approve, publish or mutate Git. Provider credentials for native
connectors continue to use installation-local encrypted custody. Archives carry
private connection history and observations, but omit receiving fingerprints and
restore the connection inactive. The owner must issue a fresh token before the
installed collector can report again. No third-party collector or model receives
these records; data stays in this installation and its private custody archives.
The collector costs USD $0 from Evidence; local execution and hosting are yours.
