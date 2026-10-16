import { Refusal } from '../upload'
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
 return { result, actual, reason }
}
export const describe = (criteria: Criterion[]) => criteria.map(c => `${c.attribute} ${c.op === 'equals' ? '=' : c.op === 'min' ? '≥' : '≤'} ${JSON.stringify(c.value)}`).join(' and ')
