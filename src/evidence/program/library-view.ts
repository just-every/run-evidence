import { page, escape } from '../view'
import { slab } from '../ui'
import { usDateTime } from '../format'
import { facts, table } from './view'
import type { libraryReview } from './library'
// LIBRARY-001: the accepted library revision, each newer shipped revision as a
// reviewable change set, and every acceptance with its actor and reason.
export function libraryPage(review: Awaited<ReturnType<typeof libraryReview>>, owner: string) {
 const summary = slab(`<section aria-labelledby="library-title"><h2 id="library-title">Control library</h2><p class="panel-intro">Program mappings follow the accepted revision. A newer shipped revision changes nothing until you accept it, and every test run keeps the library revision it was evaluated under.</p>${facts([['Accepted revision', String(review.accepted)], ['Latest shipped revision', String(review.latest)]])}</section>`)
 const pending = review.pending.map(r => slab(`<section aria-labelledby="revision-${r.revision}"><h2 id="revision-${r.revision}">Revision ${r.revision} · waiting for review</h2><p class="panel-intro">${escape(r.summary)} Shipped ${escape(r.shipped)}.</p>${r.saqChanges?.length ? table(['SAQ', 'Earlier revision', 'New revision', 'Removed requirement ids'], r.saqChanges.map(c => [escape(c.type), escape(c.from), escape(c.to), escape(c.removed.join(', '))]), 'SAQ revision changes') : ''}${table(['Control', 'Change', 'Requirement', 'Programs affected'], r.changes.map(x => [escape(`${x.control} · ${x.control_title}`), escape(x.change === 'added' ? 'Mapping added' : 'Mapping removed'), escape(`${x.framework_name} ${x.ref} · ${x.requirement}`), x.programs.length ? x.programs.map(p => `<a href="/app/programs/${p.id}">${escape(p.name)}</a>`).join(', ') : 'None on this installation']), `Revision ${r.revision} changes`)}<form method="post" action="/app/library/revisions/${r.revision}"><label>Reason<input name="reason" maxlength="1000" required placeholder="Reviewed with our assessor"></label><button>Accept revision ${r.revision}</button></form></section>`)).join('')
 const history = slab(`<section aria-labelledby="library-history"><h2 id="library-history">Accepted revisions</h2>${table(['Revision', 'From', 'By', 'Reason', 'At'], review.history.map(h => [String(h.revision), String(h.from_revision), escape(h.actor_name), escape(h.reason), escape(usDateTime(h.at))]), 'Accepted library revisions')}</section>`)
 return page('Control library', summary + pending + history, 200, { owner, active: 'programs' })
}
