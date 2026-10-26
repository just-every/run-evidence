import type { Bindings } from '../../auth.server'
import { usText } from '../format'

// Retained provenance stays exact in the API and export. Pages resolve the
// recorded upload reference and keep the exhibit's original file name.
export async function revocationEvidence(env: Bindings, evidence: string) {
 let text = evidence
 const uploaded = /^Re-uploaded list ([a-f0-9-]{36}) at /.exec(text)
 if (uploaded) {
  const original = await env.DB.prepare('SELECT filename FROM population_uploads WHERE id=?').bind(uploaded[1]).first<{ filename: string }>()
  text = text.replace(`list ${uploaded[1]}`, original ? `list "${original.filename}"` : 'list (original unavailable)')
 }
 text = text.replace(/ kept as receipt [a-f0-9-]{36}, attached by /,' attached by ')
 return usText(text)
}
