import type { Bindings } from '../../auth.server'
import { Refusal } from '../upload'
// AGENT-006 reviewer-role check: the named security or legal reviewer must hold
// the reviewing authority. The installation owner does; otherwise an active
// account holding administrator or compliance manager for the whole business.
// A name in People alone grants nothing.
export async function requireReviewer(env: Bindings, person: { name: string; email: string }) {
 const email = person.email.toLowerCase()
 const operator = await env.DB.prepare("SELECT role FROM oa_operators WHERE email=? AND status='active'").bind(email).first<{ role: string }>()
 if (operator?.role === 'owner') return 'owner'
 const grant = operator ? await env.DB.prepare("SELECT role FROM access_grants WHERE email=? AND revoked_at IS NULL AND scope_kind='business' AND role IN ('administrator','compliance_manager') ORDER BY role LIMIT 1").bind(email).first<{ role: string }>() : null
 if (!grant) throw new Refusal(`${person.name} holds no security or legal reviewing role. Grant administrator or compliance manager in Access, or name the owner.`, 403)
 return grant.role
}
