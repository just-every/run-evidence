import { fail } from './format'
import type { Store } from './registry'
export interface Journal {format:'evidence-erasure-journal';version:1;lineage:string;sequence:number;exported_at:string;entries:{sequence:number;recorded_at:string;receipt:string}[]}
export interface SourceLineage {lineage:string;sequence:number;generation:number}
export async function sourceLineage(env:Store):Promise<SourceLineage> {return (await env.DB.prepare('SELECT lineage,generation,COALESCE((SELECT MAX(sequence) FROM (SELECT sequence,lineage FROM portable_journal UNION ALL SELECT sequence,lineage FROM portable_history) WHERE lineage=portable_state.lineage),0) AS sequence FROM portable_state WHERE singleton=1').first<SourceLineage>())!}
export async function exportJournal(env:Store,now=new Date()):Promise<Journal> {
 const source=await sourceLineage(env)
 // Journal receipts carry no erased content. Export the high-water mark; the
 // full journal remains in D1 and travels in bounded archive journal frames.
 return {format:'evidence-erasure-journal',version:1,lineage:source.lineage,sequence:source.sequence,exported_at:now.toISOString(),entries:[]}
}
export function validateJournal(value:unknown):Journal {
 const j=value as Journal
 if(!j||j.format!=='evidence-erasure-journal'||j.version!==1||typeof j.lineage!=='string'||!/^[a-zA-Z0-9_-]{16,128}$/.test(j.lineage)||!Number.isSafeInteger(j.sequence)||j.sequence<0||typeof j.exported_at!=='string'||!Number.isFinite(Date.parse(j.exported_at))||!Array.isArray(j.entries)||j.entries.length>10000)fail('Invalid source erasure journal.')
 for(const e of j.entries)if(!Number.isSafeInteger(e.sequence)||e.sequence<1||e.sequence>j.sequence||typeof e.recorded_at!=='string'||!Number.isFinite(Date.parse(e.recorded_at))||typeof e.receipt!=='string'||!e.receipt)fail('Invalid erasure journal receipt.')
 return j
}
export async function checkHistory(env:Store,source:SourceLineage,journal:unknown,acknowledged=false) {
 const known=await env.DB.prepare('SELECT max(sequence) AS sequence FROM (SELECT sequence FROM portable_history WHERE lineage=? UNION ALL SELECT sequence FROM portable_journal WHERE lineage=?)').bind(source.lineage,source.lineage).first<{sequence:number|null}>()
 let latest=known?.sequence??-1
 if(journal){const supplied=validateJournal(journal);if(supplied.lineage!==source.lineage)fail('The supplied journal belongs to a different source lineage.');latest=Math.max(latest,supplied.sequence);await env.DB.prepare('INSERT INTO portable_history(lineage,sequence,checked_at) VALUES(?,?,?) ON CONFLICT(lineage) DO UPDATE SET sequence=max(sequence,excluded.sequence),checked_at=excluded.checked_at').bind(supplied.lineage,supplied.sequence,supplied.exported_at).run()}
 if(latest>source.sequence)fail('A later source erasure journal fences this older archive. Obtain a new archive after erasure; no records were admitted.')
 return {erasure_history:latest<0?'unverified':'verified',requires_latest_journal:latest<0&&!acknowledged,sequence:Math.max(latest,source.sequence)}
}
