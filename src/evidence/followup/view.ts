import { escape } from '../view'
import { slab, stateChip } from '../ui'
import { table } from '../program/view'
// The obligation page's follow-up panel: pause or resume reminders, and every
// delivery with its channel and outcome. Pausing stops later sends; history stays.
export function followupPanel(subject: string, paused: { reason: string; paused_by: string; paused_at: string } | null, deliveries: { kind: string; recipient: string; channel: string; state: string; detail: string; created_at: string }[]) {
 const control = paused
  ? `<p>${stateChip('paused')} Paused by ${escape(paused.paused_by)} at ${escape(paused.paused_at)}: ${escape(paused.reason)}</p><form method="post" action="/app/remediation/${subject}/followups/resume"><button class="button-secondary">Resume follow-ups</button></form>`
  : `<form method="post" action="/app/remediation/${subject}/followups/pause"><label>Pause follow-ups (reason)<input name="reason" required maxlength="500"></label><button class="button-secondary">Pause follow-ups</button></form>`
 return slab(`<section aria-labelledby="followups-title"><h2 id="followups-title">Follow-ups</h2><p class="panel-intro">Reminders follow the <a href="/app/followups">business calendar and channels</a>. A delivered reminder is not proof that anyone acted.</p>${control}${table(['Sent', 'Kind', 'To', 'Channel', 'Outcome', 'Detail'], deliveries.map(d => [escape(d.created_at), escape(d.kind), escape(d.recipient), escape(d.channel), stateChip(d.state), escape(d.detail)]), 'Follow-up deliveries')}</section>`)
}
