import type { Provider } from './client'
export const webhookInstructions: Partial<Record<Provider,string>> = {
 'azure-boards': 'Create an Azure DevOps Web Hooks service hook for work-item and comment events with full resource details. Use the displayed HTTPS callback, Basic username evidence and the callback password pasted when connecting. Events prompt a fresh authorized work-item read.',
 monday: 'Signed callbacks require a monday integration app OAuth token. Create board webhooks using that app token, the displayed HTTPS callback and the app Signing Secret pasted when connecting. Personal-token unsigned events are refused. URL verification only echoes the challenge; it does not read or change tickets.',
 freshservice: 'In Workflow Automator choose Trigger Webhook, POST and Requires Authentication. Use Basic username evidence and the callback password pasted when connecting. Advanced JSON: {"ticket_id":"{{ticket.raw_id}}","group_id":"GROUP_ID","event":"{{Triggered event}}","updated_at":"{{ticket.modified_on}}"}. Replace GROUP_ID with this destination group ID. Use the numeric raw ticket ID, not the display INC identifier.',
 youtrack: 'Enable YouTrack Webhook Triggers for issue and comment changes in the chosen project. Set the displayed HTTPS callback and paste its X-YouTrack-Token secret when connecting. Payloads only prompt an authorized issue read.',
 basecamp: 'Basecamp uses ten-minute polling. Authenticated native callback registration is not implemented: signing-secret provisioning has not been established. No unsigned callbacks are accepted.',
}
