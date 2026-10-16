import type { Bindings } from '../../auth.server'
import { Refusal } from '../upload'
import { auditStatement, oneOf, text, type Actor, type Input } from '../door'
import { seal, unseal } from '../connect/custody'
// Slack (a bot token with chat:write and users:read.email) and Microsoft Teams
// (a Workflows "post to a channel when a webhook request is received" URL).
// A provider's acknowledgement means it accepted the message, not that anyone
// acted. A lost answer is uncertain and is never resent under a new identity.
export type ChannelKind = 'slack' | 'teams'
export interface ChannelRow { id: string; kind: ChannelKind; label: string; account: string; target: string; secret_ciphertext: string | null; secret_iv: string | null; status: string; created_by: string; created_name: string; created_at: string; rotated_at: string | null; revoked_at: string | null; last_success_at: string | null; last_error: string }
export type Outcome = { state: 'accepted' | 'failed' | 'uncertain'; detail: string; revoked?: boolean }
export interface Message { title: string; text: string; link: string }
export const channels = async (env: Bindings) => (await env.DB.prepare('SELECT * FROM followup_channels ORDER BY created_at').all<ChannelRow>()).results
export const activeChannel = (env: Bindings, kind: ChannelKind) => env.DB.prepare("SELECT * FROM followup_channels WHERE kind=? AND status='active'").bind(kind).first<ChannelRow>()
export const safeChannel = ({ secret_ciphertext: _c, secret_iv: _i, ...rest }: ChannelRow) => rest
const timeout = () => AbortSignal.timeout(10000)
async function slackCall(token: string, method: string, body: Record<string, string>) {
 const response = await fetch('https://slack.com/api/' + method, { method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body), signal: timeout() })
 if (response.status === 429) return { ok: false, error: 'ratelimited' } as Record<string, unknown>
 // A server error may come after Slack acted on the message: ambiguous, never a clean failure.
 if (!response.ok) return { ok: false, error: 'http_' + response.status, ambiguous: response.status >= 500 } as Record<string, unknown>
 return await response.json() as Record<string, unknown>
}
const revokedSlack = (error: unknown) => ['invalid_auth', 'not_authed', 'account_inactive', 'token_revoked', 'token_expired', 'missing_scope'].includes(String(error))
const teamsHost = (url: URL) => url.protocol === 'https:' && !url.username && !url.password && /(^|\.)(logic\.azure\.com|powerplatform\.com|webhook\.office\.com)$/i.test(url.hostname)
// Send one message to a person (Slack direct message by their email) or to the channel target.
export async function deliver(env: Bindings, channel: ChannelRow, email: string | null, message: Message): Promise<Outcome> {
 if (!channel.secret_ciphertext || !channel.secret_iv) return { state: 'failed', detail: `${channel.kind} is ${channel.status}; reconnect it.` }
 let secret: string
 try { secret = await unseal(env, channel.secret_ciphertext, channel.secret_iv, channel.id) } catch { return { state: 'failed', detail: 'The stored credential cannot be decrypted; reconnect.', revoked: true } }
 try {
  if (channel.kind === 'slack') {
   let target = channel.target
   if (email) {
    const user = await slackCall(secret, 'users.lookupByEmail', { email })
    if (!user.ok) return revokedSlack(user.error) ? { state: 'failed', detail: `Slack refused the token (${user.error}).`, revoked: true } : { state: 'failed', detail: `Slack has no member with that email (${user.error}).` }
    target = String((user.user as { id?: string })?.id ?? '')
   }
   if (!target) return { state: 'failed', detail: 'No Slack channel is set for messages without a person.' }
   const posted = await slackCall(secret, 'chat.postMessage', { channel: target, text: `*${message.title}*\n${message.text}\n<${message.link}|Open in Evidence>`, unfurl_links: 'false' })
   if (posted.ok) return { state: 'accepted', detail: 'Slack accepted the message.' }
   if (posted.ambiguous) return { state: 'uncertain', detail: `Slack answered ${String(posted.error).replace('http_', '')}; the message may or may not have arrived.` }
   return { state: 'failed', detail: `Slack refused the message (${posted.error}).`, revoked: revokedSlack(posted.error) }
  }
  const url = new URL(secret)
  if (!teamsHost(url)) return { state: 'failed', detail: 'The Teams workflow URL is not a Microsoft host.' }
  const card = { type: 'message', attachments: [{ contentType: 'application/vnd.microsoft.card.adaptive', content: { type: 'AdaptiveCard', $schema: 'http://adaptivecards.io/schemas/adaptive-card.json', version: '1.4', body: [{ type: 'TextBlock', text: message.title, weight: 'Bolder', wrap: true }, ...(email ? [{ type: 'TextBlock', text: `For ${email}`, isSubtle: true, wrap: true }] : []), { type: 'TextBlock', text: message.text, wrap: true }], actions: [{ type: 'Action.OpenUrl', title: 'Open in Evidence', url: message.link }] } }] }
  const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(card), redirect: 'manual', signal: timeout() })
  if (response.status >= 200 && response.status < 300) return { state: 'accepted', detail: `Teams accepted the message (${response.status}).` }
  if (response.status === 401 || response.status === 403 || response.status === 404) return { state: 'failed', detail: `Teams refused the workflow URL (${response.status}); reconnect it.`, revoked: true }
  return { state: response.status >= 500 ? 'uncertain' : 'failed', detail: `Teams answered ${response.status}.` }
 } catch { return { state: 'uncertain', detail: `${channel.kind === 'slack' ? 'Slack' : 'Teams'} did not answer; the message may or may not have arrived.` } }
}
async function check(kind: ChannelKind, secret: string, target: string) {
 if (kind === 'slack') {
  const auth = await slackCall(secret, 'auth.test', {}).catch(() => ({ ok: false, error: 'unreachable' }) as Record<string, unknown>)
  if (!auth.ok) throw new Refusal(`Slack refused the bot token (${auth.error}).`)
  if (target && !/^[CGD][A-Z0-9]{6,20}$/.test(target)) throw new Refusal('Give the Slack channel ID (for example C0123456789).')
  return String(auth.team ?? 'Slack workspace')
 }
 let url: URL
 try { url = new URL(secret) } catch { throw new Refusal('Paste the Teams workflow URL.') }
 if (!teamsHost(url)) throw new Refusal('The Teams workflow URL must be an https Microsoft workflow address.')
 return url.hostname
}
// The first Teams message proves the workflow URL works; Slack is checked with auth.test.
export async function connectChannel(env: Bindings, actor: Actor, input: Input, now: Date) {
 const kind = oneOf(input, 'kind', ['slack', 'teams'] as const), secret = text(input, 'secret', 2000), target = kind === 'slack' ? text(input, 'target', 40, true) : ''
 if (await activeChannel(env, kind)) throw new Refusal(`A ${kind === 'slack' ? 'Slack' : 'Teams'} channel is already connected; rotate or revoke it.`, 409)
 const account = await check(kind, secret, target), id = crypto.randomUUID(), sealed = await seal(env, secret, id)
 const row: ChannelRow = { id, kind, label: text(input, 'label', 120, true) || (kind === 'slack' ? 'Slack ' + account : 'Teams channel'), account, target, secret_ciphertext: sealed.ciphertext, secret_iv: sealed.iv, status: 'active', created_by: actor.id, created_name: actor.name, created_at: now.toISOString(), rotated_at: null, revoked_at: null, last_success_at: null, last_error: '' }
 if (kind === 'teams') {
  const first = await deliver(env, row, null, { title: 'Evidence is connected', text: 'Evidence will post compliance follow-ups to this channel.', link: env.AUTH_ORIGIN + '/app/followups' })
  if (first.state !== 'accepted') throw new Refusal('Teams did not accept a test message: ' + first.detail)
  row.last_success_at = now.toISOString()
 }
 await env.DB.batch([
  env.DB.prepare('INSERT INTO followup_channels(id,kind,label,account,target,secret_ciphertext,secret_iv,status,created_by,created_name,created_at,last_success_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(id, kind, row.label, account, target, row.secret_ciphertext, row.secret_iv, 'active', actor.id, actor.name, row.created_at, row.last_success_at),
  auditStatement(env, actor, 'followup.channel-connected', 'channel:' + id, now, 'succeeded', kind),
 ])
 return { id }
}
export async function rotateChannel(env: Bindings, actor: Actor, id: string, input: Input, now: Date) {
 const row = await env.DB.prepare('SELECT * FROM followup_channels WHERE id=?').bind(id).first<ChannelRow>()
 if (!row || row.status === 'revoked') throw new Refusal('Channel not found.', 404)
 const secret = text(input, 'secret', 2000); await check(row.kind, secret, row.target)
 const sealed = await seal(env, secret, id)
 await env.DB.batch([env.DB.prepare("UPDATE followup_channels SET secret_ciphertext=?,secret_iv=?,status='active',rotated_at=?,last_error='' WHERE id=?").bind(sealed.ciphertext, sealed.iv, now.toISOString(), id), auditStatement(env, actor, 'followup.channel-rotated', 'channel:' + id, now)])
}
export async function revokeChannel(env: Bindings, actor: Actor, id: string, now: Date) {
 const done = await env.DB.prepare("UPDATE followup_channels SET status='revoked',secret_ciphertext=NULL,secret_iv=NULL,revoked_at=? WHERE id=? AND status!='revoked'").bind(now.toISOString(), id).run()
 if (!done.meta.changes) throw new Refusal('Channel not found.', 404)
 await auditStatement(env, actor, 'followup.channel-revoked', 'channel:' + id, now).run()
}
