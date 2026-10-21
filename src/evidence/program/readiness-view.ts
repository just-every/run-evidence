import { escape } from '../view'
import { table } from './view'
import type { ChecklistArea } from './checklist'
import type { readiness } from './readiness'
type Totals = Awaited<ReturnType<typeof readiness>>['totals']
export function readinessSummary(t: Totals, base: string) {
 return `<p class="panel-intro"><strong>${t.readiness_percent == null ? 'Readiness unavailable' : `${t.readiness_percent}% ready`}</strong><br><a href="${base}?show=ready#requirements">${t.ready} of ${t.included} requirements ready</a> · <a href="${base}?show=not-ready#requirements">${t.not_ready} not ready</a></p>${t.vendor_cuecs_open ? `<p><a href="/app/vendors/obligations">${t.vendor_cuecs_open} open vendor CUEC obligations</a> · installation-wide; excluded from the framework percentage</p>` : ''}`
}
export function checklistTable(areas: ChecklistArea[], base: string, heading = true) {
 return `${heading ? '<h3>Checklist</h3>' : ''}<p>Counts are mapped requirement checks, except Questionnaires, which counts program questionnaire records. Unavailable workflows have no recorded completion.</p>${table(['Area','Ready requirements','Denominator'], areas.map(a => [escape(a.area)+(a.records?.length?'<ul>'+a.records.map(r=>`<li><a href="${escape(r.href)}">${escape(r.label)}</a> · ${escape(r.state)}</li>`).join('')+'</ul>':''), a.available ? `<a href="${base ? base + '?show=' + encodeURIComponent('area:' + a.area) : ''}#requirements">${a.ready} of ${a.total}</a>` : 'Unavailable · 0 recorded, never complete', a.available ? String(a.total) : 'not available']), 'Checklist')}`
}
