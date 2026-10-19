import { Refusal } from '../upload'
import { usInstant } from '../format'
// Test criteria are declarative attribute checks. An attribute the source did
// not expose or could not read is unknown, never a pass.
export type Criterion = { attribute: string; op: 'equals' | 'min' | 'max'; value: string | number | boolean }
export type Result = 'pass' | 'fail' | 'unknown'
export function parseCriteria(value: unknown): Criterion[] {
 let parsed = value
 if (typeof value === 'string') { try { parsed = JSON.parse(value) } catch { throw new Refusal('Criteria must be a JSON list.') } }
 if (!Array.isArray(parsed) || !parsed.length || parsed.length > 20) throw new Refusal('Give one to twenty criteria.')
 return parsed.map(c => {
  if (!c || typeof c !== 'object' || typeof c.attribute !== 'string' || !/^[A-Za-z_][A-Za-z0-9_.]{0,63}$/.test(c.attribute) || !['equals', 'min', 'max'].includes(c.op)) throw new Refusal('Each criterion needs an attribute name and an op of equals, min or max.')
  if (c.op === 'equals' ? !['string', 'number', 'boolean'].includes(typeof c.value) : typeof c.value !== 'number' || !Number.isFinite(c.value)) throw new Refusal(`Criterion ${c.attribute} needs a ${c.op === 'equals' ? 'string, number or boolean' : 'numeric'} value.`)
  return { attribute: c.attribute, op: c.op, value: c.value }
 })
}
export function evaluate(criteria: Criterion[], attributes: Record<string, unknown>) {
 const actual: Record<string, unknown> = {}, failing: string[] = [], unknown: string[] = []
 for (const c of criteria) {
  const value = attributes[c.attribute]; actual[c.attribute] = value ?? null
  if (value === undefined || value === null) { unknown.push(c.attribute); continue }
  const ok = c.op === 'equals' ? value === c.value : typeof value === 'number' && (c.op === 'min' ? value >= Number(c.value) : value <= Number(c.value))
  if (!ok) failing.push(c.attribute)
 }
 const result: Result = failing.length ? 'fail' : unknown.length ? 'unknown' : 'pass'
 const reason = failing.length ? `Fails ${failing.join(', ')}` : unknown.length ? `Source did not expose ${unknown.join(', ')}` : 'Meets every criterion'
 return { result, actual, reason, failing, unknown }
}
// People read criteria and results as sentences, never attribute keys:
// filevault_enabled = true reads "FileVault is on"; false reads "FileVault is off".
const proper: Record<string, string> = { mfa: 'MFA', sso: 'SSO', '2fa': '2FA', filevault: 'FileVault', s3: 'S3', rds: 'RDS', tls: 'TLS', ssl: 'SSL', api: 'API', ssh: 'SSH', iam: 'IAM', kms: 'KMS', vpc: 'VPC', https: 'HTTPS', mdm: 'MDM', edr: 'EDR', saml: 'SAML', id: 'ID', ip: 'IP', url: 'URL', github: 'GitHub', aws: 'AWS', gcp: 'Google Cloud', okta: 'Okta' }
const states = ['enabled', 'enforced', 'active', 'required', 'verified', 'current', 'encrypted', 'configured', 'protected', 'blocked', 'public', 'complete', 'approved', 'signed', 'present']
const phrase = (words: string[]) => words.map(w => proper[w.toLowerCase()] ?? w.toLowerCase()).join(' ')
const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
/** The state a criterion asks for, or with `actual` the state an item was found in. */
export function statement(c: Criterion, actual?: unknown) {
 const words = c.attribute.split(/[_.]+/).filter(Boolean), name = sentence(phrase(words))
 if (actual === null) return `${name} was not reported`
 const value = actual === undefined ? c.value : actual
 if (typeof value === 'boolean') {
  const last = words.at(-1)!.toLowerCase()
  if (words.length > 1 && states.includes(last)) { const subject = sentence(phrase(words.slice(0, -1))); return last === 'enabled' ? `${subject} is ${value ? 'on' : 'off'}` : `${subject} is ${value ? '' : 'not '}${last}` }
  if (/ed$/.test(words[0]) || states.includes(words[0].toLowerCase())) return value ? name : `Not ${phrase(words)}`
  return `${name} is ${value ? 'on' : 'off'}`
 }
 const bound = c.op === 'min' ? 'at least ' : c.op === 'max' ? 'at most ' : '', shown = (v: unknown) => typeof v === 'string' ? `"${v}"` : String(v)
 return actual === undefined ? `${name} is ${bound}${shown(c.value)}` : `${name} is ${shown(actual)} (needs ${bound}${shown(c.value)})`
}
export const describe = (criteria: Criterion[]) => criteria.map(c => statement(c)).join(' and ')
const instant = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?Z/g
/** Why an observation has its result, in words: the failing or unreported criteria, from what was expected and found. */
export function explain(o: { result: string; reason: string; expected_json: string; actual_json: string }) {
 if (o.result !== 'fail' && !(o.result === 'unknown' && o.reason.startsWith('Source did not expose'))) return o.reason.replace(instant, usInstant)
 const criteria = parseCriteria(o.expected_json), actual = JSON.parse(o.actual_json) as Record<string, unknown>, e = evaluate(criteria, actual)
 return [...e.failing, ...e.unknown].map(a => statement(criteria.find(c => c.attribute === a)!, actual[a] ?? null)).join('; ')
}
