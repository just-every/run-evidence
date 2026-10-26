import { usDate, usInstant } from '../../format'
// PROGRAM-003 document model. A document is a title, a preparation note and
// sections; renderers turn the same model into PDF, DOCX and XLSX. Evidence
// prepares these documents for the owner and the named assessor; it never
// signs, attests or certifies anything in them.
export interface Cite { kind: string; ref: string; revision?: string | number; label: string }
export interface Statement { text: string; cites: Cite[] }
export interface Table { head: string[]; rows: string[][] }
export interface Section { id: string; heading: string; status: 'prefilled' | 'owner-needed' | 'owner-written'; statements: Statement[]; table?: Table; owner_text?: string }
export interface Rendered { title: string; subtitle: string; notice: string; sections: Section[] }
export const notice = 'Prepared by Evidence for the program owner and the named independent assessor. Evidence does not sign, attest or certify; the assessor, certification body, QSA or merchant decides and signs.'
const citationRevision = (value: string | number) => {
 const inventory = typeof value === 'string' ? /^(\d+)@(.+)$/.exec(value) : null
 return inventory ? `${inventory[1]} resources, updated ${usInstant(inventory[2])}` : String(value)
}
const cite = (c: Cite) => `${c.label}${c.revision !== undefined ? ` (revision ${citationRevision(c.revision)})` : ''}`
// Facts remain machine-comparable in storage; only their display uses prose.
export function factText(value: string): string {
 const plain = (v: unknown): string => Array.isArray(v) ? v.map(plain).filter(Boolean).join(', ') : v && typeof v === 'object' ? Object.entries(v).map(([key, item]) => `${key.replaceAll('_', ' ')}: ${plain(item)}`).join('; ') : v == null ? '' : typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? usDate(v) : String(v)
 try { return plain(JSON.parse(value)) || 'None recorded' } catch { return value.replaceAll('|', '; ') }
}
// The plain text a reader sees for one section, shared by every renderer.
export function sectionLines(s: Section) {
 const lines: string[] = []
 for (const st of s.statements) lines.push(st.cites.length ? `${st.text} Source: ${st.cites.map(cite).join('; ')}.` : st.text)
 if (s.owner_text) lines.push(s.owner_text)
 if (s.status === 'owner-needed' && !s.owner_text) lines.push('NOT SUPPORTED BY RECORDS: the owner must complete this section before approval.')
 return lines
}
