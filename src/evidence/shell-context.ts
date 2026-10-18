import { AsyncLocalStorage } from 'node:async_hooks'
import { runtimeBindings, type Bindings } from '../auth.server'
import { frameworks, type FrameworkId } from './library'
// The app shell's top bar names the audit program and the rail counts failing
// tests on every owner page; the request's database is scoped here once so the
// many page renderers need not pass it.
interface Scope { env: Bindings; url: URL }
const scope = new AsyncLocalStorage<Scope>()
export const withShellScope = <T>(request: Request, env: Bindings, run: () => Promise<T>) => scope.run({ env: runtimeBindings(env), url: new URL(request.url) }, run)
export interface ShellProgram { id: string; label: string; name: string; from: string; to: string }
export interface ShellFacts { programs: ShellProgram[]; selected: ShellProgram | null; failingTests: number }
export async function shellFacts(): Promise<ShellFacts | null> {
 const s = scope.getStore()
 if (!s) return null
 const [programs, failing] = await s.env.DB.batch([
  s.env.DB.prepare('SELECT id,framework,report_type,name,audit_from,audit_to FROM programs ORDER BY created_at,id'),
  s.env.DB.prepare("SELECT COUNT(DISTINCT o.test_id) AS n FROM observations o JOIN test_runs r ON r.id=o.run_id JOIN tests t ON t.id=o.test_id WHERE t.enabled=1 AND o.result='fail' AND r.started_at=(SELECT MAX(started_at) FROM test_runs x WHERE x.test_id=o.test_id)"),
 ])
 const rows = (programs.results as { id: string; framework: FrameworkId; report_type: string | null; name: string; audit_from: string; audit_to: string }[]).map(p => ({ id: p.id, name: p.name, from: p.audit_from, to: p.audit_to, label: (frameworks[p.framework]?.name ?? p.framework) + (p.report_type ? ' ' + p.report_type : '') }))
 const current = /^\/app\/programs\/([a-f0-9-]{36})/.exec(s.url.pathname)?.[1]
 return { programs: rows, selected: rows.find(p => p.id === current) ?? rows[0] ?? null, failingTests: Number((failing.results[0] as { n: number } | undefined)?.n ?? 0) }
}
