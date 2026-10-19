import type { Bindings } from '../../auth.server'
import type { Actor } from '../door'
import { libraryControl } from '../library'
import { adoptionStatements } from '../program/storage'
import { parseTable, type Table } from '../tabular'
import { boundedBody, MAX_FILE, Refusal } from '../upload'
import { controlIds, hash, knownControls, validateDefinition, type Definition, type Difference, type Framework, type FrameworkRequirement } from './model'
import { commit, mappingHistory, mappingStatement, requireFramework, requirements, revisionStatements } from './storage'
const fields = ['id', 'title', 'description', 'section', 'control_ids'] as const
export interface Upload { filename: string; bytes: Uint8Array; media_type: string; sha256: string; table: Table; framework_id: string; name: string; mapping: Record<typeof fields[number], string>; confirm: boolean; exclude_invalid: boolean; review_hash: string }
export async function readUpload(request: Request): Promise<Upload> {
 if (!(request.headers.get('content-type') ?? '').startsWith('multipart/form-data')) throw new Refusal('Upload a CSV or XLSX file with the form.')
 const bytes = await boundedBody(request, MAX_FILE + 65536), form = await new Request(request.url, { method: 'POST', headers: request.headers, body: bytes }).formData(), file = form.get('file')
 if (!(file instanceof File) || !file.size) throw new Refusal('Choose a nonempty CSV or XLSX file.')
 if (file.size > MAX_FILE) throw new Refusal('File exceeds 10 MiB.', 413)
 const original = new Uint8Array(await file.arrayBuffer()), table = parseTable(file.name, original)
 if (!table.rows.length) throw new Refusal('The file has no requirement rows.')
 const val = (key: string) => typeof form.get(key) === 'string' ? String(form.get(key)).trim() : ''
 const mapping = Object.fromEntries(fields.map(f => [f, val('map_' + f) || (table.headers.includes(f) ? f : '')])) as Upload['mapping']
 for (const f of fields) if (mapping[f] && !table.headers.includes(mapping[f])) throw new Refusal(`Column ${mapping[f]} for ${f} is not in this file.`)
 if (!mapping.id || !mapping.title) throw new Refusal('Map requirement ID and title columns.')
 const selected = fields.map(f => mapping[f]).filter(Boolean)
 if (new Set(selected).size !== selected.length) throw new Refusal('Map each field to a separate column.')
 return { filename: file.name.replace(/[\x00-\x1f\x7f]/g,'').slice(0,240) || 'framework.csv', bytes: original, media_type: file.type || 'application/octet-stream', sha256: await hash(original), table, framework_id: val('framework_id'), name: val('name'), mapping, confirm: val('confirm') === 'yes', exclude_invalid: val('exclude_invalid') === 'yes', review_hash: val('review_hash') }
}
export interface PlannedRow extends Definition { row: number; errors: string[] }
export interface Plan { framework_id: string | null; name: string; base_revision: number; sha256: string; filename: string; mapping: Upload['mapping']; total: number; admitted: number; refused: number; rows: PlannedRow[]; differences: Difference; review_hash: string }
const comparable = (r: { title: string; description: string; section: string; control_ids: string[] }) => JSON.stringify([r.title,r.description,r.section,r.control_ids])
export async function plan(env: Bindings, upload: Upload): Promise<Plan> {
 const framework = upload.framework_id ? await requireFramework(env, upload.framework_id) : null, current = framework ? await requirements(env, framework.id) : [], known = await knownControls(env), seen = new Set<string>()
 const name = framework?.name ?? upload.name
 if (!name || name.length > 200) throw new Refusal('Name the custom framework (at most 200 characters).')
 const rows = upload.table.rows.map((r,index) => {
  const value = (f: typeof fields[number]) => upload.mapping[f] ? r[upload.mapping[f]] ?? '' : ''
  const row: PlannedRow = { row: index+2, ref: value('id'), title: value('title'), description: value('description'), section: value('section'), control_ids: controlIds(value('control_ids')), errors: [] }
  row.errors = validateDefinition(row,known)
  if (seen.has(row.ref)) row.errors.push('Duplicate requirement ID: ' + row.ref)
  seen.add(row.ref)
  return row
 })
 // Invalid IDs are retained on re-import, rather than being silently removed.
 const valid = rows.filter(r => !r.errors.length), invalidRefs = new Set(rows.filter(r => r.errors.length).map(r => r.ref)), incoming = new Set(valid.map(r => r.ref)), differences: Difference = { added: [], changed: [], removed: [] }
 const history = framework ? await mappingHistory(env,framework.id) : []
 const latest = new Map<string, typeof history[number]>()
 for (const m of history) latest.set(m.requirement_id+'|'+m.control_id,m)
 for (const r of valid) {
  const before = current.find(q => q.ref === r.ref)
  if (!before || before.removed_at) differences.added.push(r.ref)
  else {
   // File mappings revise file-owned decisions; explicit manual decisions persist.
   const manual = [...latest.values()].filter(m => m.requirement_id===before.id && m.origin==='manual')
   const targets = upload.mapping.control_ids ? new Set(r.control_ids) : new Set(before.mappings)
   for (const m of manual) m.decision==='mapped' ? targets.add(m.control_id) : targets.delete(m.control_id)
   const mapped = [...targets].sort()
   if (comparable({ ...before, control_ids: before.mappings }) !== comparable({ ...r, control_ids: mapped })) differences.changed.push(r.ref)
  }
 }
 for (const before of current) if (!before.removed_at && !incoming.has(before.ref) && !invalidRefs.has(before.ref)) differences.removed.push(before.ref)
 const result = { framework_id: framework?.id ?? null, name, base_revision: framework?.revision ?? 0, sha256: upload.sha256, filename: upload.filename, mapping: upload.mapping, total: rows.length, admitted: valid.length, refused: rows.length-valid.length, rows, differences }
 return { ...result, review_hash: await hash(JSON.stringify(result)) }
}
export async function admit(env: Bindings, actor: Actor, upload: Upload, now: Date) {
 const checked = await plan(env,upload)
 if (!upload.confirm || !upload.review_hash || upload.review_hash!==checked.review_hash) throw new Refusal('The file, mapping or framework revision changed. Run the review again before confirming.',409)
 if (checked.refused && !upload.exclude_invalid) throw new Refusal('Explicitly confirm that refused rows are excluded; no requirements were admitted.')
 if (!checked.admitted) throw new Refusal('There are no valid rows to admit.')
 const framework: Framework = checked.framework_id ? await requireFramework(env,checked.framework_id) : { id: crypto.randomUUID(),name: checked.name,revision:0,created_at:now.toISOString() }
 // A concurrent change between planning and reading must not be accepted either.
 if (framework.revision!==checked.base_revision) throw new Refusal('The framework changed after review. Review it again.',409)
 const current = checked.framework_id ? await requirements(env,framework.id) : [], next = current.map(r => ({...r,mappings:[...r.mappings]})), history = checked.framework_id ? await mappingHistory(env,framework.id) : [], latest = new Map<string, typeof history[number]>()
 for (const m of history) latest.set(m.requirement_id+'|'+m.control_id,m)
 const at = now.toISOString(), revision = framework.revision+1, reason = 'Reviewed import: '+upload.filename, statements: D1PreparedStatement[] = []
 if (!checked.framework_id) statements.push(env.DB.prepare('INSERT INTO custom_frameworks(id,name,revision,created_at) VALUES(?,?,0,?)').bind(framework.id,framework.name,at))
 for (const r of checked.rows.filter(r => !r.errors.length)) {
  let row = next.find(q => q.ref===r.ref)
  if (!row) { row = { id:crypto.randomUUID(), framework_id:framework.id, ref:r.ref, title:r.title, description:r.description,section:r.section,removed_at:null,created_at:at,mappings:[] }; next.push(row); statements.push(env.DB.prepare('INSERT INTO custom_framework_requirements(id,framework_id,ref,title,description,section,removed_at,created_at) VALUES(?,?,?,?,?,?,NULL,?)').bind(row.id,framework.id,row.ref,row.title,row.description,row.section,at)) }
  else { row.title=r.title; row.description=r.description; row.section=r.section; row.removed_at=null; statements.push(env.DB.prepare('UPDATE custom_framework_requirements SET title=?,description=?,section=?,removed_at=NULL WHERE id=?').bind(row.title,row.description,row.section,row.id)) }
  if (upload.mapping.control_ids) {
   const targets = new Set(r.control_ids), manual = [...latest.values()].filter(m=>m.requirement_id===row!.id && m.origin==='manual')
   for (const m of manual) m.decision==='mapped' ? targets.add(m.control_id) : targets.delete(m.control_id)
   for (const control of new Set([...row.mappings,...targets])) if (row.mappings.includes(control)!==targets.has(control)) statements.push(mappingStatement(env,row.id,control,targets.has(control)?'mapped':'unmapped','import',actor,now,reason,revision))
   row.mappings=[...targets].sort()
  }
 }
 for (const ref of checked.differences.removed) { const row=next.find(r=>r.ref===ref)!; row.removed_at=at; statements.push(env.DB.prepare('UPDATE custom_framework_requirements SET removed_at=? WHERE id=?').bind(at,row.id)) }
 const controls = [...new Set(next.filter(r=>!r.removed_at).flatMap(r=>r.mappings))].map(libraryControl).filter((x): x is NonNullable<typeof x> => !!x)
 statements.push(...await adoptionStatements(env,controls,now))
 const object_key='framework-originals/'+crypto.randomUUID(), written=await env.EXHIBITS.put(object_key,upload.bytes,{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/octet-stream'}})
 if (!written) throw new Refusal('Original file could not be stored.',503)
 const stored=await env.EXHIBITS.get(object_key), actual=stored?new Uint8Array(await stored.arrayBuffer()):null
 if (!actual || actual.byteLength!==upload.bytes.byteLength || await hash(actual)!==upload.sha256) { await env.EXHIBITS.delete(object_key); throw new Refusal('Original file could not be verified; no requirements were admitted.',503) }
 const original={object_key,filename:upload.filename,size:actual.byteLength,media_type:upload.media_type,sha256:upload.sha256}
 // Creation precedes its FK children; all prospective changes share one D1 transaction.
 const changes=revisionStatements(env,framework,next,checked.differences,actor,now,reason,original)
 const batch=checked.framework_id ? [...changes,...statements] : [statements[0],...changes,...statements.slice(1)]
 try { await commit(env,batch) } catch(error) { await env.EXHIBITS.delete(object_key); throw error }
 return { id:framework.id, revision, admitted:checked.admitted, refused:checked.refused, differences:checked.differences }
}
