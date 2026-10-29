import { grantsFor } from './evidence/authz/roles'
import { firstRunResponse } from './base/setup'
import { fontDocumentResponse } from './base/font-response'
import { createOperatorAuth, createAuthHandler, createSignInHandler, devNotFound, type AuthConfig } from './modules/operator-auth/index.mjs'
import { operatorMail } from './mail.server.mjs'
import { createOwnerClaimHandler } from './modules/owner-claim/index.mjs'
import branding from './branding.json'
import { auditedAuthentication } from './evidence/audit/auth'
import { loadSubjects, mfaFetch, ssoHooks, ssoProviders, type Subjects } from './evidence/authz/sso'
import { authFailurePage } from './evidence/member-frame'

// The edition's declared theme (public/rer-theme.css), as Base frames link it.
const theme = { href: '/rer-theme.css', productName: branding.name, accentColor: branding.primaryColor }

export interface Bindings {
 ASSETS?: Fetcher
 RER_DEPLOY_SOURCE?: string
 RER_DEPLOY_FINGERPRINT?: string
 RER_VERSION?: { id: string }
 DB: D1Database
 EXHIBITS: R2Bucket
 AUTH_ORIGIN: string
 AUTH_LOCAL?: string
 RER_DEV_ORIGIN?: string
 /** Local runtimes only: the checkout's key gate and dev identity switch. Deploy refuses both. */
 RER_DEV_KEY?: string
 RER_DEV_IDENTITY?: string
 RER_INSTALLATION_ID?: string
 RER_MANAGEMENT_ORIGIN?: string
 OWNER_EMAIL: string
 SESSION_SECRET: string
 SETUP_TOKEN?: string
 MAIL_PROVIDER?: 'development' | 'rer' | 'resend' | 'sendgrid' | 'cloudflare'
 MAIL_RELAY_URL?: string
 MAIL_FROM?: string
 MAIL_API_KEY?: string
 MAIL_ACCOUNT_ID?: string
 RER_OWNER_CLAIM_ISSUER?: string
 RER_OWNER_CLAIM_INSTALLATION_ID?: string
 RER_OWNER_CLAIM_PUBLIC_KEYS?: string
 RER_BUSINESS_TRUST?: string
 RER_DEMO?: string
 /** AUTH-001 single sign-on: each provider is offered only when all of its bindings exist. */
 OIDC_TRANSACTION_SECRET?: string
 /** SECURE-001 key custody: named keys as JSON, the key new secrets use, and the switch that retires the session-derived key. */
 CUSTODY_KEYS?: string
 CUSTODY_CURRENT?: string
 CUSTODY_SESSION_KEY_RETIRED?: string
 SSO_GOOGLE_CLIENT_ID?: string
 SSO_GOOGLE_CLIENT_SECRET?: string
 SSO_MICROSOFT_TENANT?: string
 SSO_MICROSOFT_CLIENT_ID?: string
 SSO_MICROSOFT_CLIENT_SECRET?: string
 SSO_OKTA_ISSUER?: string
 SSO_OKTA_CLIENT_ID?: string
 SSO_OKTA_PRIVATE_KEY?: string
}

export const runtimeBindings = (env: Bindings): Bindings => env.RER_DEV_ORIGIN && env.AUTH_LOCAL === 'true' ? { ...env, AUTH_ORIGIN: env.RER_DEV_ORIGIN } : env
export const authConfig = (env: Bindings): AuthConfig => ({ origin: env.AUTH_ORIGIN, local: env.AUTH_LOCAL === 'true', OWNER_EMAIL: env.OWNER_EMAIL, SESSION_SECRET: env.SESSION_SECRET, SETUP_TOKEN: env.SETUP_TOKEN, MAIL_FROM: env.MAIL_FROM, branding: { productName: branding.name, accentColor: branding.primaryColor, signInPath: '/signin', theme: theme.href } })
export function operatorAuth(env: Bindings, subjects: Subjects = {}) {
 const providers = ssoProviders(env, subjects), sso = providers.length > 0 && !!env.OIDC_TRANSACTION_SECRET
 return createOperatorAuth({ db: env.DB, config: { ...authConfig(env), ...(sso ? { providers, OIDC_TRANSACTION_SECRET: env.OIDC_TRANSACTION_SECRET } : {}) } as AuthConfig, mailSender: operatorMail(env), clientIp: request => request.headers.get('CF-Connecting-IP') ?? '', hooks: ssoHooks(env), ...(sso ? { fetch: mfaFetch(env) } : {}) })
}

// LOG-001: every write through the sign-in, first-run and owner-claim doors is
// audited with what it changed (src/evidence/audit/auth.ts).
export async function authResponse(request: Request, original: Bindings, clock: () => Date = () => new Date()): Promise<Response | null> {
 const env = runtimeBindings(original), url = new URL(request.url)
 if (url.pathname.startsWith('/__dev/')) return devNotFound()
 if (['GET', 'HEAD'].includes(request.method) && ['/app', '/setup'].includes(url.pathname)) {
  const session = await operatorAuth(env).getSession(request)
  if (session?.operator.role === 'member' && !(await grantsFor(env, session.operator.email)).length) return new Response(null, { status: 303, headers: { location: '/me', 'cache-control': 'no-store' } })
 }
 if (['GET', 'HEAD'].includes(request.method) || !(url.pathname.startsWith('/auth/') || url.pathname === '/signin' || url.pathname === '/setup')) return authAnswer(request, env, url)
 const session = await operatorAuth(env).getSession(request).catch(() => null)
 return auditedAuthentication(env, request, session ? { id: session.operator.id, name: session.operator.displayName } : null, clock, () => authAnswer(request, env, url))
}

async function authAnswer(request: Request, env: Bindings, url: URL): Promise<Response | null> {
 // Okta and Entra callbacks resolve their provider subject through the SCIM map.
 const subjects = url.pathname.startsWith('/auth/oidc/') ? await loadSubjects(env).catch(() => ({})) : {}
 // The shared server-rendered sign-in page: plain forms that work before any script.
 if (url.pathname === '/signin') {
  if (['GET', 'HEAD'].includes(request.method) && !url.searchParams.has('returnTo')) {
   const session = await operatorAuth(env, subjects).getSession(request)
   if (session?.operator.role === 'member' && !(await grantsFor(env, session.operator.email)).length) return new Response(null, { status: 303, headers: { location: '/me', 'cache-control': 'no-store' } })
  }
  const page = await createSignInHandler(operatorAuth(env, subjects), {
   defaultReturnTo: '/setup',
  })(request)
  if (page) return fontDocumentResponse(page)
 }
 if (url.pathname === '/auth/owner-claim' && env.RER_OWNER_CLAIM_PUBLIC_KEYS) {
  const claim = createOwnerClaimHandler({ db: env.DB, authConfig: authConfig(env), clientIp: request => request.headers.get('CF-Connecting-IP') ?? '', issuer: env.RER_OWNER_CLAIM_ISSUER ?? '', installationId: env.RER_OWNER_CLAIM_INSTALLATION_ID ?? '', appOrigin: env.AUTH_ORIGIN, expectedEmail: env.OWNER_EMAIL.toLowerCase(), publicKeys: JSON.parse(env.RER_OWNER_CLAIM_PUBLIC_KEYS) })
  return fontDocumentResponse((await claim(request))!)
 }
 if (url.pathname.startsWith('/auth/')) {
  const response = await createAuthHandler(operatorAuth(env, subjects))(request)
  return response ? fontDocumentResponse(await authFailurePage(request, response)) : null
 }
 if (url.pathname === '/setup' || url.pathname === '/app' || url.pathname.startsWith('/app/')) {
  const setup = await firstRunResponse(request, env, operatorAuth(env), { theme })
  if (setup) return setup
 }
 return null
}
