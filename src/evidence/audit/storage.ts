import type { Bindings } from '../../auth.server'
import { validDate } from '../model'
import { Refusal } from '../upload'

// LOG-001. One read over the append-only product audit, reviewer folder events
// and agent approval decisions. Nothing here writes or rewrites a stored row.
export interface AuditEntry { at: string; source: 'product' | 'reviewer' | 'agent'; actor_kind: string; actor_name: string; action: string; subject: string; outcome: string; detail: string; reason: string; revision: string }
export interface AuditFilter { from: string; to: string; action: string; outcome: string }
export const outcomes = ['succeeded', 'refused', 'failed', 'uncertain'] as const

// Dates are UTC days, both bounds inclusive; the action filter is a prefix.
export function auditFilter(params: URLSearchParams): AuditFilter {
 const from = params.get('from') ?? '', to = params.get('to') ?? '', action = (params.get('action') ?? '').trim().slice(0, 100), outcome = params.get('outcome') ?? ''
 if ((from && !validDate(from)) || (to && !validDate(to)) || (from && to && from > to)) throw new Refusal('Choose real UTC dates, from on or before to.')
 if (outcome && !(outcomes as readonly string[]).includes(outcome)) throw new Refusal('Choose a listed outcome.')
 return { from, to, action, outcome }
}

export async function auditTrail(env: Bindings, filter: AuditFilter) {
 const [product, reviewer, agent] = await env.DB.batch([
  env.DB.prepare("SELECT at,'product' AS source,actor_kind,actor_name,action,subject,outcome,detail,reason,revision FROM product_audit"),
  env.DB.prepare("SELECT e.occurred_at AS at,'reviewer' AS source,'reviewer' AS actor_kind,COALESCE('Review folder · '||f.reviewer_label,'Unknown review link') AS actor_name,'review.'||e.action AS action,CASE WHEN e.exhibit_id IS NULL THEN 'folder:'||COALESCE(e.folder_id,'unknown') ELSE 'exhibit:'||e.exhibit_id END AS subject,CASE e.outcome WHEN 'allowed' THEN 'succeeded' ELSE 'refused' END AS outcome,'' AS detail,'' AS reason,'' AS revision FROM review_events e LEFT JOIN review_folders f ON f.id=e.folder_id"),
  env.DB.prepare("SELECT decided_at AS at,'agent' AS source,'owner' AS actor_kind,actor_name,'agent.proposal-'||action AS action,'proposal:'||proposal_id AS subject,'succeeded' AS outcome,'snapshot '||substr(snapshot_hash,1,16) AS detail,'' AS reason,'snapshot '||substr(snapshot_hash,1,16) AS revision FROM agent_decisions"),
 ])
 return [...product.results, ...reviewer.results, ...agent.results].map(r => r as AuditEntry)
  .filter(e => (!filter.from || e.at.slice(0, 10) >= filter.from) && (!filter.to || e.at.slice(0, 10) <= filter.to) && (!filter.action || e.action.startsWith(filter.action)) && (!filter.outcome || e.outcome === filter.outcome))
  .sort((a, b) => b.at.localeCompare(a.at) || a.action.localeCompare(b.action))
}

const cell = (value: string) => /^[=+\-@\t\r]/.test(value) ? `"'${value.replaceAll('"', '""')}"` : `"${value.replaceAll('"', '""')}"`
export const auditCsv = (rows: AuditEntry[]) => ['at,source,actor_kind,actor,action,subject,outcome,detail,reason,revision', ...rows.map(r => [r.at, r.source, r.actor_kind, r.actor_name, r.action, r.subject, r.outcome, r.detail, r.reason, r.revision].map(v => cell(String(v ?? ''))).join(','))].join('\r\n') + '\r\n'
