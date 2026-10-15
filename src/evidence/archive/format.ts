export const MAGIC = new TextEncoder().encode('EVIDENCE-ARCHIVE\n')
export const VERSION = 2
export const MAX_METADATA = 8 * 1024 * 1024
export const MAX_FILE = 10 * 1024 * 1024
export const MAX_TOTAL = 64 * 1024 * 1024
export class ArchiveError extends Error {}
export function fail(message: string): never { throw new ArchiveError(message) }
export const encoder = new TextEncoder()
export const decoder = new TextDecoder('utf-8', { fatal:true })
export async function sha(bytes: Uint8Array | ArrayBuffer) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as BufferSource)), n => n.toString(16).padStart(2,'0')).join('') }
export function pathOK(path: unknown): asserts path is string {
 if (typeof path !== 'string' || !path || path.length > 500 || /[\\:\x00-\x1f\x7f]/.test(path) || path.startsWith('/') || path.split('/').some(p => !p || p === '.' || p === '..')) fail('Unsafe archive path.')
}
export function u32(n: number) { const bytes = new Uint8Array(4); new DataView(bytes.buffer).setUint32(0,n); return bytes }
export class Reader {
 private reader: ReadableStreamDefaultReader<Uint8Array>
 private chunk: Uint8Array = new Uint8Array(0); private offset = 0
 constructor(body: ReadableStream<Uint8Array>) { this.reader = body.getReader() }
 async read(size: number) {
  const out = new Uint8Array(size); let at = 0
  while (at < size) {
   if (this.offset === this.chunk.length) { const next = await this.reader.read(); if (next.done) fail('Archive is truncated.'); this.chunk = next.value; this.offset = 0 }
   const count = Math.min(size-at,this.chunk.length-this.offset); out.set(this.chunk.subarray(this.offset,this.offset+count),at); at += count; this.offset += count
  }
  return out
 }
 async number() { return new DataView((await this.read(4)).buffer).getUint32(0) }
 async end() { if (this.offset !== this.chunk.length || !(await this.reader.read()).done) fail('Unexpected extra archive entry or bytes.') }
 async close() { try { while(!(await this.reader.read()).done) { /* Drain without buffering so HTTP refusals remain readable. */ } } catch { /* Transport already ended. */ } finally { this.reader.releaseLock() } }
}
export function stream(generator: AsyncGenerator<Uint8Array>) { return new ReadableStream<Uint8Array>({ async pull(controller) { try { const next = await generator.next(); if(next.done) controller.close(); else controller.enqueue(next.value) } catch(error) { controller.error(error) } }, async cancel() { await generator.return(undefined) } }) }
export type Row = Record<string, string | number | null>
export const columns = {
 controls:['id','name','group_name','created_at'], requirements:['id','control_id','name','cadence','created_at'],
 exhibits:['id','object_key','filename','size','media_type'], receipt_actors:['id','display_name'],
 receipts:['id','requirement_id','exhibit_id','origin','source','covered_from','covered_to','added_by','added_by_name','added_at','sha256','supersedes'],
 review_folders:['id','reviewer_label','period_from','period_to','expires_at','created_at','closed_at'],
 review_folder_controls:['folder_id','control_id'], review_events:['id','folder_id','exhibit_id','action','outcome','occurred_at'],
} as const
export type Table = keyof typeof columns
export const tables = Object.keys(columns) as Table[]
export interface FileEntry { path:string; exhibit_id:string; size:number; sha256:string; available:boolean; reason?:string }
import type { Extensions } from './extensions'
export interface Manifest { extensions?:Extensions; format:'evidence-custody'; version:number; created_at:string; rows:Record<Table,Row[]>; files:FileEntry[] }
