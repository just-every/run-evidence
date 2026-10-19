import { escape } from '../view'
import { slab, stateChip } from '../ui'
import { table } from './view'
import type { BoardReport } from './board'
// Historical values are printed from the stored projection; links open retained
// immutable receipts and the versioned histories, never recompute the snapshot.
export function denominatorView(r: BoardReport) {
 const reqs = r.filtered_requirements
 return slab(`<section id="requirements" aria-labelledby="denominator-title"><h2 id="denominator-title">Requirement denominator</h2><p>${r.snapshot_day ? `Snapshot ${escape(r.snapshot_day)}. ` : ''}${reqs.length} displayed of ${r.requirements.length} requirements. Exclusions remain visible. Filters never change the program score.</p>${table(['Reference','Requirement','State','Proof','Testing','Policies','Sources'], reqs.map(q => [escape(q.ref), escape(q.title), stateChip(q.state === 'excluded' ? 'excluded' : q.ready ? 'ready' : 'not ready') + (q.rationale ? `<br>${escape(q.rationale)}` : ''), stateChip(q.proof), stateChip(q.testing), escape(q.policy) + (q.policies_missing.length ? `<br>${escape(q.policies_missing.join(', '))}` : ''), q.controls.map(c => `<a href="/app/controls/${c.id}">${escape(c.library_id ?? c.name)}</a>${c.owner_name ? `<br>Owner: ${escape(c.owner_name)}` : ''}${c.scope.length ? `<br>Scope: ${escape(c.scope.join(', '))}` : ''}${c.evidence.map(e => `<br><a href="/app/requirements/${e.id}">${escape(e.name)}</a>: ${escape(e.gap)}${e.receipt_ids.map(id => ` <a href="/app/receipts/${id}">receipt</a>`).join('')}`).join('')}${c.test_ids.map(id => `<br><a href="/app/tests/${id}">Test history</a>`).join('')}`).join('<hr>') || 'Unmapped']), 'Requirement denominator')}</section>`)
}
