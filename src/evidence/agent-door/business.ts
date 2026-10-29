import { authConfig, runtimeBindings, type Bindings } from '../../auth.server.ts'
import { operatorMail } from '../../mail.server.mjs'
import { createBusinessSettings } from '../../modules/business-settings/index.ts'
import { SettingsError, type BusinessManifest, type ManagedMember, type Statement, type TeamAdapter } from '../../modules/business-settings/types.ts'
import { trust as validateTrust } from '../../modules/business-settings/validation.ts'
// These copied OA utilities have no declaration files; use their real native protocol.
// @ts-expect-error Copied JavaScript utility has no accompanying declaration.
import { configure } from '../../modules/operator-auth/config.mjs'
// @ts-expect-error Copied JavaScript utility has no accompanying declaration.
import { hashToken, opaqueToken } from '../../modules/operator-auth/crypto.mjs'
// @ts-expect-error Copied JavaScript utility has no accompanying declaration.
import { linkMessage } from '../../modules/operator-auth/identity/email-link/message.mjs'
import type { AuthConfig, Operator } from '../../modules/operator-auth/index.mjs'
import { installationOwner } from './people.ts'
import type { Trust as DoorTrust } from '../../modules/agent-door/types.ts'

export type BusinessBindings = Bindings & { RER_BUSINESS_TRUST?: string }
export const businessManifest: BusinessManifest = {
 settings: 1, values: ['display_name'], team: { roles: { admin: 'member', member: 'member' } },
}

/** Agent credentials use the installation's existing owner-claim verification ring. */
export function doorTrust(original: BusinessBindings): DoorTrust | null {
 const env = runtimeBindings(original)
 if (!env.RER_OWNER_CLAIM_PUBLIC_KEYS) return null
 let publicKeys: Record<string, JsonWebKey>
 try { publicKeys = JSON.parse(env.RER_OWNER_CLAIM_PUBLIC_KEYS) } catch { throw new SettingsError('invalid_trust', 503) }
 if (!env.RER_OWNER_CLAIM_ISSUER || !env.RER_OWNER_CLAIM_INSTALLATION_ID ||
  !publicKeys || typeof publicKeys !== 'object' || Array.isArray(publicKeys) || !Object.keys(publicKeys).length ||
  Object.values(publicKeys).some(key => !key || key.kty !== 'EC' || key.crv !== 'P-256' || !key.x || !key.y || Object.hasOwn(key, 'd'))) {
  throw new SettingsError('invalid_trust', 503)
 }
 return { issuer: env.RER_OWNER_CLAIM_ISSUER, installationId: env.RER_OWNER_CLAIM_INSTALLATION_ID, appOrigin: env.AUTH_ORIGIN, publicKeys }
}

function businessTrust(env: BusinessBindings) {
 if (!env.RER_BUSINESS_TRUST) return null
 const trust = validateTrust(env.RER_BUSINESS_TRUST)
 let ring: Record<string, JsonWebKey>
 try { ring = JSON.parse(env.RER_OWNER_CLAIM_PUBLIC_KEYS ?? '') } catch { throw new SettingsError('invalid_trust', 503) }
 if (!ring || trust.issuer !== env.RER_OWNER_CLAIM_ISSUER ||
  trust.subject !== env.RER_OWNER_CLAIM_INSTALLATION_ID ||
  trust.audience !== 'self-host' && trust.audience !== env.AUTH_ORIGIN ||
  Object.entries(trust.keys).some(([id, key]) => !ring[id] || ['kty', 'crv', 'x', 'y'].some(field => key[field as keyof JsonWebKey] !== ring[id][field as keyof JsonWebKey]))) {
  throw new SettingsError('invalid_trust', 503)
 }
 return trust
}

/** Prepare real OA invitations and membership writes in the settings batch. */
export function evidenceBusinessTeam(env: Bindings): TeamAdapter {
 const db = env.DB, config = configure(authConfig(env)) as AuthConfig & { invitationSeconds: number }
 const read = (id: string) => db.prepare('SELECT id,email,display_name AS displayName,role,status,version,created_at AS createdAt FROM oa_operators WHERE id=?').bind(id).first<Operator>()
 return {
  async ownerEmail() { return (await installationOwner(db))?.email ?? null },
  async prepare({ members, managed, ownerEmail, roles, guard }) {
   if (roles.admin !== 'member' || roles.member !== 'member') throw new SettingsError('business_team_denied')
   const owner = await installationOwner(db)
   if (!owner || owner.email !== ownerEmail) throw new SettingsError('owner_required')
   const now = Date.now(), statements: Statement[] = [], rows: ManagedMember[] = []
   const deliveries: { id: string; token: string; hash: string; kind: 'invite'; returnTo: string; expiresAt: number; email: string }[] = []
   const fence = { sql: `(${guard.sql}) AND EXISTS(SELECT 1 FROM oa_bootstrap b JOIN oa_operators o ON o.id=b.claim_id
    WHERE b.singleton=1 AND o.id=? AND o.version=? AND o.email=? AND o.role='owner' AND o.status='active')`,
    args: [...guard.args, owner.id, owner.version, owner.email] }
   const assert = (sql: string, args: unknown[] = []) => statements.push(db.prepare(`INSERT INTO bs_assert(value) SELECT CASE WHEN ${sql} THEN 1 ELSE NULL END`).bind(...args))
   const audit = (action: string, id: string) => statements.push(db.prepare(`INSERT INTO oa_auth_audit(id,actor_id,action,value,created_at) SELECT ?,?,?,?,? WHERE ${fence.sql}`)
    .bind(crypto.randomUUID(), owner.id, action, JSON.stringify({ operatorId: id, via: 'via Business', ownerId: owner.id }), now, ...fence.args))
   assert(fence.sql, fence.args)
   const desired = new Map(members.map(member => [member.email, member]))
   const previous = new Map(managed.map(row => [row.email, row]))
   for (const email of new Set([...desired.keys(), ...previous.keys()])) {
    const member = desired.get(email), prior = previous.get(email)
    let target = prior?.operatorId ? await read(prior.operatorId) : await db.prepare('SELECT id,email,display_name AS displayName,role,status,version,created_at AS createdAt FROM oa_operators WHERE email=?').bind(email).first<Operator>()
    const dedicated = target ? await db.prepare('SELECT 1 FROM audit_identities WHERE email=?').bind(target.email.toLowerCase()).first() : null
    if (email === owner.email || target?.role === 'owner' || dedicated || prior?.state === 'conflict' ||
     !prior?.operatorId && target || prior?.operatorId && !target) {
     rows.push({ email, operatorId: prior?.operatorId ?? null, invite: member?.invite ?? prior?.invite ?? 0, state: 'conflict' })
     continue
    }
    if (!member && !target) {
     if (prior) rows.push(prior)
     continue
    }
    if (target) assert(`EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND email=? AND version=? AND role=? AND status=?) AND NOT EXISTS(SELECT 1 FROM audit_identities WHERE email=?)`, [target.id, target.email, target.version, target.role, target.status, target.email.toLowerCase()])
    else assert('NOT EXISTS(SELECT 1 FROM audit_identities WHERE email=?)', [email])
    if (!member) {
     if (target!.status !== 'inactive') {
      statements.push(db.prepare(`UPDATE oa_operators SET status='inactive' WHERE id=? AND version=? AND role!='owner' AND ${fence.sql}`).bind(target!.id, target!.version, ...fence.args))
      assert('changes()=1')
      audit('operators:deactivate', target!.id)
     }
     rows.push({ email, operatorId: target!.id, invite: prior!.invite, state: 'inactive' })
     continue
    }
    const cancelled = target?.status === 'inactive' && !!await db.prepare('SELECT 1 FROM oa_invitation_cancellations WHERE operator_id=?').bind(target.id).first()
    const invite = !target || cancelled || target.status === 'invited' && (member.invite > (prior?.invite ?? -1) || target.role !== 'member')
    if (target) {
     const status = cancelled ? 'invited' : target.status === 'inactive' ? 'active' : target.status
     const changed = target.role !== 'member' || target.status !== status
     if (changed || target.displayName !== member.name) {
      statements.push(db.prepare(`UPDATE oa_operators SET role='member',status=?,display_name=? WHERE id=? AND version=? AND role!='owner' AND ${fence.sql}`)
       .bind(status, member.name, target.id, target.version, ...fence.args))
      assert('changes()=1')
      audit('operators:role', target.id)
      target = { ...target, role: 'member', status, displayName: member.name, version: target.version + (changed ? 1 : 0) }
     }
    } else {
     target = { id: crypto.randomUUID(), email, displayName: member.name, role: 'member', status: 'invited', version: 1, createdAt: now }
     statements.push(db.prepare(`INSERT INTO oa_operators(id,email,display_name,role,status,created_at) SELECT ?,?,?,'member','invited',? WHERE ${fence.sql}`)
      .bind(target.id, email, member.name, now, ...fence.args))
     assert('changes()=1')
     audit('operators:invite', target.id)
    }
    if (invite) {
     const token = opaqueToken(), id = crypto.randomUUID(), hash = await hashToken(config.SESSION_SECRET, 'link', token)
     const invitation = { id, token, hash, kind: 'invite' as const, returnTo: '/me', expiresAt: now + config.invitationSeconds * 1000, email: target.email }
     statements.push(db.prepare(`INSERT INTO oa_tokens(id,token_hash,kind,operator_id,operator_version,issuer_id,issuer_version,return_to,created_at,expires_at)
      SELECT ?,?,'invite',id,version,?,?,?,?,? FROM oa_operators WHERE id=? AND version=? AND status='invited' AND role='member' AND ${fence.sql}`)
      .bind(id, hash, owner.id, owner.version, invitation.returnTo, now, invitation.expiresAt, target.id, target.version, ...fence.args))
     assert('changes()=1')
     statements.push(db.prepare(`UPDATE oa_tokens SET revoked_at=? WHERE operator_id=? AND id!=? AND consumed_at IS NULL AND ${fence.sql}`).bind(now, target.id, id, ...fence.args))
     audit('operators:invite', target.id)
     deliveries.push(invitation)
    }
    rows.push({ email, operatorId: target.id, invite: member.invite, state: target.status })
   }
   return { statements, rows, async afterCommit() {
    const sender = operatorMail(env)
    for (const invitation of deliveries) {
     try {
      if (!sender || !config.MAIL_FROM) throw new Error('mail_unavailable')
      const url = new URL('/auth/confirm', config.origin)
      url.searchParams.set('token', invitation.token)
      const result = await sender.send({ deliveryId: invitation.id, from: config.MAIL_FROM, to: [invitation.email], ...linkMessage(config, invitation, url.href), headers: { 'Auto-Submitted': 'auto-generated' } })
      if (result.status !== 'accepted' && !(result.status === 'development' && config.local)) throw new Error('mail_unavailable')
     } catch {
      await db.prepare('UPDATE oa_tokens SET revoked_at=? WHERE id=?').bind(Date.now(), invitation.id).run()
      throw new SettingsError('invitation_delivery_failed', 503)
     }
    }
   } }
  },
 }
}

export function businessSettings(original: BusinessBindings) {
 const env = runtimeBindings(original) as BusinessBindings
 return createBusinessSettings({ db: env.DB, trust: businessTrust(env), business: businessManifest, team: evidenceBusinessTeam(env) })
}
