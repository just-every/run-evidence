import { operatorAuth, runtimeBindings, type Bindings } from '../../auth.server.ts'
import type { PeopleAdapter, Person } from '../../modules/agent-door/types.ts'
import type { Operator } from '../../modules/operator-auth/index.mjs'

const columns = 'o.id,o.email,o.display_name AS displayName,o.role,o.status,o.version,o.created_at AS createdAt'

/** The claimed installation owner is a durable native ID, never an address match. */
export function installationOwner(db: D1Database): Promise<Operator | null> {
 return db.prepare(`SELECT ${columns} FROM oa_bootstrap b JOIN oa_operators o ON o.id=b.claim_id
  WHERE b.singleton=1 AND o.role='owner' AND o.status='active'`).first<Operator>()
}

export function nativePeople(original: Bindings): PeopleAdapter {
 const env = runtimeBindings(original)
 const read = async (id: string): Promise<Person | null> => {
  const row = await env.DB.prepare(`SELECT ${columns} FROM oa_operators o WHERE o.id=?`).bind(id).first<Operator>()
  if (!row) return null
  // Dedicated audit identities never inherit this product door. A separately
  // promoted OA owner is not the installation's bootstrap owner either.
  if (row.role === 'owner') {
   if ((await installationOwner(env.DB))?.id !== row.id) return null
  } else if (await env.DB.prepare('SELECT 1 FROM audit_identities WHERE email=?').bind(row.email.toLowerCase()).first()) return null
  return { id: row.id, email: row.email, name: row.displayName, role: row.role, active: row.status === 'active' }
 }
 return {
  person: read,
  async session(request) {
   const session = await operatorAuth(env).getSession(request)
   const current = session ? await read(session.operator.id) : null
   return current?.active ? current : null
  },
  async sponsor({ sub }) {
   const settings = await env.DB.prepare('SELECT owner_id FROM bs_settings WHERE singleton=1 AND stopped=0').first<{ owner_id: string | null }>()
   if (settings?.owner_id === sub) {
    const owner = await installationOwner(env.DB)
    return owner ? read(owner.id) : null
   }
   if (!settings) return null
   const row = await env.DB.prepare("SELECT operator_id FROM bs_team WHERE business_id=? AND state IN ('active','invited')").bind(sub).first<{ operator_id: string | null }>()
   return row?.operator_id ? read(row.operator_id) : null
  },
  businessRole: person => person.role === 'owner' ? 'owner' : null,
  async businessMember(person) {
   const settings = await env.DB.prepare('SELECT owner_id FROM bs_settings WHERE singleton=1 AND stopped=0').first<{ owner_id: string | null }>()
   if (!settings) return null
   if (settings.owner_id && (await installationOwner(env.DB))?.id === person.id) return { id: settings.owner_id, role: 'owner' }
   const row = await env.DB.prepare("SELECT business_id,business_role FROM bs_team WHERE operator_id=? AND business_id IS NOT NULL AND state IN ('active','invited')").bind(person.id).first<{ business_id: string; business_role: string }>()
   return row ? { id: row.business_id, role: row.business_role === 'admin' ? 'editor' : null } : null
  },
 }
}
