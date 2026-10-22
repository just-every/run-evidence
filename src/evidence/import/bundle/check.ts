import { Refusal } from '../../upload'
import { sha256 } from '../base/provenance/identity'
import type { Json } from '../base/types'
// Field markers: s string, d date-time string, n number, i integer, b boolean, a array, o object; a trailing ? also accepts null;
// an array of strings is an enum (null allowed when it contains null). A key must be present even when nullable.
export type Spec = Record<string, string | (string | null)[]>
const isDate = (v: unknown) => typeof v === 'string' && v.length <= 40 && /^\d{4}-\d{2}-\d{2}(T|$)/.test(v) && !Number.isNaN(Date.parse(v))
export function problem(row: unknown, spec: Spec): string | null {
 if (!row || typeof row !== 'object' || Array.isArray(row)) return 'record is not an object'
 const o = row as Record<string, unknown>
 for (const [key, marker] of Object.entries(spec)) {
  if (!(key in o)) return 'required field ' + key + ' is missing'
  const v = o[key]
  if (Array.isArray(marker)) { if (!marker.includes(v as string | null)) return 'field ' + key + ' is not one of the documented values'; continue }
  const nullable = marker.endsWith('?'), kind = nullable ? marker.slice(0, -1) : marker
  if (v === null) { if (!nullable) return 'field ' + key + ' must not be null'; continue }
  const ok = kind === 's' ? typeof v === 'string' && v.length <= 20000 : kind === 'd' ? isDate(v) : kind === 'n' ? typeof v === 'number' && Number.isFinite(v) : kind === 'i' ? Number.isInteger(v) : kind === 'b' ? typeof v === 'boolean' : kind === 'a' ? Array.isArray(v) : typeof v === 'object' && !Array.isArray(v)
  if (!ok) return 'field ' + key + ' has the wrong type'
 }
 return null
}
export const parseJson = (path: string, bytes: Uint8Array): unknown => {
 try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) } catch { throw new Refusal(path + ' is not UTF-8 JSON.') }
}
export const digest = (bytes: Uint8Array) => sha256(bytes)
export const text = (v: unknown): string => typeof v === 'string' ? v : ''
export const pick = (o: Record<string, unknown>, keys: string[]): Json => Object.fromEntries(keys.filter(k => k in o).map(k => [k, o[k] as Json])) as Json
export const emailKey = (email: string) => email.trim().toLowerCase()
