import type { FrameworkId } from './types'
// LIBRARY-004: shipped library revisions after revision 1 (controls.ts). Each is
// a reviewable change set of control-to-requirement mappings. An installation
// keeps its accepted revision until the owner accepts a later one; accepting
// revision N applies every change set up to and including N.
export interface MappingChange { control: string; framework: FrameworkId; ref: string; change: 'added' | 'removed' }
export interface StateChange { framework: 'usdp'; state: string; summary: string }
export interface LibraryRevision { revision: number; shipped: string; summary: string; changes: MappingChange[]; stateChanges?: StateChange[]; saqChanges?: { type: string; from: string; to: string; removed: string[] }[] }
export const libraryRevisions: LibraryRevision[] = [
 { revision: 2, shipped: '2026-10-20', summary: 'Account lockout counts toward secure authentication, and service accounts toward identity management.', changes: [
  { control: 'AC-12', framework: 'iso27001', ref: 'A.8.5', change: 'added' },
  { control: 'AC-12', framework: 'soc2', ref: 'CC6.1', change: 'added' },
  { control: 'AC-13', framework: 'iso27001', ref: 'A.5.16', change: 'added' },
 ] },
 { revision: 3, shipped: '2026-10-22', summary: 'Review SAQ A v4.0.1 r1 (January 2025): removes 6.4.3, 11.6.1 and 12.3.1 from the worksheet. The new eligibility criteria must be confirmed against the licensed SAQ. Approved SAQ A worksheets are flagged for review; prior revisions stay retrievable.', changes: [], saqChanges: [{ type: 'A', from: 'v4.0.1 · October 2024', to: 'v4.0.1 r1 · January 2025', removed: ['6.4.3', '11.6.1', '12.3.1'] }] },
 { revision: 4, shipped: '2026-10-22', summary: 'US Data Privacy: Connecticut SB 1295 (effective 1 July 2026) lowers the Connecticut Data Privacy Act threshold to 35,000 consumers, or processing sensitive data, or selling personal data. USDP programs show any resulting state change for review; nothing changes until you accept it.', changes: [], stateChanges: [{ framework: 'usdp', state: 'CT', summary: 'Threshold 100,000 consumers, or 25,000 consumers and more than 25% of gross revenue from selling personal data -> 35,000 consumers, or sensitive data, or selling personal data.' }] },
]
