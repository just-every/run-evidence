import type { Bindings } from '../../auth.server'
import { auditStatement, done, json, oneOf, readInput, text, type Actor, type Input, type Route } from '../door'
import { headers } from '../view'
import { Refusal } from '../upload'
import { digest } from '../api/tokens'
import { requireCapability } from '../archive/capabilities'
import { unseal } from './custody'
import { requireConnection, type Connection } from './storage'
import { ManifestGap, manifestDigest, manifestPaths, manifestReader } from './manifest-read'
export const codeProviders = ['github', 'gitlab', 'bitbucket', 'azuredevops']
export interface ManifestGrant { id: string; connection_id: string; sequence: number; decision: string; credential_binding: string; reason: string; actor_id: string; actor_name: string; at: string }
export interface ManifestSnapshot { id: string; connection_id: string; repository: string; source_revision: string; manifest_path: string; sha256: string; size: number; object_key: string; source_url: string; read_at: string; grant_id: string }
const binding = (c: Connection) => digest(JSON.stringify([c.id, c.secret_ciphertext, c.secret_iv]))
const latestGrant = (env: Bindings, id: string) => env.DB.prepare('SELECT * FROM code_manifest_grants WHERE connection_id=? ORDER BY sequence DESC LIMIT 1').bind(id).first<ManifestGrant>()
async function codeConnection(env: Bindings, id: string) { const c = await requireConnection(env, id); if (!codeProviders.includes(c.provider)) throw new Refusal('Original dependency manifests are not available for this provider.'); return c }
async function authority(env: Bindings, c: Connection) {
 const grant = await latestGrant(env, c.id)
 const allowed = c.status === 'active' && !!c.secret_ciphertext && !!c.secret_iv && grant?.decision === 'grant' && grant.credential_binding === await binding(c)
 return { grant, allowed }
}
export async function manifestState(env: Bindings, id: string) {
 const c = await codeConnection(env, id), state = await authority(env, c)
 const rows = (await env.DB.prepare('SELECT * FROM code_manifest_snapshots WHERE connection_id=? ORDER BY read_at DESC,rowid DESC').bind(id).all<ManifestSnapshot>()).results
 return { allowed: state.allowed, credential_revision: await binding(c), grant: state.grant ? { id: state.grant.id, sequence: state.grant.sequence, decision: state.grant.decision, reason: state.grant.reason, actor_name: state.grant.actor_name, at: state.grant.at } : null, paths: manifestPaths, snapshots: rows.map(({ object_key: _key, ...row }) => ({ ...row, download_url: `/api/connections/${id}/manifests/${row.id}/download` })), meaning: 'Original source-file custody only; no control pass, vulnerability retest, AI approval or provider verification is asserted.' }
}
export async function grantManifests(env: Bindings, actor: Actor, id: string, input: Input, now: Date) {
 const c = await codeConnection(env, id), decision = oneOf(input, 'decision', ['grant', 'revoke'] as const), reason = text(input, 'reason', 500)
 if (decision === 'grant' && (c.status !== 'active' || !c.secret_ciphertext || !c.secret_iv)) throw new Refusal('Reconnect the source before granting original-manifest collection.', 409)
 const captured = await binding(c)
 if (decision === 'grant' && input.acknowledge_originals !== 'yes') throw new Refusal('Explicitly acknowledge that private original files will be retained and included in owner-requested custody exports.')
 if (decision === 'grant' && input.credential_revision !== captured) throw new Refusal('Read the current source credential revision before granting original capture.', 409)
 const grant = crypto.randomUUID()
 await env.DB.batch([
  env.DB.prepare('INSERT INTO code_manifest_grants(id,connection_id,sequence,decision,credential_binding,reason,actor_id,actor_name,at) SELECT ?,?,COALESCE(MAX(sequence),0)+1,?,?,?,?,?,? FROM code_manifest_grants WHERE connection_id=?').bind(grant, id, decision, captured, reason, actor.id, actor.name, now.toISOString(), id),
  auditStatement(env, actor, 'code.manifests.' + (decision === 'grant' ? 'granted' : 'revoked'), 'connection:' + id, now, 'succeeded', 'Original manifest capture; private retained bytes join owner-requested custody exports.', { reason, revision: grant }),
 ])
 return { id: grant, decision }
}
// Commit an original only while the same owner grant, encrypted credential and
// selected repository still hold inside the SQL transaction. Failed/competing
// attempts remove only their own uncommitted object; retained originals never
// change and are not erased by source revocation.
async function retain(env: Bindings, c: Connection, grant: ManifestGrant, actor: Actor, repository: string, revision: string, path: string, bytes: Uint8Array, source: string, now: Date) {
 const sha256 = await manifestDigest(bytes), old = await env.DB.prepare('SELECT * FROM code_manifest_snapshots WHERE connection_id=? AND repository=? AND source_revision=? AND manifest_path=? AND sha256=?').bind(c.id, repository, revision, path, sha256).first<ManifestSnapshot>()
 const current = await codeConnection(env, c.id), state = await authority(env, current)
 if (!state.allowed || state.grant!.id !== grant.id || current.secret_ciphertext !== c.secret_ciphertext || current.secret_iv !== c.secret_iv) throw new Refusal('Source manifest authority changed during the read.', 409)
 if (old) return old
 const id = crypto.randomUUID(), key = 'code-manifests/' + id
 const written = await env.EXHIBITS.put(key, bytes, { onlyIf: { etagDoesNotMatch: '*' }, httpMetadata: { contentType: 'application/octet-stream' } })
 if (!written) throw new Refusal('Original source object could not be claimed.', 503)
 let committed = false
 try {
  const stored = await env.EXHIBITS.get(key)
  if (!stored || stored.size !== bytes.length || await manifestDigest(new Uint8Array(await stored.arrayBuffer())) !== sha256) throw new Refusal('Stored source bytes do not match; no original is admitted.', 503)
  const guard = "EXISTS(SELECT 1 FROM connections c JOIN connection_repositories r ON r.connection_id=c.id WHERE c.id=? AND c.status='active' AND c.secret_ciphertext=? AND c.secret_iv=? AND r.full_name=? AND r.selected=1) AND ?=(SELECT id FROM code_manifest_grants WHERE connection_id=? ORDER BY sequence DESC LIMIT 1)"
  const result = await env.DB.batch([
   env.DB.prepare(`INSERT INTO code_manifest_snapshots(id,connection_id,repository,source_revision,manifest_path,sha256,size,object_key,source_url,read_at,grant_id) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE ${guard} ON CONFLICT DO NOTHING`).bind(id, c.id, repository, revision, path, sha256, bytes.length, key, source, now.toISOString(), grant.id, c.id, c.secret_ciphertext, c.secret_iv, repository, grant.id, c.id),
   env.DB.prepare("INSERT INTO product_audit(id,actor_kind,actor_id,actor_name,action,subject,outcome,detail,at,reason,revision) SELECT ?,'owner',?,?,'code.manifest.captured',?,'succeeded',?,?,?,? WHERE EXISTS(SELECT 1 FROM code_manifest_snapshots WHERE id=?)").bind(crypto.randomUUID(), actor.id, actor.name, 'connection:' + c.id, repository + ' ' + path + ' at ' + revision, now.toISOString(), grant.reason, sha256, id),
  ])
  if (!result[0].meta.changes) {
   const same = await env.DB.prepare('SELECT * FROM code_manifest_snapshots WHERE connection_id=? AND repository=? AND source_revision=? AND manifest_path=? AND sha256=?').bind(c.id, repository, revision, path, sha256).first<ManifestSnapshot>()
   if (same) return same
   throw new Refusal('Source manifest authority or scope changed before custody committed.', 409)
  }
  committed = true
  return { id, connection_id: c.id, repository, source_revision: revision, manifest_path: path, sha256, size: bytes.length, object_key: key, source_url: source, read_at: now.toISOString(), grant_id: grant.id }
 } finally { if (!committed) await env.EXHIBITS.delete(key) }
}
export async function captureManifests(env: Bindings, actor: Actor, id: string, now: Date) {
 const c = await codeConnection(env, id), state = await authority(env, c)
 if (!state.allowed) throw new Refusal('Original manifests are denied until the owner grants this exact source credential with an audited reason. Rotation and restore require a new grant.', 409)
 await requireCapability(env, 'writes', id)
 const repos = (await env.DB.prepare('SELECT full_name FROM connection_repositories WHERE connection_id=? AND selected=1 ORDER BY full_name LIMIT 21').bind(id).all<{ full_name: string }>()).results
 if (!repos.length || repos.length > 20) throw new Refusal('Select between one and twenty repositories for an original-manifest capture.', 409)
 const token = await unseal(env, c.secret_ciphertext!, c.secret_iv!, c.id), captured: string[] = [], absent: { repository: string; path: string }[] = [], gaps: { repository: string; path: string | null; reason: string }[] = []
 for (const { full_name: repository } of repos) {
  try {
   const reader = await manifestReader(c, token, repository, async () => {
    const current = await codeConnection(env, id), live = await authority(env, current)
    const selected = await env.DB.prepare('SELECT 1 FROM connection_repositories WHERE connection_id=? AND full_name=? AND selected=1').bind(id, repository).first()
    if (!selected || !live.allowed || live.grant!.id !== state.grant!.id || current.secret_ciphertext !== c.secret_ciphertext || current.secret_iv !== c.secret_iv) throw new Refusal('Source manifest authority or scope changed before the read.', 409)
   })
   for (const path of manifestPaths) {
    try { const file = await reader.read(path); if (!file) { absent.push({ repository, path }); continue }; const row = await retain(env, c, state.grant!, actor, repository, reader.revision, path, file.bytes, file.source, now); captured.push(row.id) }
    catch (error) { if (!(error instanceof ManifestGap || error instanceof Refusal)) throw error; gaps.push({ repository, path, reason: error.message }) }
   }
  } catch (error) { if (!(error instanceof ManifestGap || error instanceof Refusal)) throw error; gaps.push({ repository, path: null, reason: error.message }) }
 }
 await auditStatement(env, actor, 'code.manifests.capture', 'connection:' + id, now, gaps.length ? 'failed' : 'succeeded', `${captured.length} original files; ${absent.length} absent paths; ${gaps.length} gaps. ${gaps[0]?.reason ?? ''}`, { revision: state.grant!.id }).run()
 return { outcome: gaps.length ? 'partial' : 'complete', captured, absent, gaps, scope: 'Only the four named root paths at each resolved immutable commit; no recursive or automatic scheduled capture is claimed.' }
}
export function manifestRoutes(id: string): Route[] {
 const root = `/api/connections/${id}`, item = `([0-9a-f-]{36})`
 return [
  { method: 'GET', pattern: new RegExp('^' + root + '/manifests$'), run: async (c, m) => json(await manifestState(c.env, m[1])) },
  { method: 'POST', pattern: new RegExp('^' + root + '/manifest-grants$'), run: async (c, m) => done(c, '/app/connections/' + m[1], await grantManifests(c.env, c.actor, m[1], await readInput(c.request), c.now)) },
  { method: 'POST', pattern: new RegExp('^' + root + '/manifests$'), run: async (c, m) => json(await captureManifests(c.env, c.actor, m[1], c.now)) },
  { method: 'GET', pattern: new RegExp('^' + root + '/manifests/' + item + '/download$'), run: async (c, m) => {
   await codeConnection(c.env, m[1])
   const row = await c.env.DB.prepare('SELECT * FROM code_manifest_snapshots WHERE id=? AND connection_id=?').bind(m[2], m[1]).first<ManifestSnapshot>()
   if (!row) throw new Refusal('Original source manifest not found.', 404)
   const object = await c.env.EXHIBITS.get(row.object_key)
   if (!object) throw new Refusal('Original source bytes are unavailable.', 503)
   const bytes = new Uint8Array(await object.arrayBuffer())
   if (bytes.length !== row.size || await manifestDigest(bytes) !== row.sha256) throw new Refusal('Original source bytes changed; no verified download is available.', 503)
   await auditStatement(c.env, c.actor, 'code.manifest.downloaded', 'manifest:' + row.id, c.now, 'succeeded', row.repository + ' ' + row.manifest_path, { revision: row.sha256 }).run()
   return new Response(bytes, { headers: { ...headers, 'content-type': 'application/octet-stream', 'content-disposition': 'attachment; filename="' + row.manifest_path + '"', 'content-security-policy': "default-src 'none'" } })
  } },
 ]
}
