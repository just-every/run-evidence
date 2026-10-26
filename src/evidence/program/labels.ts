import { frameworks, type FrameworkId } from '../library'

export const editionLabel = (framework: string, id: string) => frameworks[framework as FrameworkId]?.editions.find(e => e.id === id)?.label ?? 'Edition unavailable'
