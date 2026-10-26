import { promiseJourney } from './helpers/promise-journey.mjs'
process.env.RER_SERVER_JOURNEY='1'
import { trustRuntime,trustJourney } from './helpers/trust-journey.mjs'
for(const provider of ['resend','sendgrid']){
 const app=await trustRuntime(provider)
 try { await trustJourney(app) } finally { await app.close() }
}

for(const provider of ['resend','sendgrid']){const app=await trustRuntime(provider);try{await promiseJourney(app)}finally{await app.close()}}
