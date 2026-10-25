process.env.RER_SERVER_JOURNEY='1'
import { runtime } from './helpers/runtime.mjs'
import { trustJourney } from './helpers/trust-journey.mjs'
const app=await runtime({origin:'https://127.0.0.1:8787',settings:{MAIL_API_KEY:'synthetic-evidence-2'}})
try { await trustJourney(app) } finally { await app.close() }
