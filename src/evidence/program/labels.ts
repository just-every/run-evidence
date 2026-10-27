import { frameworks, type FrameworkId } from '../library'

export const editionLabel = (framework: string, id: string) => frameworks[framework as FrameworkId]?.editions.find(e => e.id === id)?.label ?? 'Edition unavailable'

// Board projections retain the framework name, including historical snapshots.
export const reportEditionLabel = (name: string, id: string) => Object.values(frameworks).find(framework => framework.name === name)?.editions.find(edition => edition.id === id)?.label ?? 'Edition unavailable'
