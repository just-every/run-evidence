// Run the trust flow alone or as part of the complete review browser journey.
process.env.RER_SERVER_JOURNEY='1'
import {userInfo} from 'node:os'
import {runtime} from './helpers/runtime.mjs'
import {trustJourney} from './helpers/trust-journey.mjs'
import {engagementBrowser} from './helpers/engagement-browser.mjs'
// Browser drivers always use the real account home, including isolated runners.
process.env.HOME=userInfo().homedir
const app=await runtime({origin:'https://127.0.0.1:8787',settings:{MAIL_API_KEY:'synthetic-evidence-2'}})
try{await trustJourney(app,{browserProof:engagementBrowser})}finally{await app.close()}
