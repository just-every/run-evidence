import {auditSharingJourney} from './helpers/audit-sharing-journey.mjs'
import {engagementJourney} from './helpers/engagement-journey.mjs'
import {engagementBrowser} from './helpers/engagement-browser.mjs'
await engagementJourney(engagementBrowser)
console.log('PASS auditor request handover, program readiness and board at 1440 and 390')

await auditSharingJourney(engagementBrowser)
console.log('PASS continuous evidence flags and owner drilldown at 1440 and 390')
