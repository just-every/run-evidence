import type { RequirementState } from './readiness'
export interface ChecklistArea { area: string; ready: number; total: number; available: boolean; refs: string[] }
// Counts are requirement denominators, not claims that an unbuilt workflow ran.
export function checklist(requirements: RequirementState[]): ChecklistArea[] {
 const included = requirements.filter(r => r.state === 'included')
 const area = (name: string, rows: RequirementState[], ready: (r: RequirementState) => boolean): ChecklistArea => ({ area: name, ready: rows.filter(ready).length, total: rows.length, available: true, refs: rows.map(r => r.ref) })
 return [
  area('Proof', included, r => r.proof === 'current'),
  area('Automated tests', included, r => r.testing === 'passing'),
  area('Policies', included.filter(r => r.policy !== 'none required'), r => r.policy === 'current'),
  area('Access reviews', included.filter(r => r.controls.some(c => c.library_id === 'AC-04')), r => r.ready),
  area('Vendor risk', included.filter(r => r.controls.some(c => c.library_id?.startsWith('VEN-'))), r => r.ready),
  area('Personnel', included.filter(r => r.controls.some(c => c.library_id?.startsWith('HR-'))), r => r.ready),
  ...['Trust center', 'Auditor decisions', 'Questionnaires'].map(name => ({ area: name, ready: 0, total: 0, available: false, refs: [] })),
 ]
}
