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
// Populations: column templates, upload with dry run, matches and differences;
// Inventory: everything known about people, accounts and devices with provenance.
export function populationHandler(clock: () => Date) {
 const routes: Route[] = [
  { method: 'GET', pattern: new RegExp('^/app/populations/templates/(roster|accounts|devices)\\.csv$'), run: async (_c, m) => { const t = columnTemplates[m[1] as Kind]; return new Response([...t.required, ...t.optional].join(',') + '\r\n', { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${m[1]}-template.csv"`, 'cache-control': 'no-store' } }) } },
  { method: 'GET', pattern: both('/populations'), run: async c => {
   const list = await uploads(c.env, c.now)
   if (c.isApi) return json({ templates: columnTemplates, uploads: list })
   const templates = slab(`<section aria-labelledby="templates-title"><h2 id="templates-title">Column templates</h2><p class="panel-intro">For a system with no connector, upload its list. Required columns are named; map any renamed column on upload. Lists are labelled manual everywhere, never count as a source read, and go stale after their as-of date plus the refresh window.</p>${table(['List', 'Required', 'Optional', ''], kinds.map(k => [escape(columnTemplates[k].label), escape(columnTemplates[k].required.join(', ')), escape(columnTemplates[k].optional.join(', ')), `<a href="/app/populations/templates/${k}.csv">Download CSV template</a>`]), 'Templates')}</section>`)
   const form = slab(`<section aria-labelledby="upload-title"><h2 id="upload-title">Upload a population</h2><form method="post" action="/app/populations" enctype="multipart/form-data"><label>List<select name="kind" aria-label="List">${options(kinds.map(k => [k, columnTemplates[k].label] as [string, string]))}</select></label><label>Source system<input name="source_system" required maxlength="120" placeholder="Justworks"></label><label>True as of<input type="date" name="as_of" required></label><label>Refresh window (days)<input name="refresh_days" inputmode="numeric" value="90"></label><label>File (CSV or XLSX)<input type="file" name="file" required accept=".csv,.xlsx"></label><details><summary>Renamed columns</summary>${[...new Set(kinds.flatMap(k => [...columnTemplates[k].required, ...columnTemplates[k].optional]))].map(f => `<label>Column for ${escape(f)}<input name="map_${f}" maxlength="120"></label>`).join('')}</details><button>Check every row</button></form></section>`)
   const listed = slab(`<section aria-labelledby="uploads-title"><h2 id="uploads-title">Uploaded populations</h2>${table(['List', 'Source', 'As of', 'Rows', 'Provenance', 'State'], list.map(u => [`<a href="/app/populations/${u.id}">${escape(columnTemplates[u.kind].label)}</a>`, escape(u.source_system), escape(u.as_of), String(u.row_count), manual(u.uploaded_at), stateChip(u.state) + `<br><small>stale after ${escape(u.stale_after)}</small>`]), 'Uploaded populations')}</section>`)
   return page('Populations', `<div class="app-columns">${templates}${form}</div>${listed}`, 200, { owner: c.actor.name, active: 'connections' })
  } },
  // Without confirm: a dry run that admits nothing. With confirm and the dry-run fingerprint: admit all rows or none.
  { method: 'POST', pattern: both('/populations'), run: async c => {
   const upload = await readUpload(c.request)
   if (upload.confirm) { const created = await admit(c.env, c.actor, upload, c.now); return done(c, '/app/populations/' + created.id, created, 201) }
   const checked = plan(upload)
   if (c.isApi) return json({ dry_run: true, sha256: upload.sha256, ...checked })
   const refused = checked.rows.filter(r => r.reasons.length)
   return page('Check the population', slab(`<section aria-labelledby="dry-title"><h2 id="dry-title">Dry run: nothing is admitted yet</h2>${facts([['File', escape(upload.filename)], ['Rows', String(checked.total)], ['Valid', String(checked.admit)], ['Refused', String(checked.refuse)], ['Mapping', escape(Object.entries(checked.mapping).filter(([, h]) => h).map(([f, h]) => `${f} ← ${h}`).join('; '))]])}${table(['Row', 'Key', 'Reasons'], refused.map(r => [String(r.row), escape(r.key), escape(r.reasons.join('; '))]), 'Refused rows')}${refused.length ? '<p role="alert">Fix the refused rows and upload again; a list is admitted whole or not at all.</p>' : '<p>Upload the same file again with confirmation to admit it.</p>'}<p><a href="/app/populations">Back</a></p></section>`), refused.length ? 400 : 200, { owner: c.actor.name, active: 'connections' })
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
  { method: 'POST', pattern: both(`/populations/rows/${id}/match`), run: async (c, m) => { await decide(c.env, c.actor, m[1], await readInput(c.request), c.now); return done(c, c.request.headers.get('referer') ? new URL(c.request.headers.get('referer')!).pathname : '/app/populations', { decided: true }) } },
  { method: 'GET', pattern: both('/inventory'), run: async c => {
   const list = await uploads(c.env, c.now), latest = new Map<string, typeof list[number]>()
   for (const u of list) if (!latest.has(u.kind + '|' + u.source_system)) latest.set(u.kind + '|' + u.source_system, u)
   const manualRows = (await Promise.all([...latest.values()].map(async u => (await rows(c.env, u.id)).map(r => ({ ...r, upload: u }))))).flat()
   const directory = (await c.env.DB.prepare("SELECT r.id,r.display_name,r.source_label,r.observed_at,json_extract(r.attributes_json,'$.email') AS email,json_extract(r.attributes_json,'$.status') AS status,m.state,p.name AS person FROM resources r LEFT JOIN identity_matches m ON m.resource_id=r.id LEFT JOIN people p ON p.id=m.person_id WHERE r.type='identity.account' AND r.removed_at IS NULL ORDER BY r.display_name").all<{ id: string; display_name: string; source_label: string; observed_at: string | null; email: string; status: string; state: string | null; person: string | null }>()).results
   const folks = await people(c.env)
   const peopleRows = folks.map(p => ({ id: p.id, name: p.name, email: p.email, kind: p.kind, directory: directory.filter(d => d.state === 'approved' && d.person === p.name).map(d => d.source_label), manual: manualRows.filter(r => r.match?.person_id === p.id && r.match.state === 'approved').map(r => `${r.upload.source_system} ${r.upload.kind} (manual, uploaded ${r.upload.uploaded_at.slice(0, 10)})`) }))
   const accounts = [...directory.map(d => ({ provenance: 'source-observed', source: d.source_label, key: d.email, name: d.display_name, status: d.status, person: d.state === 'approved' ? d.person : null, observed: d.observed_at, tests: 'evaluated' })), ...manualRows.filter(r => r.upload.kind === 'accounts').map(r => ({ provenance: 'manually-asserted', source: r.upload.source_system, key: r.row_key, name: String(r.attributes.name ?? r.attributes.email ?? r.row_key), status: String(r.attributes.status ?? '—'), person: r.match?.state === 'approved' ? r.match.person : null, observed: r.upload.uploaded_at, tests: 'unknown: needs a source read', state: r.upload.state }))]
   const devices = manualRows.filter(r => r.upload.kind === 'devices').map(r => ({ provenance: 'manually-asserted', source: r.upload.source_system, serial: r.row_key, owner: r.match?.state === 'approved' ? r.match.person : null, encrypted: r.attributes.encrypted ?? null, observed: r.upload.uploaded_at, tests: 'unknown: needs a source read', state: r.upload.state }))
   if (c.isApi) return json({ people: peopleRows, accounts, devices, unmatched: { accounts: accounts.filter(a => !a.person).length, devices: devices.filter(d => !d.owner).length } })
   const peopleTable = slab(`<section aria-labelledby="inv-people"><h2 id="inv-people">People</h2>${table(['Person', 'Kind', 'Directory accounts', 'Manual lists'], peopleRows.map(p => [escape(`${p.name} · ${p.email}`), escape(p.kind), escape(p.directory.join('; ') || '—'), p.manual.length ? `${stateChip('manual')} ${escape(p.manual.join('; '))}` : '—']), 'People')}</section>`)
   const accountTable = slab(`<section aria-labelledby="inv-accounts"><h2 id="inv-accounts">Accounts</h2>${table(['Account', 'Source', 'Status', 'Person', 'Tests'], accounts.map(a => [escape(a.name), (a.provenance === 'manually-asserted' ? stateChip('manual') + ' ' : '') + escape(a.source) + `<br><small>${escape(a.observed ?? 'never read')}</small>`, escape(a.status), escape(a.person ?? 'unmatched'), escape(a.tests)]), 'Accounts')}</section>`)
   const deviceTable = slab(`<section aria-labelledby="inv-devices"><h2 id="inv-devices">Devices</h2>${table(['Device', 'Source', 'Owner', 'Encrypted (asserted)', 'Tests'], devices.map(d => [escape(d.serial), stateChip('manual') + ' ' + escape(d.source) + `<br><small>${escape(d.observed)}</small>`, escape(d.owner ?? 'unmatched'), escape(d.encrypted === null ? 'not given' : d.encrypted ? 'yes' : 'no'), escape(d.tests)]), 'Devices')}</section>`)
   return page('Inventory', `<p class="page-intro"><a href="/app/populations">Upload a population</a> for a system without a connector. <a href="/app/identities">Identities</a> lists every directory account.</p>${peopleTable}<div class="app-columns">${accountTable}${deviceTable}</div>`, 200, { owner: c.actor.name, active: 'connections' })
  } },
 ]
 return ownerRoutes(routes, clock)
}
