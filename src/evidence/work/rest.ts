import { call, TrackerFailure, type Adapter } from './client'
export const priorities = { critical: '1', high: '2', medium: '3', low: '4' }
export const bearer = (token: string) => ({ authorization: `Bearer ${token}`, accept: 'application/json', 'content-type': 'application/json' })
export async function json(url: string, token: string, label: string, method = 'GET', body?: unknown, headers: Record<string,string> = bearer(token)): Promise<any> {
 return (await call(url, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }), label })).body
}
export const id = encodeURIComponent
export const isoDay = (n: unknown) => n == null ? null : new Date(Number(n)).toISOString().slice(0, 10)
export const epoch = (day: string | null) => day ? Date.parse(day + 'T00:00:00Z') : null
export function requireId(value: unknown, label: string): string {
 if (value === undefined || value === null || String(value) === '') throw new TrackerFailure('unavailable', 502, `${label} returned no record identity; check the provider before retrying.`)
 return String(value)
}
// Resolve configured names before creation so a missing/ambiguous mapping cannot
// leave a remote ticket whose labels were silently omitted.
export function namedIds(rows: {id:string;name:string}[], names: string[], provider: string): string[] {
 if(!Array.isArray(rows)||rows.some(row=>!row||typeof row.id!=='string'||!row.id||typeof row.name!=='string'))throw new TrackerFailure('unavailable',502,`${provider} native label metadata is unavailable.`)
 return [...new Set(names)].map(name => {
  const matches=rows.filter(row=>row.name===name)
  if(matches.length!==1)throw new TrackerFailure('invalid',400,`${provider} label ${name} must match exactly one available native label.`)
  return requireId(matches[0].id,provider)
 })
}
export const metadata = (name: string, defaultBase: string, projectLabel: string, credential: string, permissions: string): Pick<Adapter, 'name'|'defaultBase'|'baseLabel'|'projectLabel'|'credential'|'permissions'|'supportsDue'|'commentText'|'webhook'|'defaultPriorities'> => ({ name, defaultBase, baseLabel: `${name} API`, projectLabel, credential, permissions, supportsDue: true, commentText: true, webhook: 'polling every 10 minutes; provider webhook registration is not yet supported', defaultPriorities: priorities })
