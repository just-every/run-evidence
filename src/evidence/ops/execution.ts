import { AsyncLocalStorage } from 'node:async_hooks'
import type { Bindings } from '../../auth.server'

// A real elapsed-time budget, independent of the scheduler's dispatch clock.
// It is deliberately shorter than the durable claim's recovery lease.
export const EXECUTION_TIMEOUT_MS = 60_000
export const OPERATION_CANCEL_POLL_MS = 250
export class ExecutionStopped extends Error {
 constructor() { super('OPS-001 stopped execution') }
}
const current = new AsyncLocalStorage<ExecutionScope>()

// This is an explicit network edge, never a process-wide fetch replacement.
// The scope also survives detached async continuations, so they cannot start
// another request after their step has returned or lost its claim.
export async function scopedFetch(input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> {
 const scope = current.getStore()
 if (!scope) return fetch(input, init)
 await scope.checkClaim()
 const requestSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined)
 const signal = requestSignal ? AbortSignal.any([scope.signal, requestSignal]) : scope.signal
 return fetch(input, { ...init, signal })
}

export class ExecutionScope {
 private controller = new AbortController()
 readonly signal = this.controller.signal
 readonly env: Bindings
 constructor(private original: Bindings, private id: string, private deadline: number) {
  this.env = { ...original, DB: this.database(), EXHIBITS: this.bucket(original.EXHIBITS) }
 }
 private stop() { this.controller.abort(new ExecutionStopped()) }
 private assertActive() {
  if (Date.now() >= this.deadline) this.stop()
  if (this.signal.aborted) throw new ExecutionStopped()
 }
 async checkClaim() {
  this.assertActive()
  const running = await this.original.DB.prepare("SELECT 1 FROM operation_steps WHERE id=? AND outcome='running'").bind(this.id).first()
  this.assertActive()
  if (!running) { this.stop(); throw new ExecutionStopped() }
 }
 async run<T>(work: (env: Bindings) => Promise<T>): Promise<T> {
  let deadlineTimer: ReturnType<typeof setTimeout> | undefined
  let pollTimer: ReturnType<typeof setTimeout> | undefined
  const poll = async () => {
   try { await this.checkClaim() } catch { this.stop() }
   if (!this.signal.aborted) pollTimer = setTimeout(poll, OPERATION_CANCEL_POLL_MS)
  }
  try {
   this.assertActive()
   const stopped = new Promise<never>((_, reject) => {
    this.signal.addEventListener('abort', () => reject(new ExecutionStopped()), { once: true })
   })
   deadlineTimer = setTimeout(() => this.stop(), Math.max(0, this.deadline - Date.now()))
   pollTimer = setTimeout(poll, OPERATION_CANCEL_POLL_MS)
   return await Promise.race([Promise.resolve().then(() => current.run(this, async () => {
    const result = await work(this.env)
    await this.checkClaim()
    return result
   })), stopped])
  } finally {
   clearTimeout(deadlineTimer)
   clearTimeout(pollTimer)
   // Seal even successful/failed scopes before publishing their terminal row.
   this.stop()
  }
 }
 private database(): D1Database {
  const original = this.original.DB
  const statements = new WeakMap<D1PreparedStatement, D1PreparedStatement>()
  const execute = async (items: D1PreparedStatement[]) => {
   this.assertActive()
   const raw = items.map(item => {
    const statement = statements.get(item)
    if (!statement) throw new Error('OPS-001 unscoped statement')
    return statement
   })
   // D1 batch is one transaction. A stale claim makes the first statement
   // fail, rolling back every effect, even INSERT/UPDATE ... RETURNING or a
   // write mistakenly executed through all()/first(). No read/write guessing.
   const guard = original.prepare("SELECT CASE WHEN EXISTS(SELECT 1 FROM operation_steps WHERE id=? AND outcome='running') THEN 1 ELSE json('OPS-001 stopped execution') END AS active").bind(this.id)
   let result: D1Result[]
   try { result = await original.batch([guard, ...raw]) }
   catch (error) { await this.checkClaim(); throw error }
   this.assertActive()
   return result.slice(1)
  }
  const wrap = (statement: D1PreparedStatement): D1PreparedStatement => {
   let proxy: D1PreparedStatement
   proxy = new Proxy(statement, { get: (target, key) => {
    if (key === 'bind') return (...values: unknown[]) => { this.assertActive(); return wrap(target.bind(...values)) }
    if (key === 'all' || key === 'run') return async () => (await execute([proxy]))[0]
    if (key === 'first') return async (column?: string) => {
     const row = (await execute([proxy]))[0].results[0] as Record<string, unknown> | undefined
     if (!row) return null
     if (column === undefined) return row
     if (!(column in row)) throw new Error('D1_COLUMN_NOTFOUND')
     return row[column]
    }
    // Scheduled product work uses object results. Fail closed for the raw
    // transport, whose column metadata cannot be preserved by D1 batch.
    if (key === 'raw') return async () => { throw new Error('OPS-001 raw statements are not supported in scheduled work') }
    return undefined
   } })
   statements.set(proxy, statement)
   return proxy
  }
  return new Proxy(original, { get: (_target, key) => {
   if (key === 'prepare') return (query: string) => { this.assertActive(); return wrap(original.prepare(query)) }
   if (key === 'batch') return execute
   // Unbatched SQL and sessions would escape the atomic claim fence.
   if (key === 'exec' || key === 'dump' || key === 'withSession') return () => { throw new Error('OPS-001 unguarded database transport') }
   return undefined
  } })
 }
 private bucket(bucket: R2Bucket): R2Bucket {
  // R2 has no transaction shared with D1. An already-dispatched storage call
  // can finish after stop; it cannot authorize a later product DB write.
  const guarded = <T extends object>(target: T): T => new Proxy(target, { get: (object, key) => {
   const value = Reflect.get(object, key, object)
   if (typeof value !== 'function') return value
   // Resuming a multipart handle itself is synchronous; guard all its calls.
   if (key === 'resumeMultipartUpload') return (...args: unknown[]) => { this.assertActive(); return guarded(Reflect.apply(value, object, args)) }
   return async (...args: unknown[]) => {
    await this.checkClaim()
    const result = await Reflect.apply(value, object, args)
    await this.checkClaim()
    return key === 'createMultipartUpload' ? guarded(result) : result
   }
  } })
  return guarded(bucket)
 }
}
