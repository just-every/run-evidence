import { requireCapability } from '../archive/capabilities'
import type { Bindings } from '../../auth.server'
import { Refusal } from '../upload'
import { auditStatement, oneOf, text, type Actor, type Input } from '../door'
import { publicBase } from '../net'
import { seal, unseal } from '../connect/custody'
import { severities, type Severity } from '../tests/storage'
import { TrackerFailure, type Adapter, type DestinationRef, type Mapping, type Provider } from './client'
import { vector } from './vector'
import { jira } from './jira'
import { linear } from './linear'
import { githubIssues } from './github-issues'
import { asana } from './asana'
import { gitlab } from './gitlab'
import { azureBoards } from './azure-boards'
import { shortcut } from './shortcut'
import { clickup } from './clickup'
import { monday } from './monday'
import { basecamp } from './basecamp'
import { freshservice } from './freshservice'
import { youtrack } from './youtrack'
export const adapters: Record<Provider, Adapter> = { vector, jira, linear, github: githubIssues, asana, gitlab, 'azure-boards': azureBoards, shortcut, clickup, monday, basecamp, freshservice, youtrack }
export const providers = Object.keys(adapters) as Provider[]
// Field rules are fixed and shown with every destination: Evidence owns what it
// writes, the tracker owns who works on it and its status. A change on the
// wrong side is shown as a conflict, never silently overwritten.
export const fieldRules: [string, string][] = [
 ['Title, description and source links', 'Evidence writes them when the ticket is created'],
 ['Priority and labels', 'Evidence sets them from the item severity when the ticket is created'],
 ['Due date', 'Evidence owns it: a change to the target date is written to the tracker; a tracker edit is shown as a conflict'],
 ['Assignee', 'A signed-in owner can write an explicitly mapped tracker identity after a fresh conflict check; this is separate from the Evidence accountable owner'],
 ['Status', 'A signed-in owner can write an explicitly mapped tracker state after a fresh conflict check; closing queues a re-test and never verifies a fix'],
 ['Comments', 'Both ways: Evidence comments are posted to the ticket and tracker comments appear on the obligation'],
]
export interface DestinationRow { id: string; provider: Provider; label: string; api_base: string; account: string; project: string; project_name: string; mapping_json: string; secret_ciphertext: string | null; secret_iv: string | null; hook_ciphertext: string | null; hook_iv: string | null; hook_audience: string; status: 'active' | 'revoked' | 'needs reconnect' | 'inactive after restore'; created_by: string; created_name: string; created_at: string; rotated_at: string | null; revoked_at: string | null; last_success_at: string | null; last_error: string }
export interface TicketRow { id: string; obligation_id: string; destination_id: string; remote_id: string | null; remote_key: string | null; remote_url: string | null; created_at: string; created_name: string; sync_state: string; sync_error: string; remote_status: string; remote_closed: number; remote_assignee: string | null; remote_due: string | null; synced_due: string | null; last_synced_at: string | null; last_attempt_at: string | null; group_id: string | null }
export const destinations = async (env: Bindings) => (await env.DB.prepare('SELECT * FROM tracker_destinations ORDER BY created_at').all<DestinationRow>()).results
export async function requireDestination(env: Bindings, id: string) { const row = await env.DB.prepare('SELECT * FROM tracker_destinations WHERE id=?').bind(id).first<DestinationRow>(); if (!row) throw new Refusal('Destination not found.', 404); return row }
export const safeDestination = (row: DestinationRow) => { const { secret_ciphertext: _a, secret_iv: _b, hook_ciphertext: _c, hook_iv: _d, ...rest } = row; return { ...rest, has_webhook_secret: !!row.hook_ciphertext } }
export function mappingOf(row: Pick<DestinationRow, 'mapping_json' | 'provider'>): Mapping {
 const value = (() => { try { return JSON.parse(row.mapping_json) } catch { return {} } })() as Partial<Mapping>
 return { issue_type: value.issue_type ?? '', due_field: value.due_field ?? 'Microsoft.VSTS.Scheduling.DueDate', labels: value.labels ?? ['evidence', 'compliance'], priorities: { ...adapters[row.provider].defaultPriorities, ...(value.priorities ?? {}) }, assignees: value.assignees ?? {}, statuses: value.statuses ?? {} }
}
export const reference = (row: DestinationRow): DestinationRef => ({ provider: row.provider, api_base: row.api_base, account: row.account, project: row.project, mapping: mappingOf(row) })
export const secretOf = async (env: Bindings, row: DestinationRow) => { await requireCapability(env,'writes',row.id); return row.secret_ciphertext && row.secret_iv ? unseal(env, row.secret_ciphertext, row.secret_iv, row.id) : Promise.reject(new TrackerFailure('unauthorized', 0, 'No credential is held for this destination; reconnect it.')) }
export const hookSecretOf = (env: Bindings, row: DestinationRow) => row.hook_ciphertext && row.hook_iv ? unseal(env, row.hook_ciphertext, row.hook_iv, row.id + ':hook') : Promise.resolve(null)
// Mapping form: issue type, labels, one priority per severity and assignee lines.
function parseMapping(provider: Provider, input: Input): Mapping {
 const labels = String(input.labels ?? 'evidence, compliance').split(',').map(s => s.trim()).filter(Boolean)
 if (labels.length > 10 || labels.some(l => l.length > 50)) throw new Refusal('Use at most ten labels of up to 50 characters.')
 const priorities = Object.fromEntries(severities.map(s => [s, typeof input['priority_' + s] === 'string' && (input['priority_' + s] as string).trim() ? (input['priority_' + s] as string).trim().slice(0, 50) : adapters[provider].defaultPriorities[s]])) as Record<Severity, string>
 const assignees: Record<string, string> = {}
 for (const line of String(input.assignees ?? '').split('\n').map(l => l.trim()).filter(Boolean)) {
  const match = /^([^\s@=]+@[^\s@=]+\.[^\s@=]+)\s*=\s*(\S{1,100})$/.exec(line)
  if (!match) throw new Refusal('Write each assignee as person@example.com = tracker user id.')
  assignees[match[1].toLowerCase()] = match[2]
 }
 const statuses: Record<string,string> = {}
 for (const line of String(input.statuses ?? '').split('\n').map(l=>l.trim()).filter(Boolean)) {
  const match = /^([^=\r\n]{1,100}?)\s*=\s*([^=\r\n]{1,200})$/.exec(line)
  if (!match) throw new Refusal('Write each status as label = native tracker state id or value.')
  statuses[match[1].trim()] = match[2].trim()
 }
 const dueField = text(input, 'due_field', 100, true) || 'Microsoft.VSTS.Scheduling.DueDate'
 if (provider === 'azure-boards' && !/^[A-Za-z][A-Za-z0-9_.]{0,99}$/.test(dueField)) throw new Refusal('Give an Azure date field reference name, such as Custom.RemediationDue.')
 return { issue_type: text(input, 'issue_type', 60, true), due_field: dueField, labels, priorities, assignees, statuses }
}
const randomHex = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('')
// Webhook secrets: Evidence generates one for GitHub and Jira (shown once);
// Linear and Vector generate their own, which the owner pastes here.
async function hookSecret(provider: Provider, input: Input) {
 if (provider === 'github' || provider === 'jira') return { secret: randomHex(), shown: true, audience: '' }
 if (!['vector', 'linear', 'clickup', 'gitlab', 'shortcut', 'azure-boards', 'monday', 'freshservice', 'youtrack'].includes(provider)) return { secret: null, shown: false, audience: '' }
 const pasted = text(input, 'hook_secret', 200, true)
 if (provider === 'vector' && pasted && !/^[0-9a-f]{64,}$/i.test(pasted)) throw new Refusal('Paste the Vector destination signing secret exactly as Vector shows it (hexadecimal).')
 const audience = provider === 'vector' ? text(input, 'hook_audience', 200, true) : ''
 if (provider === 'vector' && pasted && !/^\S{1,100} \S{1,100}$/.test(audience)) throw new Refusal('Give the Vector webhook tenant and destination IDs, separated by a space.')
 return { secret: pasted || null, shown: false, audience }
}
async function check(adapter: Adapter, base: string, secret: string, account: string, project: string) {
 try { return await adapter.verify(base, secret, account, project) }
 catch (error) { if (error instanceof TrackerFailure) throw new Refusal(error.message, error.kind === 'throttled' ? 429 : 400); throw error }
}
// A destination is kept only after a real read of its account and project.
export async function connectDestination(env: Bindings, actor: Actor, input: Input, now: Date) {
 const provider = oneOf(input, 'provider', providers), adapter = adapters[provider]
 const base = publicBase(input.api_base, adapter.defaultBase, adapter.baseLabel), secret = text(input, 'token', 2000), project = text(input, 'project', 200), account = provider === 'jira' ? text(input, 'account', 254) : text(input, 'account', 254, true)
 if (provider === 'jira' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account)) throw new Refusal('Give the Atlassian account email the API token belongs to.')
 const mapping = parseMapping(provider, input), hook = await hookSecret(provider, input)
 const verified = await check(adapter, base, secret, account, project), id = crypto.randomUUID(), sealed = await seal(env, secret, id), sealedHook = hook.secret ? await seal(env, hook.secret, id + ':hook') : null
 await env.DB.batch([
  env.DB.prepare("INSERT INTO tracker_destinations(id,provider,label,api_base,account,project,project_name,mapping_json,secret_ciphertext,secret_iv,hook_ciphertext,hook_iv,hook_audience,status,created_by,created_name,created_at,last_success_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,'active',?,?,?,?)")
   .bind(id, provider, text(input, 'label', 120, true) || `${adapter.name} ${verified.projectName}`, base, provider === 'jira' || provider === 'freshservice' ? account : verified.account, project, verified.projectName, JSON.stringify(mapping), sealed.ciphertext, sealed.iv, sealedHook?.ciphertext ?? null, sealedHook?.iv ?? null, hook.audience, actor.id, actor.name, now.toISOString(), now.toISOString()),
  auditStatement(env, actor, 'tracker.connected', 'tracker:' + id, now, 'succeeded', `${provider} ${verified.projectName}`),
 ])
 return { id, webhook: { url: `${env.AUTH_ORIGIN}/hooks/trackers/${id}`, secret: hook.shown ? hook.secret : null } }
}
export async function rotateDestination(env: Bindings, actor: Actor, id: string, input: Input, now: Date) {
 const row = await requireDestination(env, id), secret = text(input, 'token', 2000)
 await check(adapters[row.provider], row.api_base, secret, row.account, row.project)
 const sealed = await seal(env, secret, id)
 await env.DB.batch([env.DB.prepare("UPDATE tracker_destinations SET secret_ciphertext=?,secret_iv=?,status='active',rotated_at=?,revoked_at=NULL,last_error='' WHERE id=?").bind(sealed.ciphertext, sealed.iv, now.toISOString(), id), auditStatement(env, actor, row.status === 'active' ? 'tracker.rotated' : 'tracker.reconnected', 'tracker:' + id, now)])
}
export async function revokeDestination(env: Bindings, actor: Actor, id: string, now: Date) {
 await requireDestination(env, id)
 await env.DB.batch([env.DB.prepare("UPDATE tracker_destinations SET status='revoked',secret_ciphertext=NULL,secret_iv=NULL,hook_ciphertext=NULL,hook_iv=NULL,revoked_at=? WHERE id=?").bind(now.toISOString(), id), auditStatement(env, actor, 'tracker.revoked', 'tracker:' + id, now)])
}
export async function updateMapping(env: Bindings, actor: Actor, id: string, input: Input, now: Date) {
 const row = await requireDestination(env, id), mapping = parseMapping(row.provider, input)
 await env.DB.batch([env.DB.prepare('UPDATE tracker_destinations SET mapping_json=? WHERE id=?').bind(JSON.stringify(mapping), id), auditStatement(env, actor, 'tracker.mapping', 'tracker:' + id, now)])
}
export const ticketsOf = async (env: Bindings, obligation: string) => (await env.DB.prepare('SELECT t.*,d.provider,d.label AS destination_label FROM tickets t JOIN tracker_destinations d ON d.id=t.destination_id WHERE t.obligation_id=? ORDER BY t.created_at').bind(obligation).all<TicketRow & { provider: Provider; destination_label: string }>()).results
export const ticketEvents = async (env: Bindings, ticket: string) => (await env.DB.prepare("SELECT kind,remote_value,local_value,detail,trigger,at FROM ticket_events WHERE ticket_id=? AND kind<>'comment source' ORDER BY at,rowid").bind(ticket).all<{ kind: string; remote_value: string | null; local_value: string | null; detail: string; trigger: string; at: string }>()).results
export async function requireTicket(env: Bindings, id: string) { const row = await env.DB.prepare('SELECT * FROM tickets WHERE id=?').bind(id).first<TicketRow>(); if (!row) throw new Refusal('Ticket not found.', 404); return row }
