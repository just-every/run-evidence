import type { Bindings } from '../../auth.server'
import { Refusal } from '../upload'
import { day } from '../model'
import { desk } from '../storage'
import { obligations } from '../remedy/storage'
// Readable API collections. Each orders by a change time then id so a cursor
// resumes exactly; changed_since filters on the same time.
interface Collection { sql: string; updated: string; decorate?: (env: Bindings, rows: Record<string, unknown>[], now: Date) => Promise<Record<string, unknown>[]> }
export const collections: Record<string, Collection> = {
 programs: { sql: 'SELECT * FROM programs', updated: 'updated_at' },
 controls: { sql: "SELECT c.*,l.library_id,(SELECT MAX(at) FROM control_owners o WHERE o.control_id=c.id) AS owner_changed_at,COALESCE((SELECT MAX(at) FROM control_owners o WHERE o.control_id=c.id),c.created_at) AS changed_at FROM controls c LEFT JOIN library_adoptions l ON l.control_id=c.id", updated: 'changed_at' },
 requirements: { sql: 'SELECT r.* FROM requirements r', updated: 'created_at', decorate: async (env, rows, now) => { const states = new Map((await desk(env, day(now), now)).requirements.map(r => [r.id, r])); return rows.map(r => { const s = states.get(String(r.id)); return { ...r, gap: s?.gap ?? null, due: s?.renewal.due ?? null } }) } },
 'test-results': { sql: 'SELECT o.id,o.run_id,o.test_id,o.revision,o.resource_id,o.result,o.reason,o.source_kind,o.source_ref,o.observed_at,o.exception_id,r.type AS resource_type,r.unique_id FROM observations o JOIN resources r ON r.id=o.resource_id', updated: 'observed_at' },
 tests: { sql: 'SELECT t.*,COALESCE((SELECT MAX(at) FROM test_revisions v WHERE v.test_id=t.id),t.created_at) AS changed_at FROM tests t', updated: 'changed_at' },
 remediation: { sql: "SELECT o.*,COALESCE((SELECT MAX(at) FROM obligation_events e WHERE e.obligation_id=o.id),o.clock_started_at) AS changed_at FROM obligations o", updated: 'changed_at', decorate: async (env, rows, now) => { const states = new Map((await obligations(env, now)).map(o => [o.id, o.sla])); return rows.map(r => ({ ...r, sla: states.get(String(r.id)) ?? null })) } },
 policies: { sql: "SELECT p.id,p.title,p.owner_person_id,p.created_at,p.updated_at,r.version AS published_version,r.effective_date,r.review_due,r.body_sha256 AS published_sha256 FROM policies p LEFT JOIN policy_revisions r ON r.policy_id=p.id AND r.status='published'", updated: 'updated_at' },
 people: { sql: 'SELECT id,name,email,kind,created_at FROM people', updated: 'created_at' },
 vendors: { sql: 'SELECT * FROM vendors', updated: 'updated_at' },
 risks: { sql: 'SELECT * FROM risks', updated: 'updated_at' },
 resources: { sql: 'SELECT id,type,unique_id,display_name,source_kind,source_label,attributes_json,first_seen_at,updated_at,removed_at FROM resources', updated: 'updated_at' },
}
const encode = (value: [string, string]) => btoa(JSON.stringify(value)).replace(/=+$/, '')
const decode = (cursor: string): [string, string] => { try { const v = JSON.parse(atob(cursor)); if (Array.isArray(v) && v.length === 2 && v.every(x => typeof x === 'string')) return v as [string, string] } catch { /* refused below */ } throw new Refusal('Invalid cursor.') }
export async function page(env: Bindings, name: string, params: URLSearchParams, now: Date) {
 const collection = collections[name]
 if (!collection) throw new Refusal('Unknown collection.', 404)
 const limit = params.has('limit') ? Number(params.get('limit')) : 50
 if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw new Refusal('limit is 1 to 200.')
 const since = params.get('changed_since'), cursor = params.get('cursor')
 if (since && !Number.isFinite(Date.parse(since))) throw new Refusal('changed_since must be an ISO 8601 time.')
 const where: string[] = [], binds: string[] = []
 if (since) { where.push(`x.${collection.updated}>=?`); binds.push(new Date(Date.parse(since)).toISOString()) }
 if (cursor) { const [at, id] = decode(cursor); where.push(`(x.${collection.updated}>? OR (x.${collection.updated}=? AND x.id>?))`); binds.push(at, at, id) }
 const rows = (await env.DB.prepare(`SELECT * FROM (${collection.sql}) x${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY x.${collection.updated},x.id LIMIT ?`).bind(...binds, limit + 1).all<Record<string, unknown>>()).results
 const more = rows.length > limit, items = rows.slice(0, limit), last = items.at(-1)
 return { data: collection.decorate ? await collection.decorate(env, items, now) : items, next_cursor: more && last ? encode([String(last[collection.updated]), String(last.id)]) : null }
}
