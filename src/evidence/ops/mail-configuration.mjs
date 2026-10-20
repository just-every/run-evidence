import { parseAddress } from '../../modules/mail/src/core/validation.mjs'
// Use the mail module's own mailbox grammar, including display names.
export function mailConfigurationFailures(env) {
 const failures=[]
 if(!env.MAIL_PROVIDER)return failures
 if(!['development','resend','sendgrid','cloudflare'].includes(env.MAIL_PROVIDER))failures.push('MAIL_PROVIDER')
 if(env.MAIL_PROVIDER!=='development') {
  const key=env.MAIL_API_KEY
  if(typeof key!=='string'||!key.trim()||key.length>4096||/\s|[\x00-\x1f\x7f]/.test(key))failures.push('MAIL_API_KEY')
 }
 if(env.MAIL_PROVIDER==='cloudflare'&&!/^[a-f0-9]{32}$/i.test(env.MAIL_ACCOUNT_ID??''))failures.push('MAIL_ACCOUNT_ID')
 try{parseAddress(env.MAIL_FROM)}catch{failures.push('MAIL_FROM')}
 return failures
}
