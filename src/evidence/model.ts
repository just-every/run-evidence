export const groups = ['Access', 'Data', 'Change', 'People', 'Vendors'] as const
export const cadences = ['daily', 'weekly', 'monthly', 'quarterly'] as const
export type Cadence = typeof cadences[number]
export type Origin = 'source-observed' | 'manually-asserted' | 'imported'
export interface Requirement { id: string; control_id: string; name: string; cadence: Cadence; created_at: string; control_name: string; group_name: string }
export interface Receipt { id: string; requirement_id: string; exhibit_id: string; origin: Origin; source: string; covered_from: string; covered_to: string; added_by: string; added_by_name: string; added_at: string; sha256: string; supersedes: string | null; object_key: string; filename: string; size: number; media_type: string; superseded_by: string | null; available: boolean }
export type Gap = 'covered' | 'due soon' | 'overdue' | 'missing' | 'superseded-only' | 'unavailable bytes'
export const day = (date: Date) => date.toISOString().slice(0, 10)
export function validDate(value: unknown): value is string {
 return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && day(new Date(value)) === value
}
export function period(cadence: Cadence, selected: string) {
 const start = new Date(selected + 'T00:00:00Z')
 if (cadence === 'weekly') start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7)
 if (cadence === 'monthly' || cadence === 'quarterly') start.setUTCDate(1)
 if (cadence === 'quarterly') start.setUTCMonth(Math.floor(start.getUTCMonth() / 3) * 3)
 const end = new Date(start)
 if (cadence === 'daily') end.setUTCDate(end.getUTCDate() + 1)
 if (cadence === 'weekly') end.setUTCDate(end.getUTCDate() + 7)
 if (cadence === 'monthly') end.setUTCMonth(end.getUTCMonth() + 1)
 if (cadence === 'quarterly') end.setUTCMonth(end.getUTCMonth() + 3)
 return { from: day(start), to: day(new Date(end.getTime() - 1)), deadline: end.getTime(), start: start.getTime() }
}
export function gap(cadence: Cadence, selected: string, receipts: Receipt[], now: Date): Gap {
 const window = period(cadence, selected)
 const matching = receipts.filter(r => r.origin !== 'imported' && r.covered_from <= window.from && r.covered_to >= window.to)
 const current = matching.filter(r => !r.superseded_by)
 if (current.some(r => !r.available)) return 'unavailable bytes'
 if (current.length) {
  const soon = (window.deadline - window.start) * .2
  return now.getTime() >= window.deadline - soon && now.getTime() < window.deadline ? 'due soon' : 'covered'
 }
 if (matching.length) return 'superseded-only'
 if (!receipts.length) return 'missing'
 const expired = receipts.some(r => !r.superseded_by && Date.parse(r.covered_to + 'T00:00:00Z') + 86400000 <= now.getTime())
 return now.getTime() >= window.deadline || (selected === day(now) && expired) ? 'overdue' : 'missing'
}
