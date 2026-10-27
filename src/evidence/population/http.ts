import { auditFormRefusal, retainedMultipart, scalarValues, type RefusedForm } from '../form-state'
import type { OwnerContext } from '../door'
import { page, escape } from '../view'
import { slab, stateChip } from '../ui'
import { done, json, ownerRoutes, readInput, uuid, type Route } from '../door'
import { facts, options, personOptions, table } from '../program/view'
import { people } from '../program/people'
import { Refusal } from '../upload'
import { admit, columnTemplates, decide, differences, plan, readUpload, rows, uploads, type Kind } from './storage'
const id = `(${uuid})`
const both = (path: string) => new RegExp(`^/(?:app|api)${path}$`)
const kinds = Object.keys(columnTemplates) as Kind[]
const manual = (at: string) => `${stateChip('manual')} <small>uploaded ${escape(at.slice(0, 16).replace('T', ' '))}</small>`
async function populationsPage(c: OwnerContext, refused?: RefusedForm) {
 const list = await uploads(c.env, c.now)
 if (c.isApi) return json({ templates: columnTemplates, uploads: list })
 const templates = slab(`<section aria-labelledby="templates-title"><h2 id="templates-title">Column templates</h2><p class="panel-intro">For a system with no connector, upload its list. Required columns are named; map any renamed column on upload. Lists are labelled manual everywhere, never count as a source read, and go stale after their as-of date plus the refresh window.</p>${table(['List', 'Required', 'Optional', ''], kinds.map(k => [escape(columnTemplates[k].label), escape(columnTemplates[k].required.join(', ')), escape(columnTemplates[k].optional.join(', ')), `<a href="/app/populations/templates/${k}.csv">Download CSV template</a>`]), 'Templates')}</section>`)
 const value = (key: string, fallback = '') => escape(refused?.values[key] ?? fallback)
 const form = slab(`<section aria-labelledby="upload-title"><h2 id="upload-title">Upload a population</h2>${refused ? `<p role="alert">${escape(refused.error)} Choose the file again after correcting the form.</p>` : ''}<form method="post" action="/app/populations" enctype="multipart/form-data"><label>List<select name="kind" aria-label="List">${options(kinds.map(k => [k, columnTemplates[k].label] as [string, string]),refused?.values.kind)}</select></label><label>Source system<input name="source_system" value="${value('source_system')}" required maxlength="120" placeholder="Justworks"></label><label>True as of<input type="date" name="as_of" value="${value('as_of')}" required></label><label>Refresh window (days)<input name="refresh_days" inputmode="numeric" value="${value('refresh_days', '90')}"></label><label>File (CSV or XLSX)<input type="file" name="file" required accept=".csv,.xlsx"></label><details${refused ? ' open' : ''}><summary>Renamed columns</summary>${[...new Set(kinds.flatMap(k => [...columnTemplates[k].required, ...columnTemplates[k].optional]))].map(f => `<label>Column for ${escape(f)}<input name="map_${f}" value="${value('map_' + f)}" maxlength="120"></label>`).join('')}</details><button>Check every row</button></form></section>`)
 const listed = slab(`<section aria-labelledby="uploads-title"><h2 id="uploads-title">Uploaded populations</h2>${table(['List', 'Source', 'As of', 'Rows', 'Provenance', 'State'], list.map(u => [`<a href="/app/populations/${u.id}">${escape(columnTemplates[u.kind].label)}</a>`, escape(u.source_system), escape(u.as_of), String(u.row_count), manual(u.uploaded_at), stateChip(u.state) + `<br><small>stale after ${escape(u.stale_after)}</small>`]), 'Uploaded populations')}</section>`)
 return page('Populations', `<div class="app-columns">${templates}${form}</div>${listed}`, refused?.status ?? 200, { owner: c.actor.name, active: 'connections' })
}
// Populations: column templates, upload with dry run, matches and differences;
// Inventory: everything known about people, accounts and devices with provenance.
export function populationHandler(clock: () => Date) {
 const routes: Route[] = [
  { method: 'GET', pattern: new RegExp('^/app/populations/templates/(roster|accounts|devices)\\.csv$'), run: async (_c, m) => { const t = columnTemplates[m[1] as Kind]; return new Response([...t.required, ...t.optional].join(',') + '\r\n', { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${m[1]}-template.csv"`, 'cache-control': 'no-store' } }) } },
  { method: 'GET', pattern: both('/populations'), run: async c => populationsPage(c) },
  // Without confirm: a dry run that admits nothing. With confirm and the dry-run fingerprint: admit all rows or none.
  { method: 'POST', pattern: both('/populations'), run: async c => {
   let values: Record<string,string> = {}
   try {
    let request = c.request
    if (!c.isApi) {
     const retained = await retainedMultipart(request, 5 * 1024 * 1024)
     values = scalarValues(retained.form)
     request = retained.request
    }
    const upload = await readUpload(request)
    if (upload.confirm) { const created = await admit(c.env, c.actor, upload, c.now); return done(c, '/app/populations/' + created.id, created, 201) }
    const checked = plan(upload)
    if (c.isApi) return json({ dry_run: true, sha256: upload.sha256, ...checked })
    const refused = checked.rows.filter(r => r.reasons.length)
    return page('Check the population', slab(`<section aria-labelledby="dry-title"><h2 id="dry-title">Dry run: nothing is admitted yet</h2>${facts([['File', escape(upload.filename)], ['Rows', String(checked.total)], ['Valid', String(checked.admit)], ['Refused', String(checked.refuse)], ['Mapping', escape(Object.entries(checked.mapping).filter(([, h]) => h).map(([f, h]) => `${f} ← ${h}`).join('; '))]])}${table(['Row', 'Key', 'Reasons'], refused.map(r => [String(r.row), escape(r.key), escape(r.reasons.join('; '))]), 'Refused rows')}${refused.length ? '<p role="alert">Fix the refused rows and upload again; a list is admitted whole or not at all.</p>' : `<form method="post" action="/app/populations" enctype="multipart/form-data">${Object.entries({ kind: upload.kind, source_system: upload.source, as_of: upload.asOf, refresh_days: String(upload.refresh), sha256: upload.sha256, confirm: 'yes', ...Object.fromEntries(Object.entries(upload.mapping).map(([k, v]) => ['map_' + k, v])) }).map(([k, v]) => `<input type="hidden" name="${escape(k)}" value="${escape(v)}">`).join('')}<label>Same file<input type="file" name="file" required accept=".csv,.xlsx"></label><button>Confirm this population</button></form>`}<p><a href="/app/populations">Back</a></p></section>`), refused.length ? 400 : 200, { owner: c.actor.name, active: 'connections' })
   } catch (error) {
    if (c.isApi || !(error instanceof Refusal) || error.status >= 500) throw error
    await auditFormRefusal(c,error)
    return populationsPage(c,{ values, error: error.message, status: error.status })
   }
  } },
  { method: 'GET', pattern: both(`/populations/${id}`), run: async (c, m) => {
   const u = (await uploads(c.env, c.now)).find(x => x.id === m[1]); if (!u) throw new Refusal('Population not found.', 404)
   const list = await rows(c.env, u.id), diff = await differences(c.env, u)
   if (c.isApi) return json({ upload: u, rows: list, differences: diff })
   const folks = await people(c.env), name = (pid: string) => folks.find(p => p.id === pid)?.name ?? pid
   const head = slab(`<section aria-labelledby="upload-facts"><h2 id="upload-facts">${escape(columnTemplates[u.kind].label)}</h2>${facts([['Source system', escape(u.source_system)], ['True as of', escape(u.as_of)], ['State', stateChip(u.state) + ` stale after ${escape(u.stale_after)}`], ['Provenance', manual(u.uploaded_at) + ` by ${escape(u.uploaded_name)}`], ['File', `${escape(u.filename)} · ${u.size} bytes · <code>${u.sha256.slice(0, 16)}…</code> <a href="/app/populations/${u.id}/file">Download original</a>`], ['Tests', 'Manual rows never satisfy a test that needs a source read; for those tests they are unknown.']])}${diff ? `<h3>Changes since the previous list</h3>${facts([['Joiners', escape(diff.joiners.join(', ') || 'none')], ['Leavers', escape(diff.leavers.join(', ') || 'none')], ['Removed', escape(diff.removed.join(', ') || 'none')]])}` : ''}</section>`)
   const body = slab(`<section aria-labelledby="rows-title"><h2 id="rows-title">Rows and matches</h2>${table(['Row', 'Key', 'Details', 'Person', ''], list.map(r => [String(r.row_number), escape(r.row_key), escape(Object.entries(r.attributes).filter(([, v]) => v !== null && v !== '').map(([k, v]) => `${k}: ${v}`).join('; ')), r.match ? `${stateChip(r.match.state)} ${escape(r.match.person ?? (r.match.candidates.length ? 'one of ' + r.match.candidates.map(name).join(' or ') : '—'))}<br><small>${escape(r.match.basis)}</small>` : stateChip('unmatched'), `<form method="post" action="/app/populations/rows/${r.id}/match"><select name="person_id" aria-label="Person for row ${r.row_number}">${personOptions(folks, r.match?.person_id ?? '', 'Proposed person')}</select><select name="decision" aria-label="Decision for row ${r.row_number}"><option value="approved">Approve</option><option value="rejected">Reject</option></select><button class="button-secondary">Decide</button></form>`]), 'Rows')}</section>`)
   return page('Population', `${head}${body}`, 200, { owner: c.actor.name, active: 'connections' })
  } },
  { method: 'GET', pattern: new RegExp(`^/app/populations/${id}/file$`), run: async (c, m) => {
   const u = await c.env.DB.prepare('SELECT filename,sha256,size,object_key FROM population_uploads WHERE id=?').bind(m[1]).first<{ filename: string; sha256: string; size: number; object_key: string }>()
   if (!u) throw new Refusal('Population not found.', 404)
   const object = await c.env.EXHIBITS.get(u.object_key), bytes = object ? new Uint8Array(await object.arrayBuffer()) : null
   const hash = bytes ? Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('') : ''
   if (!bytes || bytes.byteLength !== u.size || hash !== u.sha256) return json({ error: 'Unavailable bytes. The upload record is retained.' }, 410)
   return new Response(bytes, { headers: { 'content-type': 'application/octet-stream', 'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(u.filename)}`, 'x-content-type-options': 'nosniff', 'cache-control': 'no-store', 'content-security-policy': "default-src 'none'; sandbox" } })
  } },
  { method: 'POST', pattern: both(`/populations/rows/${id}/match`), run: async (c, m) => { const uploadId = await decide(c.env, c.actor, m[1], await readInput(c.request), c.now); return done(c, '/app/populations/' + uploadId, { decided: true }) } },

 ]
 return ownerRoutes(routes, clock)
}
