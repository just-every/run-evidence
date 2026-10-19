import { Refusal } from '../upload'
import { validDate } from '../model'
import { severities, categories } from '../tests/storage'
import type { RequirementState } from './readiness'
export interface BoardFilters { owner: string; severity: string; category: string; product: string; from: string; to: string; snapshot: string }
export const emptyFilters: BoardFilters = { owner: '', severity: '', category: '', product: '', from: '', to: '', snapshot: '' }
export function boardFilters(url: URL): BoardFilters {
 const value = Object.fromEntries(Object.keys(emptyFilters).map(k => [k, url.searchParams.get(k) ?? ''])) as unknown as BoardFilters
 for (const field of ['from', 'to', 'snapshot'] as const) if (value[field] && !validDate(value[field])) throw new Refusal('Choose real UTC dates for the report.')
 if (value.from && value.to && value.from > value.to) throw new Refusal('The report start must not follow its end.')
 if (value.severity && !severities.includes(value.severity as typeof severities[number])) throw new Refusal('Choose a listed severity.')
 if (value.category && !categories.includes(value.category as typeof categories[number])) throw new Refusal('Choose a listed category.')
 return value
}
export function matchingRequirements(requirements: RequirementState[], filters: BoardFilters, productMatches: boolean) {
 return productMatches ? requirements.filter(r => (!filters.owner || r.controls.some(c => c.owner_person_id === filters.owner)) && (!filters.severity || r.controls.some(c => c.severities.includes(filters.severity))) && (!filters.category || r.controls.some(c => c.categories.includes(filters.category)))) : []
}
