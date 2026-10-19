import { page, escape } from '../view'
import { slab } from '../ui'
import { table } from '../program/view'
import { riskLibrary, riskLibraryRevision } from './library'
export function libraryPage(adopted: Record<string, string | number | null>[], owner: string) {
 const history = table(['Risk', 'Scenario', 'Recorded library revision'], adopted.map(r => [`<a href="/app/risks/${r.id}">${escape(r.title)}</a>`, escape(r.library_id), escape(r.library_revision ?? 'legacy, not recorded')]), 'Added library risks')
 const scenarios = riskLibrary.map(r => `<details><summary>${escape(r.title)} · ${escape(r.area)}</summary><p>Threat: ${escape(r.threat)}. Vulnerability: ${escape(r.vulnerability)}.</p><p>Assets: ${escape(r.assets.join(', '))}. Suggested likelihood ${r.likelihood}, impact ${r.impact} (1–5), treatment ${r.treatment}. Controls: ${escape(r.controls.join(', '))}.</p><form method="post" action="/app/risks/library"><input type="hidden" name="scenario" value="${r.id}"><input type="hidden" name="revision" value="${riskLibraryRevision}"><button>Add this scenario</button></form></details>`).join('')
 return page('Risk library', slab(`<section><h2>Review revision ${riskLibraryRevision}</h2><p>New risks copy the selected revision. Library updates never change existing risks or their assessments. Review the new scenarios here before adding them; prior additions retain their recorded revision below.</p>${scenarios}</section>`) + slab(`<section><h2>Prior additions</h2>${history}</section>`), 200, { owner, active: 'risks' })
}
