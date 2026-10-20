// GitHub REST 2022-11-28 response fields used by the read-only collector:
// https://docs.github.com/en/rest/branches/branch-protection#get-branch-protection
// https://docs.github.com/en/rest/repos/repos#get-a-repository
// Invalid/missing facts stay null; a successful HTTP status alone is not proof.
export const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
export const natural = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
export function protectionFields(value: unknown) {
 const attributes: Record<string, unknown> = { branch_protection: null, required_reviews: null, required_status_checks: null, enforce_admins: null }, gaps: string[] = []
 if (!record(value) || !['required_pull_request_reviews', 'required_status_checks', 'enforce_admins'].some(k => Object.hasOwn(value, k))) return { attributes, gaps: ['schema drift: branch protection is missing its configuration fields'] }
 attributes.branch_protection = true
 const reviews = value.required_pull_request_reviews, checks = value.required_status_checks, admins = value.enforce_admins
 if (reviews === undefined || reviews === null) attributes.required_reviews = 0
 else if (record(reviews) && natural(reviews.required_approving_review_count)) attributes.required_reviews = reviews.required_approving_review_count
 else gaps.push('schema drift: required approving review count')
 if (checks === undefined || checks === null) attributes.required_status_checks = 0
 else if (record(checks) && (Array.isArray(checks.contexts) || Array.isArray(checks.checks)) && (checks.contexts === undefined || Array.isArray(checks.contexts) && checks.contexts.every(v => typeof v === 'string')) && (checks.checks === undefined || Array.isArray(checks.checks) && checks.checks.every(v => record(v) && typeof v.context === 'string'))) attributes.required_status_checks = Math.max(Array.isArray(checks.contexts) ? checks.contexts.length : 0, Array.isArray(checks.checks) ? checks.checks.length : 0)
 else gaps.push('schema drift: required status checks')
 if (record(admins) && typeof admins.enabled === 'boolean') attributes.enforce_admins = admins.enabled
 else gaps.push('schema drift: administrator enforcement')
 return { attributes, gaps }
}
