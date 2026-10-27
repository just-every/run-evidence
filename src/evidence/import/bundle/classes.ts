import type { Json } from '../base/types'
// The ten record classes MIGRATE-001 reconciles separately, in the clause's order.
export const classes = [
 { id: 'frameworks_controls', label: 'Frameworks, controls and mappings', manual: 'Frameworks (/app/frameworks) and the control library (/app/library)' },
 { id: 'test_history', label: 'Test history', manual: 'Tests (/app/tests); history before the switch stays with the incumbent export' },
 { id: 'policies', label: 'Policies with approval history and attestations', manual: 'Policies (/app/policies): publish each policy and record staff attestations' },
 { id: 'people', label: 'People', manual: 'People (/app/people): add or upload the roster as CSV' },
 { id: 'vendors', label: 'Vendors', manual: 'Vendors (/app/vendors): add each vendor or upload the register' },
 { id: 'risks', label: 'Risks', manual: 'Risks (/app/risks): spreadsheet import of the risk register' },
 { id: 'access_reviews', label: 'Access-review decisions', manual: 'Access reviews (/app/access-reviews): run the review again, or attach the incumbent review file as an exhibit' },
 { id: 'audit_requests', label: 'Audit requests', manual: 'Reviews (/app/reviews): create the auditor folder and requests' },
 { id: 'trust_answers', label: 'Trust-center and answer-library content', manual: 'Questionnaires (/app/questionnaires): upload a completed workbook; its answers arrive labeled imported and unverified' },
 { id: 'exhibits', label: 'Original exhibits', manual: 'Any requirement page (/app): upload the original file as proof' },
] as const
export type ClassId = (typeof classes)[number]['id']
export const classIds = classes.map(c => c.id) as ClassId[]
export type Verdict = 'admit' | 'unsupported' | 'refused'
export interface SourceRow {
 class: ClassId; type: string; id: string; path: string; fields: Json
 verdict: Verdict; reason?: string
 // Bytes retained in the uploaded ZIP; verified and digested at parse time.
 file?: { path: string; size: number; sha256: string; name: string }
}
export interface AbsentField { class: ClassId; what: string; route: string }
export type Provider = 'Vanta' | 'Secureframe' | 'Drata'
