import { fail, pathOK } from '../archive/format'
import { staged, pages, type Store } from '../archive/registry'
import { manifestPaths, MANIFEST_LIMIT } from './manifest-read'
import { assertNoCredentials } from '../import/base/provenance/credentials'
export async function validateManifestArchive(env: Store, id: string) {
 const t = (name: string) => staged(id, name)
 if (await env.DB.prepare(`SELECT 1 FROM ${t('code_manifest_grants')} g JOIN ${t('connections')} c ON c.id=g.connection_id WHERE c.provider NOT IN ('github','gitlab','bitbucket','azuredevops') LIMIT 1`).first()) fail('Original manifest grant names an unsupported source.')
 for await (const rows of pages(env, 'code_manifest_grants', t('code_manifest_grants'))) for (const r of rows) {
  if (!Number.isSafeInteger(r.sequence) || Number(r.sequence) < 1 || !['grant','revoke'].includes(String(r.decision)) || typeof r.reason !== 'string' || !r.reason.trim() || r.reason.length > 500 || !/^[a-f0-9]{64}$/.test(String(r.credential_binding)) || typeof r.at !== 'string' || !Number.isFinite(Date.parse(r.at))) fail('Invalid original-manifest grant history.')
 }
 for await (const rows of pages(env, 'code_manifest_snapshots', t('code_manifest_snapshots'))) for (const r of rows) {
  if (!Number.isSafeInteger(r.size) || Number(r.size) < 1 || Number(r.size) > MANIFEST_LIMIT || !(manifestPaths as readonly unknown[]).includes(r.manifest_path) || !/^[a-f0-9]{64}$/.test(String(r.sha256)) || !/^[a-f0-9]{40,64}$/i.test(String(r.source_revision)) || typeof r.repository !== 'string' || !r.repository || r.repository.length > 500 || typeof r.read_at !== 'string' || !Number.isFinite(Date.parse(r.read_at)) || r.object_key !== 'code-manifests/' + r.id) fail('Invalid original-manifest snapshot.')
  pathOK(String(r.object_key))
  try { const u = new URL(String(r.source_url)); if (u.protocol !== 'https:' || u.username || u.password) throw Error(); assertNoCredentials(u.href) } catch { fail('Unsafe original-manifest source URL.') }
 }
 if (await env.DB.prepare(`SELECT 1 FROM ${t('code_manifest_snapshots')} s JOIN ${t('code_manifest_grants')} g ON g.id=s.grant_id WHERE g.connection_id<>s.connection_id OR g.decision<>'grant' OR g.at>s.read_at LIMIT 1`).first()) fail('Original manifest does not match its retained owner grant.')
}
