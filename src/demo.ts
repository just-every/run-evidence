import type { Bindings } from './auth.server'
import { day, period } from './evidence/model'
import { createControl } from './evidence/storage'
import { upload } from './evidence/upload'
import { closeFolder, issueFolder, logEvent } from './evidence/review/storage'
import { issueToken, revoke } from './evidence/agent/storage'
import { sampleControls } from './demo-data'
import { seedTests } from './demo-tests'

// Use the same domain operations as the owner. Existing records make this hook
// idempotent; sample files receive normal custody hashes and storage checks.
export async function seedDemo(env: Bindings, { ownerEmail, now }: { ownerEmail: string; now: Date }): Promise<void> {
 const owner = await env.DB.prepare("SELECT id FROM oa_operators WHERE email=? AND role='owner'").bind(ownerEmail).first<{ id: string }>()
 if (!owner) return
 const actor = { id: owner.id, displayName: 'Maya Chen' }
 await env.DB.prepare('UPDATE oa_operators SET display_name=? WHERE id=?').bind(actor.displayName, owner.id).run()
 await env.DB.prepare('INSERT INTO oa_first_run(singleton,completed_by,completed_at) VALUES(1,?,?) ON CONFLICT(singleton) DO NOTHING').bind(owner.id, now.getTime()).run()
 const ago = (days: number) => new Date(now.getTime() - days * 86400000)
 const controls: string[] = []
 for (const [index, sample] of sampleControls.entries()) {
  const existing = await env.DB.prepare('SELECT c.id,r.id AS requirement FROM controls c JOIN requirements r ON r.control_id=c.id WHERE c.name=?').bind(sample.name).first<{ id: string; requirement: string }>()
  const control = existing ?? await createControl(env, sample.name, sample.group, sample.proof, sample.cadence, ago(90 - index))
  controls.push(control.id)
  const current = period(sample.cadence, day(now)), previous = period(sample.cadence, day(new Date(current.start - 1)))
  const windows = sample.state === 'overdue' ? [previous] : [previous, current]
  for (const window of windows) {
   const source = 'Sample · ' + sample.author + ', Northstar Studio'
   if (await env.DB.prepare('SELECT id FROM receipts WHERE requirement_id=? AND source=? AND covered_from=? AND covered_to=?').bind(control.requirement, source, window.from, window.to).first()) continue
   const content = `Northstar Studio — illustrative demo evidence\n${sample.proof}\nPeriod: ${window.from} through ${window.to} (UTC)\nPrepared by: ${sample.author}\n\n${sample.note}\n\nSample record for exploring Evidence. This is not evidence about a real business.\n`
   const form = new FormData()
   form.set('file', new File([content], sample.slug + '-' + window.from + '.txt', { type: 'text/plain' }))
   form.set('source', source); form.set('covered_from', window.from); form.set('covered_to', window.to)
   await upload(new Request(env.AUTH_ORIGIN + '/api/work', { method: 'POST', body: form }), env, control.requirement, actor, window === current ? now : new Date(previous.deadline - 3600000))
  }
 }
 const quarter = period('quarterly', day(now))
 const folders = [
  { label: 'Harbor Assurance · readiness review', expires: ago(-14), closed: false },
  { label: 'Elena Morris · finance diligence', expires: ago(-7), closed: true },
  { label: 'Harbor Assurance · previous review', expires: ago(2), closed: false },
 ]
 for (const sample of folders) {
  if (await env.DB.prepare('SELECT id FROM review_folders WHERE reviewer_label=?').bind(sample.label).first()) continue
  const { folder } = await issueFolder(env, { reviewer_label: sample.label, period_from: quarter.from, period_to: quarter.to, expires_at: sample.expires.toISOString(), control_ids: controls.slice(0, 6) }, ago(8))
  for (const [index, action] of (['page', 'list', 'receipt', 'download'] as const).entries()) await logEvent(env, folder, null, action, 'allowed', ago(6 - index))
  if (sample.closed) await closeFolder(env, folder.id, ago(1))
 }
 for (const [index, label] of ['Internal readiness assistant', 'Previous quarter preparation'].entries()) {
  if (await env.DB.prepare('SELECT id FROM agent_tokens WHERE label=?').bind(label).first()) continue
  const { grant } = await issueToken(env, label, ago(-14).toISOString(), actor, ago(10))
  if (index) await revoke(env, grant.id, actor, ago(1))
 }
 await seedTests(env, { id: owner.id, name: actor.displayName }, now)
}
