import { scopedFetch } from './evidence/ops/execution'
import { createMailSender } from './modules/mail/index.mjs'

export function operatorMail(env) {
 return env.RER_DEMO === '1' || env.MAIL_PROVIDER === 'development'
  ? createMailSender({ provider: 'development', mode: 'development' })
  : env.MAIL_PROVIDER ? createMailSender({ provider: env.MAIL_PROVIDER, mode: 'production', apiKey: env.MAIL_API_KEY, ...(env.MAIL_PROVIDER === 'cloudflare' ? { accountId: env.MAIL_ACCOUNT_ID } : {}) }, { fetch: scopedFetch }) : undefined
}
