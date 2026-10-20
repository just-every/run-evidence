import type { FrameworkId } from './types'
// LIBRARY-001: shipped library revisions after revision 1 (controls.ts). Each is
// a reviewable change set of control-to-requirement mappings. An installation
// keeps its accepted revision until the owner accepts a later one; accepting
// revision N applies every change set up to and including N.
export interface MappingChange { control: string; framework: FrameworkId; ref: string; change: 'added' | 'removed' }
export interface LibraryRevision { revision: number; shipped: string; summary: string; changes: MappingChange[] }
export const libraryRevisions: LibraryRevision[] = [
 { revision: 2, shipped: '2026-10-20', summary: 'Account lockout counts toward secure authentication, and service accounts toward identity management.', changes: [
  { control: 'AC-12', framework: 'iso27001', ref: 'A.8.5', change: 'added' },
  { control: 'AC-12', framework: 'soc2', ref: 'CC6.1', change: 'added' },
  { control: 'AC-13', framework: 'iso27001', ref: 'A.5.16', change: 'added' },
 ] },
]
