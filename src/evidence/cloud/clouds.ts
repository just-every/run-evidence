import { gcp } from './gcp'
import { azure } from './azure'
import type { ScopedCloud } from './scoped'
// Clouds organized in projects or subscriptions, read by the scoped collector.
export const scopedClouds: Record<string, ScopedCloud> = { gcp, azure }
export const isScopedCloud = (provider: string) => Object.hasOwn(scopedClouds, provider)
