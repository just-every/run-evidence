import type { Bindings } from '../../auth.server'
import { fail, sha, type Row } from './format'
// POPULATION-001: original manual lists are custody bytes, not observations.
export interface PopulationFile { path: string; object_key: string; size: number; sha256: string; available: boolean; reason?: string }
export async function populationFiles(env: Pick<Bindings, 'EXHIBITS'>, rows: Row[]): Promise<PopulationFile[]> {
 return Promise.all(rows.map(async row => {
  let available = false
  try {
   const object = await env.EXHIBITS.get(String(row.object_key))
   available = !!object && object.size === row.size && await sha(await object.arrayBuffer()) === row.sha256
  } catch { /* Unreadable bytes remain explicitly unavailable. */ }
  return { path: `populations/${row.id}`, object_key: String(row.object_key), size: Number(row.size), sha256: String(row.sha256), available, ...(!available ? { reason: 'Original population file is missing, unreadable or changed.' } : {}) }
 }))
}
export function validatePopulationFiles(files: unknown, rows: Row[]): asserts files is PopulationFile[] {
 if (!Array.isArray(files) || files.length !== rows.length) fail('Population file inventory is incomplete.')
 const ids = new Set<string>()
 for (const file of files) {
  if (!file || typeof file !== 'object' || Array.isArray(file)) fail('Invalid population file inventory.')
  const keys = ['path', 'object_key', 'size', 'sha256', 'available', ...(file.available === false ? ['reason'] : [])]
  const row = rows.find(r => file.path === `populations/${r.id}`)
  if (Object.keys(file).length !== keys.length || keys.some(k => !Object.hasOwn(file, k)) || !row || !/^[a-zA-Z0-9_-]{1,128}$/.test(String(row.id)) || ids.has(String(row.id)) || file.object_key !== `populations/${row.id}` || file.object_key !== row.object_key || file.size !== row.size || !Number.isSafeInteger(file.size) || file.size < 1 || file.size > 5 * 1024 * 1024 || file.sha256 !== row.sha256 || !/^[a-f0-9]{64}$/.test(file.sha256) || typeof file.available !== 'boolean' || (!file.available && (typeof file.reason !== 'string' || !file.reason || file.reason.length > 300))) fail('Population file inventory contradicts its immutable upload.')
  ids.add(String(row.id))
 }
}
