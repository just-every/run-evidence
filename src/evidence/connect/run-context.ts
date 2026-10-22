import type { Bindings } from '../../auth.server'
import { definitions } from '../control-definition/storage'
import { acceptedLibraryRevision } from '../program/library-revision'
import { Refusal } from '../upload'
import type { Connection } from './storage'

// Capture before a source read. Later edits to control meaning, test criteria
// or audit periods must never reinterpret an earlier collection attempt.
export async function collectionContext(env: Bindings, connection: Connection) {
 const identity = ['okta', 'google', 'entra', 'jumpcloud'].includes(connection.provider)
 const types = identity ? 'identity.%' : connection.provider === 'knowbe4' ? 'training.%' : connection.provider + '.%'
 const tests = (await env.DB.prepare("SELECT id,resource_type,revision,criteria_json FROM tests WHERE enabled=1 AND (resource_type LIKE ? OR (? AND resource_type='identity.account')) ORDER BY id LIMIT 1001").bind(types,['github','gitlab'].includes(connection.provider)?1:0).all<{ id: string; resource_type: string; revision: number; criteria_json: string }>()).results
 if (tests.length > 1000) throw new Refusal('Collection context exceeds 1,000 enabled tests; reduce the source test scope.', 409)
 const ids = tests.map(t => t.id)
 const links = (await env.DB.prepare('SELECT DISTINCT control_id FROM test_controls WHERE test_id IN (SELECT value FROM json_each(?)) ORDER BY control_id').bind(JSON.stringify(ids)).all<{ control_id: string }>()).results
 const controls = await Promise.all(links.map(async ({ control_id }) => (await definitions(env, control_id)).at(-1)!))
 const periods = (await env.DB.prepare('SELECT id,name,framework,edition,audit_from,audit_to,(SELECT MAX(revision) FROM program_revisions r WHERE r.program_id=p.id) AS revision FROM programs p ORDER BY id LIMIT 1001').all()).results
 if (periods.length > 1000) throw new Refusal('Collection context exceeds 1,000 programs.', 409)
 const context = { account: connection.account, provider: connection.provider, library_revision: await acceptedLibraryRevision(env), controls, tests, audit_periods: periods }
 if (JSON.stringify(context).length > 180000) throw new Refusal('Collection revision context is too large; no unrecorded collection is allowed.', 409)
 return context
}
