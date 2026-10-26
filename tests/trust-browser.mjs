// Run the trust flow alone or as part of the complete review browser journey.
process.env.RER_SERVER_JOURNEY='1'
import {userInfo} from 'node:os'
import {trustJourney,trustRuntime} from './helpers/trust-journey.mjs'
import {engagementBrowser} from './helpers/engagement-browser.mjs'
// Browser drivers always use the real account home, including isolated runners.
process.env.HOME=userInfo().homedir
const app=await trustRuntime()
try{await trustJourney(app,{browserProof:engagementBrowser})}finally{await app.close()}
