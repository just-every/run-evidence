# Trust updates and notices

The owner opens `/app/trust` to draft category updates, approve publication and notification, add subscribers with a recorded reason, and prepare dated subprocessor changes. Settings holds the public switch, explicit visitor-confirmation authorization, business postal address, notice period and provider webhook configuration. The public center starts disabled. The homepage is unchanged.

Visitors use `/trust` to request categories and then explicitly confirm the emailed link. Confirmation GETs do not activate consent. Every message includes the postal address and a one-click unsubscribe. An owner cannot override withdrawal; a new visitor double opt-in is required. Subscriber and consent history exports are available at `/api/trust/subscribers/export`.

Subprocessor approval publishes and queues the approved notice. Pending changes show their effective UTC date and become active only on that date. The notice period is rechecked at approval. Update publication cannot send a notification the owner did not approve. `/api/trust/updates/{id}/export` retains the exact draft, approver, publication and send times, notice fields and per-recipient delivery evidence.

Mail uses the existing FOLLOWUP-001 Resend or SendGrid sender. Provider acceptance remains pending until a verified delivery event arrives. Resend Svix and SendGrid signatures protect the respective delivery-event doors under `/trust/mail/events/`. Repeated events are idempotent, conflicting identities are refused, and ambiguous sends are uncertain without automatic resend. The scheduler drains owner-approved queued notices; it never prepares or approves a notice.

Adopted conservative customer-access default, pending ct approval: customer updates require an explicit owner grant with reason and expiry. A private capability link is issued once; expiry or revocation ends access. No CRM or inferred customer match grants access. TRUST-001 and TRUST-002 inherit their remaining document, NDA, custom-domain and CRM obligations.

Portable custody includes consent, drafts, approvals, notices and delivery evidence. Webhook verification material and bearer credentials remain installation-local. Restored customer grants are revoked, mail and publication remain inactive until reauthorization, and no queued send replays automatically.

Public-door proof: `tests/trust.mjs`, journey `trustJourney` in `tests/helpers/trust-journey.mjs`; the same journey runs with browser proof from `tests/engagement-browser.mjs` at 1440 and 390. Only the external mail network edge is simulated. No live-provider receipt is claimed or required by TRUST-003.
