import type { Bindings } from '../../auth.server'
import { auditStatement } from '../door'
// AUTH-001: single sign-on through Base's OpenID Connect providers. A provider
// exists only when its Worker secrets are bound; nothing here stores a secret.
export type Subjects = Record<string, Record<string, string>>
interface Provider { id: string; preset: string; clientId: string; [key: string]: unknown }

const jwk = (text: string | undefined) => { try { const value = JSON.parse(text ?? ''); return value && typeof value === 'object' ? value : null } catch { return null } }

// Google trusts a verified Workspace address; Microsoft Entra ID and Okta name a
// person only through the subject map that SCIM provisioning fills.
export function ssoProviders(env: Bindings, subjects: Subjects = {}): Provider[] {
 const out: Provider[] = []
 if (env.SSO_GOOGLE_CLIENT_ID && env.SSO_GOOGLE_CLIENT_SECRET) out.push({ id: 'google', preset: 'google', label: 'Google Workspace', clientId: env.SSO_GOOGLE_CLIENT_ID, tokenAuthMethod: 'client_secret_basic', clientSecret: env.SSO_GOOGLE_CLIENT_SECRET })
 if (env.SSO_MICROSOFT_TENANT && env.SSO_MICROSOFT_CLIENT_ID && env.SSO_MICROSOFT_CLIENT_SECRET) out.push({ id: 'microsoft', preset: 'microsoft', label: 'Microsoft Entra ID', tenant: env.SSO_MICROSOFT_TENANT, clientId: env.SSO_MICROSOFT_CLIENT_ID, tokenAuthMethod: 'client_secret_basic', clientSecret: env.SSO_MICROSOFT_CLIENT_SECRET, subjectEmails: subjects.microsoft ?? {} })
 // Okta refuses a client_id in the body beside a Basic header, which the shared-secret method sends, so Okta authenticates this app with its private key.
 const key = jwk(env.SSO_OKTA_PRIVATE_KEY)
 if (env.SSO_OKTA_ISSUER && env.SSO_OKTA_CLIENT_ID && key) out.push({ id: 'okta', preset: 'okta', label: 'Okta', issuer: env.SSO_OKTA_ISSUER, clientId: env.SSO_OKTA_CLIENT_ID, tokenAuthMethod: 'private_key_jwt', privateKey: key, subjectEmails: subjects.okta ?? {} })
 return out
}

export async function loadSubjects(env: Bindings): Promise<Subjects> {
 const rows = (await env.DB.prepare('SELECT s.provider,s.subject,s.email FROM sso_subjects s JOIN scim_users u ON u.id=s.scim_user_id WHERE u.active=1').all<{ provider: string; subject: string; email: string }>()).results
 const out: Subjects = {}
 for (const r of rows) (out[r.provider] ??= {})[r.subject] = r.email
 return out
}

// Single sign-on accounts are provisioned by SCIM and enter only through their provider; the owner's email link stays as the audited break-glass door.
export const ssoHooks = (env: Bindings) => ({
 async beforeMagicLink({ email, operator }: { email: string; operator: { role?: string; owner?: boolean } }) {
  if (operator.role === 'owner' || operator.owner) return true
  return !await env.DB.prepare('SELECT 1 FROM scim_users WHERE email=? AND active=1').bind(email.toLowerCase()).first()
 },
})

export const requiresMfa = async (env: Bindings) => !!(await env.DB.prepare('SELECT require_mfa FROM sso_policy WHERE singleton=1').first<{ require_mfa: number }>())?.require_mfa
// What counts as a second factor in an ID token's amr claim.
const factors = new Set(['mfa', 'otp', 'hwk', 'swk', 'sms', 'tel', 'fpt', 'face', 'iris', 'retina', 'vbm', 'pop'])
const claims = (token: string) => { try { return JSON.parse(atob(token.split('.')[1].replaceAll('-', '+').replaceAll('_', '/'))) as { amr?: unknown; sub?: string } } catch { return null } }

// The provider edge, with MFA enforcement: while the owner requires it, a token
// exchange whose ID token does not prove a second factor is refused before Base
// reads it, and the refusal is audited without any token text.
export function mfaFetch(env: Bindings, base: typeof fetch = (input, init) => fetch(input, init)): typeof fetch {
 return async (input, init) => {
  const response = await base(input, init)
  if (init?.method !== 'POST' || !response.ok || !(response.headers.get('content-type') ?? '').includes('json') || !await requiresMfa(env)) return response
  const body = await response.clone().json().catch(() => null) as { id_token?: unknown } | null
  if (typeof body?.id_token !== 'string') return response
  const amr = claims(body.id_token)?.amr
  if (Array.isArray(amr) && amr.some(v => typeof v === 'string' && factors.has(v))) return response
  await auditStatement(env, { id: 'unauthenticated', name: 'Single sign-on', kind: 'system' }, 'auth.sso-refused', 'sso:mfa', new Date(), 'refused', 'The provider did not prove a second factor.').run().catch(() => undefined)
  return Response.json({ error: 'invalid_grant', error_description: 'mfa_required' }, { status: 400 })
 }
}
