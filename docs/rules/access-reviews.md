# Access-review rules

These are the exact rules, bounds and formats behind ACCESS-001 in [CONTRACT.md](../../CONTRACT.md). The contract holds the requirement and its acceptance; this page holds the mechanism they rely on, as recorded when the contract was rewritten to the RER contract standard on 28 October 2026.

- **Owner-configured cadence.** An owner-configured campaign either runs once over owner-chosen dates (one-off) or repeats every N whole calendar months, N from 1 to 24. When a recurring campaign's period has ended (the UTC date is after its last day), the next one starts with the same sources and resource owners: its start and decision due date move N months (day of month kept, clamped to the month's last day) and its period ends the day before the month-shifted day after the previous end (30 September plus three months ends 31 December).

- **Revocation evidence.** A connected directory account is verified revoked only by a source read after the request that shows it removed or not active. An uploaded-list account is verified by a newer upload of that app's list without the account (or with it inactive), or by an exhibit the owner attaches; the exhibit is kept as an immutable, digested receipt (PROOF-001) on the adopted access-review control's requirement (AC-04) covering the campaign period, and the revocation names that receipt. A decision alone, a still-listed account or an exhibit on a directory account never closes a revocation. Until AUTH-001 adds roles, the owner acts for the access-review administrator: starts campaigns, excludes, delegates and attaches exhibits.

- **People reconciliation.** Each frozen account shows the person it is matched to (from the population or identity match, proposed or approved, never a rejected one) and that person's recorded departure; an account with no match says so.

Status note: Current directory and uploaded-list sources, owner-configured cadence, People reconciliation and exhibit-evidenced revocation asserted; APPS-001 carries app-level connector populations before it ships.
