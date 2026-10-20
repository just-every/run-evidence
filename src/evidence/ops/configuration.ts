import type { Bindings } from '../../auth.server'
import { isLoopbackHost, normalizeEmail } from '../../modules/operator-auth/index.mjs'

// OPS-001: name the broken binding, never its value. These are the existing
// auth/mail modules' configuration rules, checked before any runtime effects.
export function configurationFailures(env: Bindings): string[] {
 const failures: string[] = []
 const bad = (name: string) => failures.push(name)
 if (!env.DB || typeof env.DB.prepare !== 'function' || typeof env.DB.batch !== 'function') bad('DB')
 if (!env.EXHIBITS || typeof env.EXHIBITS.get !== 'function' || typeof env.EXHIBITS.put !== 'function') bad('EXHIBITS')
 try {
  const url = new URL(env.AUTH_ORIGIN)
  if (url.origin !== env.AUTH_ORIGIN || url.username || url.password || (env.AUTH_LOCAL === 'true' ? !isLoopbackHost(url.hostname) || !['http:', 'https:'].includes(url.protocol) : url.protocol !== 'https:')) bad('AUTH_ORIGIN')
 } catch { bad('AUTH_ORIGIN') }
 try { normalizeEmail(env.OWNER_EMAIL) } catch { bad('OWNER_EMAIL') }
 if (typeof env.SESSION_SECRET !== 'string' || env.SESSION_SECRET.length < 32 || env.SESSION_SECRET.length > 1024) bad('SESSION_SECRET')
 if (env.SETUP_TOKEN !== undefined && (typeof env.SETUP_TOKEN !== 'string' || env.SETUP_TOKEN.length < 32 || env.SETUP_TOKEN.length > 1024)) bad('SETUP_TOKEN')
 if (env.MAIL_PROVIDER) {
  if (!['development','resend','sendgrid','cloudflare'].includes(env.MAIL_PROVIDER)) bad('MAIL_PROVIDER')
  if (env.MAIL_PROVIDER !== 'development') {
   const key=env.MAIL_API_KEY
   if (typeof key!=='string'||!key.trim()||key.length>4096||/\s|[\x00-\x1f\x7f]/.test(key)) bad('MAIL_API_KEY')
  }
  if (env.MAIL_PROVIDER==='cloudflare' && !/^[a-f0-9]{32}$/i.test(env.MAIL_ACCOUNT_ID??'')) bad('MAIL_ACCOUNT_ID')
  try { normalizeEmail(env.MAIL_FROM) } catch { bad('MAIL_FROM') }
 }
 return failures
}
export function configurationRefusal(settings: string[]) {
 return Response.json({ error: 'Required configuration is missing or invalid.', settings }, { status: 503, headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } })
}
