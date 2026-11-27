import { scopedFetch } from './evidence/ops/execution'
import { createMailSender } from './modules/mail/index.mjs'

export function operatorMail(env) {
 if (env.RER_DEMO === '1' || env.MAIL_PROVIDER === 'development') {
  return createMailSender({ provider: 'development', mode: 'development' })
 }
 if (env.MAIL_PROVIDER === 'none') return {
  async send() {
   return { status: 'rejected', provider: 'none', providerMessageId: null, code: 'mail_off' }
  },
 }
 return env.MAIL_PROVIDER ? createMailSender({ provider: env.MAIL_PROVIDER, mode: 'production', apiKey: env.MAIL_API_KEY, ...(env.MAIL_PROVIDER === 'rer' ? { relayUrl: env.MAIL_RELAY_URL } : {}), ...(env.MAIL_PROVIDER === 'cloudflare' ? { accountId: env.MAIL_ACCOUNT_ID } : {}) }, { fetch: scopedFetch }) : undefined
}
