process.env.RER_SERVER_JOURNEY='1'
import { runtime } from './helpers/runtime.mjs'
import { trustJourney } from './helpers/trust-journey.mjs'
const app=await runtime({origin:'https://127.0.0.1:8787',settings:{MAIL_API_KEY:'synthetic-evidence-2'}})
try { await trustJourney(app) } finally { await app.close() }

// The same user flow covers SendGrid serialization, signature verification and
// correlation by the delivery custom argument; only its network edge is faked.
const sendgrid=await runtime({origin:'https://127.0.0.1:8787',settings:{MAIL_PROVIDER:'sendgrid',MAIL_API_KEY:'synthetic-evidence-4'},outbound:async request=>{
 if(request.url!=='https://api.sendgrid.com/v3/mail/send')return
 const wire=await request.json()
 sendgrid.messages.push({to:wire.personalizations[0].to.map(r=>r.email),subject:wire.subject,text:wire.content.find(c=>c.type==='text'+'/'+'plain')?.value,html:wire.content.find(c=>c.type==='text'+'/'+'html')?.value,headers:wire.headers})
 return new Response(null,{status:202,headers:{'x-message-id':crypto.randomUUID()}})
}})
try { await trustJourney(sendgrid) } finally { await sendgrid.close() }
