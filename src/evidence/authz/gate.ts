import type { Bindings } from '../../auth.server'
import { doorOf, grantsFor, holds, holdsClass, label, readsRisks, restrictedClassOf, selfApproval, type Delegate } from './roles'
export interface SessionOperator { id: string; email: string; displayName: string; role: string }
export type Verdict = { ok: true; actor: { id: string; name: string }; delegate?: Delegate } | { ok: false; status: number; error: string }
const deny = (status: number, error: string): Verdict => ({ ok: false, status, error })

// The one authorization decision for every owner door. The owner passes; a
// delegate passes only a door its role names, never their own approval, and a
// session whose operator is no longer active never reaches this point.
export async function authorize(env: Bindings, operator: SessionOperator, method: string, path: string): Promise<Verdict> {
 if (operator.role === 'owner') return { ok: true, actor: { id: operator.id, name: operator.displayName } }
 const grants = await grantsFor(env, operator.email)
 if (!grants.length) return deny(403, 'Owner access required.')
 const delegate: Delegate = { email: operator.email.toLowerCase(), id: operator.id, name: operator.displayName, grants }
 const door = doorOf(method, path)
 if (door === 'owner') return deny(403, 'Owner access required.')
 if (!holds(delegate, door) && !(door === 'read' && readsRisks(delegate, path))) return deny(403, 'Your role does not allow this.')
 // Personnel records, findings and connector data stay private until an area grant names them.
 if (door === 'read' || door === 'write') { const cls = restrictedClassOf(path); if (cls && !holdsClass(delegate, cls)) return deny(403, `This is a restricted record area (${cls}). The owner grants it by name.`) }
 if (door === 'approve-policy' || door === 'approve-risk' || door === 'approve-tailoring') if (await selfApproval(env, path, operator.displayName)) return deny(403, 'You cannot approve your own work.')
 return { ok: true, actor: { id: operator.id, name: label(delegate) }, delegate }
}
