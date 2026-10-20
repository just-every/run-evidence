import { page, escape } from '../view'
import { slab, stateChip } from '../ui'
import { options, table } from '../program/view'
import { when } from '../format'
import { outcomes, type AuditEntry, type AuditFilter } from './storage'

const query = (f: AuditFilter) => new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString()
export function auditPage(rows: AuditEntry[], filter: AuditFilter, owner: string) {
 const shown = rows.slice(0, 500), q = query(filter)
 const form = `<form method="get" action="/app/audit" class="filter-row"><div class="dates"><label>From (UTC)<input type="date" name="from" value="${escape(filter.from)}"></label><label>To (UTC, inclusive)<input type="date" name="to" value="${escape(filter.to)}"></label></div><label>Action starts with<input name="action" maxlength="100" value="${escape(filter.action)}" placeholder="program."></label><label>Outcome<select name="outcome" aria-label="Outcome"><option value="">Any outcome</option>${options([...outcomes], filter.outcome)}</select></label><button>Filter audit</button></form>`
 const body = slab(`<section aria-labelledby="audit-title"><h2 id="audit-title">Audit</h2><p class="panel-intro">Every recorded owner, token, system, reviewer and agent-approval action with its outcome. Entries are append-only; refused, failed and uncertain outcomes stay as recorded. Exports are recorded here too.</p>${form}<p class="actions-row"><a class="button button-secondary" href="/app/audit/export.csv${q ? '?' + q : ''}">Export CSV</a> <a class="button button-secondary" href="/api/audit/export${q ? '?' + q : ''}">Export JSON</a></p><p>${rows.length} ${rows.length === 1 ? 'entry' : 'entries'}${rows.length > shown.length ? `; the newest ${shown.length} are shown and the export holds all` : ''}.</p>${table(['When', 'Actor', 'Action', 'Subject', 'Outcome', 'Detail'], shown.map(r => [when(r.at), `${escape(r.actor_name)}<br><small>${escape(r.actor_kind)}</small>`, `<code>${escape(r.action)}</code>`, escape(r.subject), stateChip(r.outcome), escape(r.detail)]), 'Audit entries')}</section>`)
 return page('Audit', body, 200, { owner, active: 'audit' })
}
