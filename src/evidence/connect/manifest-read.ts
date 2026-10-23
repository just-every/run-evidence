import { scopedFetch } from '../ops/execution'
import { assertNoCredentials, reflectedCredentialMatcher } from '../import/base/provenance/credentials'
import type { Connection } from './storage'
export const manifestPaths = ['package.json', 'package-lock.json', 'requirements.txt', 'go.mod'] as const
export const MANIFEST_LIMIT = 128 * 1024
export class ManifestGap extends Error {}
const revision = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{40,64}$/i.test(v)
const record = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v)
const enc = encodeURIComponent
const hex = (v: ArrayBuffer) => [...new Uint8Array(v)].map(b => b.toString(16).padStart(2, '0')).join('')
export const manifestDigest = async (bytes: Uint8Array) => hex(await crypto.subtle.digest('SHA-256', bytes as BufferSource))
export async function manifestBytes(response: Response, limit = MANIFEST_LIMIT): Promise<Uint8Array> {
 const reader = response.body?.getReader(); if (!reader) throw new ManifestGap('Source file body is unavailable.')
 const parts: Uint8Array[] = []; let size = 0
 try { for (;;) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > limit) { await reader.cancel(); throw new ManifestGap('Source response exceeds its reader byte bound.') } parts.push(value) } } finally { reader.releaseLock() }
 const bytes = new Uint8Array(size); let at = 0; for (const part of parts) { bytes.set(part, at); at += part.length }
 if (!size) throw new ManifestGap('Source file is empty.')
 return bytes
}
// Raw manifests have a separate owner grant. Refuse recognized credential keys,
// credential-bearing URLs, private-key material and reflections of this source
// credential before any bytes or cursor enter durable storage. This is a
// conservative refusal filter, not a claim of comprehensive secret detection.
export function checkManifest(bytes: Uint8Array, path: string, token: string) {
 let text: string; try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes) } catch { throw new ManifestGap('Source file is not supported UTF-8 text.') }
 try {
  if (reflectedCredentialMatcher([token, btoa(token)])(text) || /-----BEGIN[^\r\n]*PRIVATE KEY-----/.test(text) || /(?:password|secret|authorization|access[_-]?token|api[_-]?key)["']?\s*[:=]/i.test(text)) throw Error()
  if (path.endsWith('.json')) assertNoCredentials(JSON.parse(text))
  for (const url of text.match(/https?:\/\/[^\s"'<>]+/g) ?? []) assertNoCredentials(url)
 } catch { throw new ManifestGap('Source file contains a recognized credential marker or is invalid JSON; original refused.') }
}
// Every request is GET to the configured provider origin. Returned source URLs
// are never followed, and a branch is resolved once before immutable file reads.
export async function manifestReader(c: Connection, token: string, repository: string, assertAuthority: () => Promise<void>) {
 const headers = { authorization: c.provider === 'azuredevops' ? 'Basic ' + btoa(':' + token) : 'Bearer ' + token, accept: 'application/json' }
 const request = async (path: string) => {
  await assertAuthority()
  const response = await scopedFetch(c.api_base + path, { method: 'GET', headers, redirect: 'manual' })
  if ([401, 403].includes(response.status)) throw new ManifestGap('Source file permission denied (' + response.status + ').')
  if (response.status === 404) return null
  if (!response.ok) throw new ManifestGap('Source file read did not complete (' + response.status + ').')
  return response
 }
 const json = async (path: string): Promise<any> => { const r = await request(path); if (!r) throw new ManifestGap('Source repository or revision is unavailable.'); try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await manifestBytes(r, 256 * 1024))) } catch { throw new ManifestGap('Source metadata is not valid JSON.') } }
 let root: string, commit: unknown, web: string
 if (c.provider === 'github') {
  root = '/repos/' + repository.split('/').map(enc).join('/')
  const repo = await json(root); if (!record(repo) || String(repo.full_name).toLowerCase() !== repository.toLowerCase() || typeof repo.default_branch !== 'string') throw new ManifestGap('Source repository identity or default branch is unavailable.')
  const branch = await json(root + '/branches/' + enc(repo.default_branch)); commit = branch?.commit?.sha
  web = (new URL(c.api_base).hostname === 'api.github.com' ? 'https://github.com' : new URL(c.api_base).origin) + '/' + repository + '/blob/'
 } else if (c.provider === 'gitlab') {
  root = '/projects/' + enc(repository); const repo = await json(root)
  if (!record(repo) || repo.path_with_namespace !== repository || typeof repo.default_branch !== 'string') throw new ManifestGap('Source project identity or default branch is unavailable.')
  commit = (await json(root + '/repository/branches/' + enc(repo.default_branch)))?.commit?.id
  web = new URL(c.api_base).origin + '/' + repository + '/-/blob/'
 } else if (c.provider === 'bitbucket') {
  root = '/repositories/' + repository.split('/').map(enc).join('/'); const repo = await json(root)
  if (!record(repo) || repo.full_name !== repository || typeof repo.mainbranch?.name !== 'string') throw new ManifestGap('Source repository identity or default branch is unavailable.')
  commit = (await json(root + '/refs/branches/' + enc(repo.mainbranch.name)))?.target?.hash
  web = 'https://bitbucket.org/' + repository + '/src/'
 } else if (c.provider === 'azuredevops') {
  const [project, repoId, extra] = repository.split('/')
  if (extra || !/^[a-f0-9-]{36}$/i.test(project) || !/^[a-f0-9-]{36}$/i.test(repoId)) throw new ManifestGap('Source project/repository identity is invalid.')
  root = '/' + enc(project) + '/_apis/git/repositories/' + enc(repoId)
  const repo = await json(root + '?api-version=7.1')
  if (!record(repo) || repo.id !== repoId || repo.project?.id !== project || typeof repo.defaultBranch !== 'string' || !repo.defaultBranch.startsWith('refs/heads/')) throw new ManifestGap('Source repository identity or branch is unavailable.')
  const refs = await json(root + '/refs?filter=' + enc(repo.defaultBranch.slice(5)) + '&api-version=7.1')
  const matches = Array.isArray(refs?.value) ? refs.value.filter((r: any) => r.name === repo.defaultBranch) : []
  if (matches.length !== 1) throw new ManifestGap('Source branch revision is ambiguous or unavailable.')
  commit = matches[0].objectId; web = c.api_base + '/' + enc(project) + '/_git/' + enc(repoId) + '?version=GC'
 } else throw new ManifestGap('Original manifests are not supported for this provider.')
 if (!revision(commit)) throw new ManifestGap('An immutable source commit was not established.')
 const pinned = commit
 return {
  revision: pinned,
  async read(path: string) {
   if (!(manifestPaths as readonly string[]).includes(path)) throw new ManifestGap('Manifest path is outside the supported root paths.')
   let bytes: Uint8Array, source: string
   if (c.provider === 'github' || c.provider === 'gitlab') {
    const endpoint = c.provider === 'github' ? root + '/contents/' + enc(path) + '?ref=' + pinned : root + '/repository/files/' + enc(path) + '?ref=' + pinned
    const response = await request(endpoint); if (!response) return null
    let item: any; try { item = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await manifestBytes(response, 256 * 1024))) } catch { throw new ManifestGap('Source manifest metadata is malformed or oversized.') }
    if (!record(item) || item.encoding !== 'base64' || typeof item.content !== 'string' || item.content.length > 180000 || item.size < 1 || item.size > MANIFEST_LIMIT || (c.provider === 'github' ? item.type !== 'file' || item.path !== path : item.file_path !== path || item.commit_id !== pinned)) throw new ManifestGap('Source manifest identity, revision, encoding or size is invalid.')
    try { bytes = Uint8Array.from(atob(item.content.replace(/\s/g, '')), s => s.charCodeAt(0)) } catch { throw new ManifestGap('Source manifest encoding is invalid.') }
    if (bytes.byteLength !== item.size) throw new ManifestGap('Source manifest size does not match its bytes.')
    if (c.provider === 'gitlab') { if (await manifestDigest(bytes) !== item.content_sha256) throw new ManifestGap('Source manifest digest does not match.') }
    else {
     const prefix = new TextEncoder().encode('blob ' + bytes.length + '\0'), object = new Uint8Array(prefix.length + bytes.length); object.set(prefix); object.set(bytes, prefix.length)
     if (hex(await crypto.subtle.digest('SHA-1', object)) !== item.sha) throw new ManifestGap('Source Git blob digest does not match.')
    }
    source = web + pinned + '/' + enc(path)
   } else if (c.provider === 'bitbucket') {
    const response = await request(root + '/src/' + pinned + '/' + enc(path)); if (!response) return null
    bytes = await manifestBytes(response); source = web + pinned + '/' + enc(path)
   } else {
    const query = '?path=' + enc('/' + path) + '&versionDescriptor.versionType=commit&versionDescriptor.version=' + pinned + '&api-version=7.1'
    const metadata = await request(root + '/items' + query); if (!metadata) return null
    let item: any; try { item = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await manifestBytes(metadata, 256 * 1024))) } catch { throw new ManifestGap('Source manifest metadata is malformed or oversized.') }
    if (item.commitId !== pinned || item.path !== '/' + path || item.isFolder === true || !revision(item.objectId)) throw new ManifestGap('Source manifest commit or path does not match.')
    const response = await request(root + '/items' + query + '&download=true'); if (!response) return null
    bytes = await manifestBytes(response)
    const prefix = new TextEncoder().encode('blob ' + bytes.length + '\0'), object = new Uint8Array(prefix.length + bytes.length); object.set(prefix); object.set(bytes, prefix.length)
    if (hex(await crypto.subtle.digest('SHA-1', object)) !== item.objectId) throw new ManifestGap('Source Git blob digest does not match.')
    source = web + pinned + '&path=' + enc('/' + path)
   }
   checkManifest(bytes, path, token)
   return { bytes, source }
  },
 }
}
