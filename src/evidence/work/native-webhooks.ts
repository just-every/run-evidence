import type { DestinationRow } from './storage'
import { hookEncoder, hookHmac, hookId, hookIdentity, hookPayload, sameHookValue, type VerifiedHook } from './hook-security'
import { verifyMonday } from './monday-webhook'
const basic = (request: Request, secret: string) => {
 // Both providers let the owner configure a separate webhook username/password.
 // Evidence's webhook username is fixed; the password is the sealed hook secret.
 const header = request.headers.get('authorization') ?? '', match = /^Basic ([A-Za-z0-9+/]+=*)$/i.exec(header)
 if (!match) return false
 try { return sameHookValue(atob(match[1]), 'evidence:' + secret) } catch { return false }
}
export const nativeHookProviders = ['azure-boards', 'monday', 'freshservice', 'youtrack']
export async function verifyNativeHook(d: DestinationRow, secret: string, request: Request, bytes: Uint8Array<ArrayBuffer>, now: Date, callback: string): Promise<VerifiedHook | null> {
 const p = hookPayload(bytes)
 if (!p) return null
 if (d.provider === 'monday') return verifyMonday(d, secret, request, p, now, callback)
 if (d.provider === 'azure-boards') {
  // https://learn.microsoft.com/en-us/azure/devops/service-hooks/services/webhooks
  // https://learn.microsoft.com/en-us/azure/devops/service-hooks/events
  if (!basic(request, secret)) return null
  const delivery = hookIdentity(p.id)
  if (!delivery || typeof p.eventType !== 'string') return null
  if (!['workitem.created', 'workitem.updated', 'workitem.deleted', 'workitem.restored', 'workitem.commented'].includes(p.eventType)) return { delivery, ref: null }
  const resource = p.resource, fields = resource?.revision?.fields ?? resource?.fields
  const project = fields?.['System.TeamProject'], projectId = p.resourceContainers?.project?.id
  if (String(projectId ?? '').toLowerCase() !== d.project.toLowerCase() && (typeof project !== 'string' || ![d.project, d.project_name].some(v => v.toLowerCase() === project.toLowerCase()))) return { delivery, ref: null }
  const collection = p.resourceContainers?.collection?.baseUrl
  if (collection !== undefined && (typeof collection !== 'string' || collection.replace(/\/$/, '').toLowerCase() !== d.api_base.replace(/\/$/, '').toLowerCase())) return { delivery, ref: null }
  return { delivery, ref: hookId(resource?.workItemId ?? resource?.id) }
 }
 if (d.provider === 'freshservice') {
  // Workflow Automator: owner-configured Basic authentication and Advanced JSON.
  // https://support.freshservice.com/support/solutions/articles/157143-using-webhooks-with-the-workflow-automator
  if (!basic(request, secret)) return null
  const ref = hookId(p.ticket_id), group = hookId(p.group_id)
  if (!ref || !group || typeof p.event !== 'string' || !p.event.trim() || typeof p.updated_at !== 'string' || !p.updated_at.trim() || p.updated_at.includes('{{')) return null
  // There is no native delivery UUID. Exact-body identity includes the workflow
  // event and ticket modification time, so later edits remain distinct.
  return { delivery: await hookHmac(hookEncoder.encode(secret), bytes), ref: group === d.project ? ref : null }
 }
 if (d.provider === 'youtrack') {
  // https://www.jetbrains.com/help/youtrack/cloud/webhook-triggers.html
  if (!sameHookValue(request.headers.get('x-youtrack-token') ?? '', secret)) return null
  if (!hookIdentity(p.id) || typeof p.event !== 'string' || typeof p.timestamp !== 'string' || !Number.isFinite(Date.parse(p.timestamp))) return null
  const events = ['issueCreated', 'issueUpdated', 'issueDeleted', 'commentAdded', 'commentUpdated', 'commentDeleted', 'workItemAdded', 'workItemUpdated', 'workItemDeleted', 'issueAttachmentAdded', 'issueAttachmentDeleted']
  return { delivery: await hookHmac(hookEncoder.encode(secret), bytes), ref: p.project?.id === d.project && events.includes(p.event) ? p.id : null }
 }
 return null
}
