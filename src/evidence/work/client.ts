import { scopedFetch } from '../ops/execution'
import type { Severity } from '../tests/storage'
// WORK-001 tracker adapters share one HTTP edge. Failures are classified, never
// guessed: a lost credential, a deleted ticket and a refused field mapping are
// each shown on the obligation with the tracker's own reason.
export type Provider = 'vector' | 'jira' | 'linear' | 'github' | 'asana' | 'gitlab' | 'azure-boards' | 'shortcut' | 'clickup' | 'monday' | 'basecamp' | 'freshservice' | 'youtrack'
export type FailureKind = 'unauthorized' | 'not found' | 'invalid' | 'throttled' | 'unavailable'
export class TrackerFailure extends Error { constructor(public kind: FailureKind, public status: number, message: string, public body: unknown = null) { super(message) } }
export interface Mapping { issue_type: string; due_field: string; labels: string[]; priorities: Record<Severity, string>; assignees: Record<string, string>; statuses?: Record<string, string> }
export interface DestinationRef { provider: Provider; api_base: string; account: string; project: string; mapping: Mapping }
export interface Draft { title: string; description: string; priority: string; due: string | null; labels: string[]; assignee: string | null }
export interface RemoteComment { id: string; author: string; body: string; at: string }
// Native identities are separate from display labels. Null means the provider did
// not supply an identity; [] means explicitly unassigned. Never guess a write's
// conflict baseline from a display name (multiple people can share one).
export interface FieldChanges { assignee?: string | null; status?: string }
export interface Remote { status_id: string | null; assignee_ids: string[] | null; status: string; closed: boolean; assignee: string | null; due: string | null; comments: RemoteComment[] }
export interface TicketRef { remote_id: string; remote_key: string }
export interface Created { id: string; key: string; url: string }
export interface HookRef { delivery: string; ref: string }
export interface Adapter {
 name: string
 // What the owner creates at the tracker, and the least authority it needs.
 credential: string; permissions: string; projectLabel: string; baseLabel: string; defaultBase: string
 supportsDue: boolean; commentText: boolean; webhook: string; fieldNotes?: string
 defaultPriorities: Record<Severity, string>
 verify(base: string, secret: string, account: string, project: string): Promise<{ account: string; projectName: string }>
 create(d: DestinationRef, secret: string, draft: Draft): Promise<Created>
 read(d: DestinationRef, secret: string, t: TicketRef): Promise<Remote>
 comment(d: DestinationRef, secret: string, t: TicketRef, body: string): Promise<string>
 // Values have already been selected from the owner’s explicit mapping.
 // Omitted fields stay unchanged; null assignee clears the native assignment.
 setFields(d: DestinationRef, secret: string, t: TicketRef, fields: FieldChanges, lastRead?: Remote): Promise<void>
 setDue(d: DestinationRef, secret: string, t: TicketRef, due: string | null): Promise<void>
 // Move a closed ticket back to an open state (WORK-002 whole-test follow-through).
 reopen(d: DestinationRef, secret: string, t: TicketRef): Promise<void>
}
const short = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, 300)
// One call to a tracker. Bodies are parsed as JSON when they are JSON.
export async function call(url: string, init: RequestInit & { label: string }) {
 let response: Response
 try { response = await scopedFetch(url, { ...init, redirect: 'manual' }) } catch { throw new TrackerFailure('unavailable', 0, `${init.label} could not be reached.`) }
 let body: unknown = null
 const text = await response.text()
 try { body = text ? JSON.parse(text) : null } catch { body = text }
 if (response.status === 429 || (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0')) throw new TrackerFailure('throttled', response.status, `${init.label} is rate limiting this credential.`)
 if (response.status === 401 || response.status === 403) throw new TrackerFailure('unauthorized', response.status, `${init.label} refused the credential (${response.status}); reconnect with a new one.`)
 if (response.status === 404 || response.status === 410) throw new TrackerFailure('not found', response.status, `${init.label} has no such record (${response.status}).`)
 if (response.status === 400 || response.status === 409 || response.status === 422) throw new TrackerFailure('invalid', response.status, `${init.label} refused the request: ${short(problem(body)) || response.status}`, body)
 if (response.status >= 300) throw new TrackerFailure('unavailable', response.status, `${init.label} answered ${response.status}.`)
 return { status: response.status, body: body as Record<string, unknown>, headers: response.headers }
}
// Field-level reasons as trackers return them, without echoing credentials.
function problem(body: unknown): string {
 if (!body || typeof body !== 'object') return typeof body === 'string' ? body : ''
 const b = body as Record<string, unknown>
 if (b.errors && typeof b.errors === 'object' && !Array.isArray(b.errors)) return Object.entries(b.errors as Record<string, unknown>).map(([k, v]) => `${k}: ${short(v)}`).join('; ')
 if (Array.isArray(b.errors)) return b.errors.map(e => typeof e === 'object' && e ? short((e as Record<string, unknown>).message ?? JSON.stringify(e)) : short(e)).join('; ')
 if (Array.isArray(b.errorMessages) && b.errorMessages.length) return b.errorMessages.map(short).join('; ')
 return short(b.message ?? b.error ?? '')
}
export const dateOnly = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null

export const nativeId = (value: unknown): string | null => (typeof value === 'string' && value.length > 0) || (typeof value === 'number' && Number.isFinite(value)) ? String(value) : null
export function nativeIds(values: unknown): string[] | null {
 if (!Array.isArray(values)) return null
 const ids = values.map(nativeId)
 return ids.some(id => id === null) ? null : [...new Set(ids as string[])].sort()
}
export function numericField(value: string, provider: string): number {
 if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) <= 0) throw new TrackerFailure('invalid', 400, provider + ' needs a positive native numeric field identity.')
 return Number(value)
}
export function stateValue(value: string, allowed: string[], provider: string): string {
 if (!allowed.includes(value)) throw new TrackerFailure('invalid', 400, provider + ' status mapping must be one of: ' + allowed.join(', ') + '.')
 return value
}

// Adapters that need a second native read must retain the parent's conflict
// baseline, rather than silently adopting a newer identity before the write.
export function assertFieldBaseline(previous: Remote | undefined, current: Pick<Remote, 'status_id' | 'assignee_ids'>, fields: FieldChanges, provider: string): void {
 if (!previous) return
 const changedAssignee = fields.assignee !== undefined && (current.assignee_ids === null || previous.assignee_ids === null || JSON.stringify([...current.assignee_ids].sort()) !== JSON.stringify([...previous.assignee_ids].sort()))
 const changedStatus = fields.status !== undefined && (current.status_id === null || previous.status_id === null || current.status_id !== previous.status_id)
 if (changedAssignee || changedStatus) throw new TrackerFailure('invalid', 409, provider + ' changed the selected fields after the owner read; read the current values before writing.')
}
