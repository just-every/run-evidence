# Key custody, restricted records and declared flows

This page documents SECURE-001: how Evidence seals credentials, how keys rotate and
what happens when a key is lost, how a record stays private, and how a model provider
becomes reachable.

## Credentials and keys

Every stored credential (connection tokens, tracker and webhook secrets, follow-up
channel secrets, trust mail secrets and model provider keys) is AES-256-GCM
ciphertext. The name of the key that sealed it is written beside the ciphertext, and
the exact owning record is bound in as additional data, so a ciphertext copied to
another record does not open.

- The key named `session` is derived from `SESSION_SECRET`. It is the key every
  earlier installation already uses.
- `CUSTODY_KEYS` is a JSON object of further named keys. Each name is lowercase
  letters, digits and hyphens, and each secret is at least 32 characters. Keep them as
  Worker secrets, never in source.
- `CUSTODY_CURRENT` names the key new credentials are sealed under. It defaults to
  `session`.

## Rotation

1. Add the new key to `CUSTODY_KEYS` and set `CUSTODY_CURRENT` to its name. Deploy. The
   old key stays present, so every credential still opens.
2. In Connections, open Declared outbound flows and key custody and choose Re-seal
   credentials. Each credential is opened with its old key and sealed again under the
   current one, fenced on its exact old ciphertext. The result lists how many were
   re-sealed and which could not be opened.
3. When the page shows nothing sealed under the old key, remove the old key.
   `CUSTODY_SESSION_KEY_RETIRED` set to `yes` retires the session-derived key.

Rotating a provider key is separate: the owner supplies the new key for the flow, it is
sealed under the current custody key, and the old one is discarded.

## Loss and recovery

A credential whose sealing key is absent cannot be opened, and nothing falls back to
another key. Every user of such a credential fails explicitly with a custody message
and sends nothing: a model call reports that key custody is unavailable, a connection
reports its credential as unavailable and asks to be reconnected. The custody page
lists the key names that sealed credentials still need. Recovery is either restoring
that key to `CUSTODY_KEYS`, which makes every credential open again with no data
change, or supplying a new credential for each affected record, which seals it under
the current key. There is no master key and no backdoor: an unrecoverable credential is
replaced, never guessed.

Exhibit files and archives rely on the storage provider's encryption at rest. Archives
never contain credentials, grants, publications or flow declarations; a restored
installation reconnects and re-declares them.

## Restricted records

A receipt marked sensitive, at upload or later by the owner, is private. The owner
reads it. A delegated role reads it only with a need-to-know grant naming that person,
and the uploader of a sensitive record holds the first grant. A reviewer folder or an
auditor engagement never receives it until the owner publishes it with a reason, and
withdrawing the publication removes it again on the next request. Every read, refusal
and decision is audited, and each refusal is also a suspected disclosure listed beside
the declared flows. Personnel records, findings and connector data are restricted
areas: a delegated role reaches them only through an area grant the owner issues.

## Declared outbound flows

A model provider is reachable only through a flow declared in Connections. The
declaration states the provider, model, purpose, the exact data classes sent,
retention, region and account, and carries the provider key. A flow is off until the
owner reviews its exact declaration, and its fingerprint must match what was read. Each
call is checked against the declaration, so a data class that was not declared, a
payload over the minimum-necessary bound, or a payload that carries a credential is
refused before anything leaves. A call is recorded by the digest and size of its
payload, never its content. Model output is a proposal only: it never grants authority,
assigns work or approves anything.
