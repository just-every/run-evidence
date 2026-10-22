import { soc2 } from './soc2'
import { iso27001 } from './iso27001'
import { hipaa } from './hipaa'
import { pci } from './pci'
import { libraryControls as coreControls } from './controls'
import { extendedControls } from './extended/controls'
import { extendedFrameworks, extendedMaps } from './extended'
import { libraryRevisions } from './revisions'
import type { CoreFrameworkId, Framework, FrameworkId, LibraryControl } from './types'
export type { Framework, FrameworkId, LibraryControl } from './types'
export type { LibraryRevision, MappingChange } from './revisions'
export { libraryRevisions }
export const coreFrameworks: Record<CoreFrameworkId, Framework> = { soc2, iso27001, hipaa, pci }
export const frameworks = { ...coreFrameworks, ...extendedFrameworks } as Record<FrameworkId, Framework>
// The shipped library at revision 1: the core controls plus the privacy, AI and CUI controls, each carrying its extended-program mappings.
export const libraryControls: LibraryControl[] = [...coreControls, ...extendedControls].map(c => extendedMaps[c.id] ? { ...c, maps: { ...c.maps, ...extendedMaps[c.id] } } : c)
export const frameworkIds = Object.keys(frameworks) as FrameworkId[]
export const coreFrameworkIds = Object.keys(coreFrameworks) as CoreFrameworkId[]
export const isFramework = (value: unknown): value is FrameworkId => typeof value === 'string' && Object.hasOwn(frameworks, value)
export const edition = (framework: FrameworkId, id: string) => frameworks[framework].editions.find(e => e.id === id)
export const latestEdition = (framework: FrameworkId) => frameworks[framework].editions[0]
export const libraryControl = (id: string) => libraryControls.find(c => c.id === id)
export const latestLibraryRevision = Math.max(1, ...libraryRevisions.map(r => r.revision))
export const isLibraryRevision = (revision: number) => Number.isInteger(revision) && revision >= 1 && revision <= latestLibraryRevision

// The library's mappings at one shipped revision: revision 1 plus every change
// set up to it. Titles, proof, tests and policies are the same at every revision.
const atRevision = new Map<number, LibraryControl[]>()
export function libraryAt(revision: number): LibraryControl[] {
 if (!isLibraryRevision(revision)) throw new Error(`Unknown library revision ${revision}`)
 const known = atRevision.get(revision)
 if (known) return known
 const changes = libraryRevisions.filter(r => r.revision <= revision).flatMap(r => r.changes)
 const controls = libraryControls.map(c => {
  const own = changes.filter(x => x.control === c.id)
  if (!own.length) return c
  const maps: LibraryControl['maps'] = Object.fromEntries(Object.entries(c.maps).map(([f, refs]) => [f, [...refs]]))
  for (const x of own) maps[x.framework] = x.change === 'added' ? [...new Set([...(maps[x.framework] ?? []), x.ref])] : (maps[x.framework] ?? []).filter(r => r !== x.ref)
  return { ...c, maps }
 })
 atRevision.set(revision, controls)
 return controls
}
// Library controls mapped to one requirement of one edition at one library
// revision. An edition whose requirements name successors inherits the
// mappings of those successors.
export function controlsFor(framework: FrameworkId, editionId: string, ref: string, revision: number): LibraryControl[] {
 const requirement = edition(framework, editionId)?.requirements.find(r => r.ref === ref)
 if (!requirement) return []
 const refs = requirement.successors ?? [ref]
 return libraryAt(revision).filter(c => (c.maps[framework] ?? []).some(r => refs.includes(r)))
}
export function mappedControls(framework: FrameworkId, editionId: string, revision: number) {
 const found = new Map<string, LibraryControl>()
 for (const r of edition(framework, editionId)?.requirements ?? []) for (const c of controlsFor(framework, editionId, r.ref, revision)) found.set(c.id, c)
 return [...found.values()]
}
// The reviewable difference between two editions of one framework.
export function editionChange(framework: FrameworkId, fromId: string, toId: string) {
 const from = edition(framework, fromId), to = edition(framework, toId)
 if (!from || !to || fromId === toId) return null
 const next = (r: { ref: string; successors?: string[] }) => r.successors ?? [r.ref]
 const carried = to.requirements.map(r => ({ ref: r.ref, title: r.title, from: from.requirements.filter(p => next(p).includes(r.ref)).map(p => p.ref) }))
 return {
  framework, from: fromId, to: toId,
  added: carried.filter(r => !r.from.length).map(({ ref, title }) => ({ ref, title })),
  carried: carried.filter(r => r.from.length),
  removed: from.requirements.filter(r => !next(r).some(s => to.requirements.some(t => t.ref === s))).map(({ ref, title }) => ({ ref, title })),
 }
}
