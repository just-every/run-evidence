import { runtime } from './runtime.mjs'
import { browserBridge } from './browser-bridge.mjs'
import { policyReadingJourney } from './policy-reading-browser.mjs'
const app=await runtime()
let bridge
try {
 const cookie=await app.signin()
 await app.clock('2026-10-26T12:00:00Z')
 bridge=await browserBridge(app,'policy-reading')
 await policyReadingJourney(app,bridge,cookie)
} finally { if(bridge)await bridge.close();await app.close() }
