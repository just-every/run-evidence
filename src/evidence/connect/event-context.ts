import { AsyncLocalStorage } from 'node:async_hooks'
export interface SourceEvent { id: string; received_at: string; reported_at: string | null }
export const sourceEvent = new AsyncLocalStorage<SourceEvent>()
