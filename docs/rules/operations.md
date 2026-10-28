# Scheduler and recovery rules

These are the exact rules, bounds and formats behind OPS-001 in [CONTRACT.md](../../CONTRACT.md). The contract holds the requirement and its acceptance; this page holds the mechanism they rely on, as recorded when the contract was rewritten to the RER contract standard on 28 October 2026.

Cron has one 60-second elapsed budget; pending claims reconcile at the inclusive 15-minute lease boundary. Cancellation and expiry fence later D1 writes and cancel provider requests; effects already submitted to a provider or R2 may remain unknown and require inspection, never a fabricated success. Operational history is archived; running attempts restore as Unknown without replay. An external backup copy is labeled unverified until separately checked.

Status note: Every current scheduled step has bounded execution, cancellable provider calls, atomic D1 claim fencing and durable outcomes. Named public-door journeys prove health/limits/backup/last collection, independent process death during collection and notification, storage interruptions, operational-history restore, retained migrations, explicit size refusal and USD disclosure. External backup copies and effects already accepted outside D1 remain honestly unverified/unknown.
