import { Refusal } from '../upload'
import type { ResourceSchema } from '../resources'
export const revision = 'private-git/v1'
export const resourceType = 'private.git.repository'
export const schema: ResourceSchema = { fields: { branches: 'number', heads: 'number', head: 'string', latest_commit_at: 'string', bare: 'boolean' }, required: ['branches', 'heads', 'bare'] }
export const dataFields = 'Repository label, branch count, distinct branch-head count, HEAD commit ID and commit time, and bare-repository state. No file contents, authors, remote URL, repository path or credentials are sent.'
export const unsupported = 'Hosted branch protection, required review/check policies, repository privacy, membership/MFA and dependency/secret alerts cannot be read from local Git. They stay unknown; attach manual evidence to the relevant control requirement or connect the hosting provider.'
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k))
export function validateReport(body: unknown, label: string, now: Date) {
 if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Refusal('Send one collector report.')
 const b = body as Record<string, unknown>, complete = b.outcome === 'complete', failed = b.outcome === 'failed'
 if ((!complete && !failed) || !exact(b, ['revision', 'outcome', 'observedAt', complete ? 'resource' : 'error']) || b.revision !== revision) throw new Refusal('Unknown collector report revision or fields.')
 const observed = typeof b.observedAt === 'string' ? Date.parse(b.observedAt) : NaN
 if (!Number.isFinite(observed) || new Date(observed).toISOString() !== b.observedAt || observed > now.getTime() + 5 * 60000 || observed < now.getTime() - 3600000) throw new Refusal('The source read must be within the last hour, with at most five minutes of clock skew.')
 if (failed) { if (b.error !== 'repository_unreadable') throw new Refusal('Unknown source failure.'); return { complete: false as const, observedAt: b.observedAt as string } }
 const r = b.resource as Record<string, unknown>, a = r?.attributes as Record<string, unknown>
 if (!r || !exact(r, ['uniqueId', 'displayName', 'attributes']) || r.uniqueId !== label || r.displayName !== label || !a || typeof a !== 'object' || Array.isArray(a) || !exact(a, ['branches', 'heads', 'head', 'latest_commit_at', 'bare'])) throw new Refusal('Report only the reviewed fields for this registered repository label.')
 if (!Number.isSafeInteger(a.branches) || Number(a.branches) < 0 || !Number.isSafeInteger(a.heads) || Number(a.heads) < 0 || Number(a.heads) > Number(a.branches) || typeof a.bare !== 'boolean' || !(a.head === null || typeof a.head === 'string' && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(a.head)) || !(a.latest_commit_at === null || typeof a.latest_commit_at === 'string' && Number.isFinite(Date.parse(a.latest_commit_at))) || (a.head === null) !== (a.latest_commit_at === null)) throw new Refusal('Invalid read-only Git observation.')
 return { complete: true as const, observedAt: b.observedAt as string, attributes: a }
}
