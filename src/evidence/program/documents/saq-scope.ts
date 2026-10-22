import scopes from './saq-scopes.json'
import { saqWording } from './saq-wording'
import type { Saq } from './pci'
export interface SaqScope { ids: string[]; revision: string; source: string; sha256: string }
export const currentScopes = scopes as Record<Saq, SaqScope>
// Revision 3 carries the actual January 2025 SAQ A update as a reviewable
// library change. Existing approved worksheets keep their original facts.
export function saqScope(type: Saq, libraryRevision: number): SaqScope {
 const current = currentScopes[type]
 return type === 'A' && libraryRevision < 3 ? { ...current, ids: [...current.ids, '6.4.3', '11.6.1', '12.3.1'].sort((a, b) => a.localeCompare(b, 'en', { numeric: true })), revision: 'v4.0.1 · October 2024 (superseded; review library revision 3)', source: 'https://docs-prv.pcisecuritystandards.org/SAQ%20(Assessment)/SAQ/PCI-DSS-v4-0-1-SAQ-A.pdf', sha256: '' } : current
}
export const saqPrompt = (ref: string) => {
 const value = saqWording[ref]
 if (!value) throw Error('SAQ mapping has no Evidence wording for ' + ref)
 return value
}
export const responseChoices = (type: Saq) => ['in place', 'in place with CCW', 'not applicable', ...(type.startsWith('D-') ? ['not tested'] : []), 'not in place']
export const explanationNeeded = (response: string) => response !== 'in place'
export const explanationPrompt = (response: string) => response === 'in place with CCW' ? 'Explain the constraint, objective, risk, compensating controls, validation and maintenance (CCW).' : response === 'not applicable' ? 'Explain why this requirement does not apply (Appendix C).' : response === 'not tested' ? 'Explain the testing limitation and reason (Appendix D).' : 'Record what is missing and the remediation plan for the assessor’s Part 4.'
