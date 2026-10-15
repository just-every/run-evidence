import type { Bindings } from './auth.server'
import { day, period } from './evidence/model'
import { sampleControls } from './demo-data'

const hash = async (bytes: Uint8Array<ArrayBuffer>) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(n => n.toString(16).padStart(2, '0')).join('')
const encoded = (value: string) => new TextEncoder().encode(value)
const fixedId = (kind: number, index: number) => `d0000000-0000-4000-8000-${kind.toString(16).padStart(4, '0')}${index.toString(16).padStart(8, '0')}`

export async function seedDemo(env: Bindings, { ownerEmail, now }: { ownerEmail: string; now: Date }): Promise<void> {
 const owner = await env.DB.prepare("SELECT id, display_name FROM oa_operators WHERE email=? AND role='owner'").bind(ownerEmail).first<{ id: string; display_name: string }>()
 if (!owner) return
 await env.DB.prepare('INSERT INTO oa_first_run(singleton,completed_by,completed_at) VALUES(1,?,?) ON CONFLICT(singleton) DO NOTHING').bind(owner.id, now.getTime()).run()
 const ago = (days: number) => new Date(now.getTime() - days * 86400000).toISOString()
 for (const [index, sample] of sampleControls.entries()) {
  const control = fixedId(1, index), requirement = fixedId(2, index)
  await env.DB.batch([
   env.DB.prepare('INSERT OR IGNORE INTO controls(id,name,group_name,created_at) VALUES(?,?,?,?)').bind(control, sample.name, sample.group, ago(90 - index)),
   env.DB.prepare('INSERT OR IGNORE INTO requirements(id,control_id,name,cadence,created_at) VALUES(?,?,?,?,?)').bind(requirement, control, sample.proof, sample.cadence, ago(90 - index)),
  ])
  if (sample.state === 'missing') continue
  const current = period(sample.cadence, day(now))
  const previous = period(sample.cadence, day(new Date(current.start - 1)))
  const windows: [string, ReturnType<typeof period>][] = [['previous', previous]]
  if (sample.state !== 'overdue') windows.push(['current', current])
  for (const [version, window] of windows) {
   const position = index * 2 + (version === 'current' ? 1 : 0)
   const id = fixedId(3, position), exhibit = fixedId(4, position), key = 'demo/' + exhibit + '.txt'
   if (await env.DB.prepare('SELECT id FROM receipts WHERE id=?').bind(id).first()) continue
   const filename = sample.slug + '-' + window.from + '.txt'
   const bytes = encoded(`Northstar Studio — illustrative demo evidence\n${sample.proof}\nPeriod: ${window.from} through ${window.to} (UTC)\nPrepared by: ${sample.author}\n\n${sample.note}\n\nSample record for exploring Evidence. This is not evidence about a real business.\n`)
   await env.EXHIBITS.put(key, bytes, { httpMetadata: { contentType: 'text/plain' } })
   await env.DB.batch([
    env.DB.prepare('INSERT OR IGNORE INTO exhibits(id,object_key,filename,size,media_type) VALUES(?,?,?,?,?)').bind(exhibit, key, filename, bytes.length, 'text/plain'),
    env.DB.prepare('INSERT OR IGNORE INTO receipts(id,requirement_id,exhibit_id,origin,source,covered_from,covered_to,added_by,added_by_name,added_at,sha256,supersedes) VALUES(?,?,?,?,?,?,?,?,?,?,?,NULL)').bind(id, requirement, exhibit, 'manually-asserted', 'Sample · ' + sample.author + ', Northstar Studio', window.from, window.to, owner.id, owner.display_name, version === 'current' ? ago(0) : new Date(previous.deadline - 3600000).toISOString(), await hash(bytes)),
   ])
  }
 }
 const quarter = period('quarterly', day(now))
 const folders = [
  { slug: 'readiness', label: 'Harbour Assurance · readiness review', expires: new Date(now.getTime() + 14 * 86400000).toISOString(), closed: null },
  { slug: 'finance', label: 'Elena Morris · finance diligence', expires: new Date(now.getTime() + 7 * 86400000).toISOString(), closed: ago(1) },
  { slug: 'previous', label: 'Harbour Assurance · previous review', expires: ago(2), closed: null },
 ]
 for (const [folderIndex, folder] of folders.entries()) {
  const id = fixedId(5, folderIndex)
  await env.DB.batch([
   env.DB.prepare('INSERT OR IGNORE INTO review_folders(id,reviewer_label,period_from,period_to,expires_at,created_at,closed_at,token_hash) VALUES(?,?,?,?,?,?,?,?)').bind(id, folder.label, quarter.from, quarter.to, folder.expires, ago(8), folder.closed, await hash(encoded(crypto.randomUUID()))),
   ...sampleControls.slice(0, 6).map((_, index) => env.DB.prepare('INSERT OR IGNORE INTO review_folder_controls(folder_id,control_id) VALUES(?,?)').bind(id, fixedId(1, index))),
   ...['page', 'list', 'receipt', 'download'].map((action, i) => env.DB.prepare('INSERT OR IGNORE INTO review_events(id,folder_id,exhibit_id,action,outcome,occurred_at) VALUES(?,?,NULL,?,?,?)').bind(fixedId(6, folderIndex * 4 + i), id, action, 'allowed', ago(6 - i))),
  ])
 }
 for (const [index, label] of ['Internal readiness assistant', 'Previous quarter preparation'].entries()) {
  await env.DB.prepare('INSERT OR IGNORE INTO agent_tokens(id,label,token_hash,created_by,created_by_name,created_at,expires_at,revoked_at,revoked_by) VALUES(?,?,?,?,?,?,?,?,?)').bind(fixedId(7, index), label, await hash(encoded(crypto.randomUUID())), owner.id, owner.display_name, ago(10), new Date(now.getTime() + 14 * 86400000).toISOString(), index ? ago(1) : null, index ? owner.id : null).run()
 }
}
