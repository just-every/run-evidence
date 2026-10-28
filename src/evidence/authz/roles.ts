import type { Bindings } from '../../auth.server'
// AUTH-001: the delegated role model. Deny by default: a door that is not
// named here stays owner-only, and the installation owner holds every door.
export const roles = ['administrator', 'compliance_manager', 'control_owner', 'contributor', 'risk_approver'] as const
export type Role = typeof roles[number]
export const scopeKinds = ['business', 'team', 'control', 'area'] as const
// Record classes that stay private to the owner until an area grant names them (SECURE-001).
export const restrictedClasses = ['personnel', 'findings', 'connector-data'] as const
const restrictedAreas: Record<string, typeof restrictedClasses[number]> = { people: 'personnel', handover: 'personnel', attestations: 'personnel', training: 'personnel', 'access-reviews': 'personnel', vulnerabilities: 'findings', remediation: 'findings', identities: 'connector-data', populations: 'connector-data' }
export const restrictedClassOf = (path: string) => restrictedAreas[/^\/(?:app|api)\/([a-z-]+)/.exec(path)?.[1] ?? ''] ?? null
export type ScopeKind = typeof scopeKinds[number]
export interface Grant { id: string; email: string; role: Role; scope_kind: ScopeKind; scope_ref: string; source: 'owner' | 'scim'; granted_name: string; reason: string; granted_at: string }
// Roles whose authority is limited to named controls or a team's controls.
export const scopedRoles: readonly Role[] = ['control_owner', 'contributor']
// Roles an administrator may hand out; only the owner grants administrator.
export const delegableByAdministrator: readonly Role[] = ['compliance_manager', 'control_owner', 'contributor', 'risk_approver']

// The program areas a delegated manager reads and writes. Connections, trackers,
// collectors, tokens, archives, erasure, trust, audit engagements, agents and
// operations are not listed: they stay with the owner.
const areas = 'tailoring|programs|controls|frameworks|tests|remediation|vulnerabilities|policies|people|vendors|risks|access-reviews|attestations|training|populations|handover|library|reviews|identities'
const areaPath = new RegExp(`^/(?:app|api)/(?:${areas})(?:/|$)`)
const approvalPath = /\/(?:decision|acceptances)$/
const policyDecision = /^\/(?:app|api)\/policies\/([a-f0-9-]{36})\/revisions\/([a-f0-9-]{36})\/decision$/
const tailoringDecision = /^\/(?:app|api)\/tailoring\/([a-f0-9-]{36})\/decision$/
const riskAcceptance = /^\/(?:app|api)\/risks\/([a-f0-9-]{36})\/acceptances$/
export const rolesPath = /^\/(?:app|api)\/roles(?:\/|$)/
const exportPath = /(?:\/export|\.csv|\.xlsx)(?:$|\?)/

export type Door = 'privacy' | 'owner' | 'evidence' | 'read' | 'write' | 'approve-policy' | 'approve-risk' | 'approve-tailoring' | 'roles'
// The proof desk: requirements, receipts and uploads. Scoped roles reach only their controls here.
const evidencePath = /^\/(?:app|api\/desk|app\/requirements\/[a-f0-9-]{36}(?:\/uploads)?|(?:app|api)\/receipts\/[a-f0-9-]{36}(?:\/download)?)$/
export function doorOf(method: string, path: string): Door {
 if (/^\/(?:app|api)\/privacy(?:\/|$)/.test(path)) return 'privacy'
 if (rolesPath.test(path)) return 'roles'
 if (evidencePath.test(path) && (['GET', 'HEAD'].includes(method) || path.endsWith('/uploads'))) return 'evidence'
 if (exportPath.test(path)) return 'owner'
 if (policyDecision.test(path) && method === 'POST') return 'approve-policy'
 if (riskAcceptance.test(path) && method === 'POST') return 'approve-risk'
 if (tailoringDecision.test(path) && method === 'POST') return 'approve-tailoring'
 if (approvalPath.test(path) || !areaPath.test(path)) return 'owner'
 return ['GET', 'HEAD'].includes(method) ? 'read' : 'write'
}
const allowed: Record<Door, readonly Role[]> = {
 privacy: [],
 owner: [],
 evidence: ['administrator', 'compliance_manager', 'control_owner', 'contributor'],
 read: ['administrator', 'compliance_manager'],
 write: ['administrator', 'compliance_manager'],
 'approve-policy': ['administrator', 'compliance_manager'],
 'approve-risk': ['administrator', 'compliance_manager', 'risk_approver'],
 'approve-tailoring': ['administrator', 'compliance_manager'],
 // Risk approvers also read the risk register they decide on.
 roles: ['administrator'],
}
export interface Delegate { email: string; id: string; name: string; grants: Grant[] }
export const holdsClass = (who: Delegate, cls: typeof restrictedClasses[number]) => who.grants.some(g => g.scope_kind === 'area' && g.scope_ref === cls && ['administrator', 'compliance_manager'].includes(g.role))
export const holds = (who: Delegate, door: Door) => who.grants.some(g => allowed[door].includes(g.role) && (g.scope_kind === 'business' || (door === 'evidence' && scopedRoles.includes(g.role))))
// Managers see every control; scoped roles only those their grants name.
export const unrestricted = (who: Delegate) => who.grants.some(g => ['administrator', 'compliance_manager'].includes(g.role) && g.scope_kind === 'business')
// A risk approver reads risks, and nothing else, without a business grant.
export const readsRisks = (who: Delegate, path: string) => who.grants.some(g => g.role === 'risk_approver') && /^\/(?:app|api)\/risks(?:\/|$)/.test(path)
export const label = (who: Delegate) => `${who.name} (${[...new Set(who.grants.map(g => g.role))].join(', ')})`

export async function grantsFor(env: Bindings, email: string) {
 return (await env.DB.prepare('SELECT id,email,role,scope_kind,scope_ref,source,granted_name,reason,granted_at FROM access_grants WHERE email=? AND revoked_at IS NULL ORDER BY granted_at,id').bind(email.toLowerCase()).all<Grant>()).results
}
// Two people may not close their own work: the policy drafter cannot approve the
// draft and the residual assessor cannot accept the residual risk.
export async function selfApproval(env: Bindings, path: string, name: string) {
 // Delegates are recorded as "Name (role)", the owner as "Name"; either way it is the same person.
 const same = (recorded?: string | null) => !!recorded && (recorded === name || recorded.startsWith(name + ' ('))
 const policy = policyDecision.exec(path)
 if (policy) return same((await env.DB.prepare('SELECT drafted_by FROM policy_revisions WHERE id=?').bind(policy[2]).first<{ drafted_by: string }>())?.drafted_by)
 const tailoring = tailoringDecision.exec(path)
 if (tailoring) return same((await env.DB.prepare('SELECT created_by FROM tailoring_proposals WHERE id=?').bind(tailoring[1]).first<{ created_by: string }>())?.created_by)
 const risk = riskAcceptance.exec(path)
 if (risk) return same((await env.DB.prepare("SELECT actor_name FROM risk_assessments WHERE risk_id=? AND kind='residual' ORDER BY at DESC,rowid DESC LIMIT 1").bind(risk[1]).first<{ actor_name: string }>())?.actor_name)
 return false
}
// The controls a scoped role reaches: a business-scope grant follows the
// person's current control assignments (owner for a control owner, contributor
// for a contributor); control and team grants name more. Revoking the
// assignment or the grant ends the reach on the next request.
export async function scopedControls(env: Bindings, who: Delegate) {
 const ids = new Set<string>()
 for (const g of who.grants.filter(g => scopedRoles.includes(g.role))) {
  if (g.scope_kind === 'control') ids.add(g.scope_ref)
  if (g.scope_kind === 'team') for (const r of (await env.DB.prepare('SELECT control_id FROM control_teams WHERE team=?').bind(g.scope_ref).all<{ control_id: string }>()).results) ids.add(r.control_id)
  if (g.scope_kind === 'business') {
   const rows = (await env.DB.prepare('SELECT o.control_id,o.owner_person_id,o.contributors,p.id AS me FROM control_owners o JOIN people p ON p.email=? WHERE o.rowid=(SELECT MAX(rowid) FROM control_owners WHERE control_id=o.control_id)').bind(who.email).all<{ control_id: string; owner_person_id: string; contributors: string; me: string }>()).results
   for (const r of rows) if (g.role === 'control_owner' ? r.owner_person_id === r.me : (JSON.parse(r.contributors) as string[]).includes(r.me)) ids.add(r.control_id)
  }
 }
 return ids
}
