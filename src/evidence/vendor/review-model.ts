import { extractText } from 'unpdf'
import { Refusal } from '../upload'
export const fieldKinds=['report-type','period','auditor','opinion','exception','subservice','cuec','finding'] as const
export interface Field {id:string;kind:typeof fieldKinds[number];value:string;page:number;quote:string}
export interface Extraction {document_id:string;document_sha256:string;pages:string[];fields:Field[];unresolved:string[]}
// Local PDF.js text extraction only. No document leaves this installation and
// no text is executable instruction. Unreadable/encrypted/scanned material is
// explicitly refused, never treated as a clean report.
export async function readPages(bytes:ArrayBuffer):Promise<string[]> {
 try {
  const parsed=await extractText(new Uint8Array(bytes),{mergePages:false})
  if(!parsed.totalPages||parsed.totalPages>250||parsed.text.join('').length>500000||!parsed.text.some(p=>p.trim()))throw Error()
  return parsed.text
 }catch{throw new Refusal('This PDF has no readable text or exceeds 250 pages / 500,000 text characters. Upload a text-readable report; no clean review is claimed.',422)}
}
export function extractFields(id:string,digest:string,pages:string[],kind:string):Extraction {
 const fields:Field[]=[]
 const add=(kind:Field['kind'],value:string,page:number,quote:string)=>{if(value.trim()&&!fields.some(f=>f.kind===kind&&f.value===value.trim()))fields.push({id:'field-'+(fields.length+1),kind,value:value.trim(),page,quote:quote.trim()})}
 for(const [i,text] of pages.entries()) {
  const page=i+1
  for(const raw of text.split(/\n/)){const line=raw.trim();if(!line)continue
   let m:RegExpExecArray|null
   if((m=/\bSOC\s*[12]\s*(?:Report\s*)?Type\s*(II|I)\b/i.exec(line)))add('report-type',m[0],page,line)
   if((m=/(?:period(?: covered| of review)?|as.of(?: date)?)\s*[:\-]\s*(.+)/i.exec(line)))add('period',m[1],page,line)
   if((m=/(?:service auditor|independent (?:service )?auditor|auditor)\s*[:\-]\s*(.+)/i.exec(line)))add('auditor',m[1],page,line)
   if((m=/(?:opinion\s*[:\-]\s*)(unqualified|qualified|adverse|disclaimer)\b/i.exec(line)))add('opinion',m[1].toLowerCase(),page,line)
   if(/\bin our opinion\b/i.test(line))add('opinion',/except for|qualified/i.test(line)?'qualified':/do not express|disclaim/i.test(line)?'disclaimer':/not (?:fairly|effective)|adverse/i.test(line)?'adverse':'unqualified',page,line)
   if((m=/(?:tested.control exception|exception)\s*(?:[A-Za-z0-9.-]+)?\s*:\s*(.+)/i.exec(line))&&!/\bno exceptions?\b/i.test(m[1]))add('exception',m[1],page,line)
   if((m=/(?:subservice organization|subprocessor)\s*:\s*(.+)/i.exec(line)))add('subservice',m[1],page,line)
   if((m=/(?:CUEC|complementary user entity control)\s*(?:[A-Za-z0-9.-]+)?\s*:\s*(.+)/i.exec(line)))add('cuec',m[1],page,line)
   if((m=/(?:finding|recommendation|limitation|exception to agreement)\s*(?:[A-Za-z0-9.-]+)?\s*:\s*(.+)/i.exec(line)))add('finding',m[1],page,line)
  }
 }
 const required=kind==='soc1'||kind==='soc2'?['report-type','period','auditor','opinion','exception','subservice','cuec']:['finding']
 return {document_id:id,document_sha256:digest,pages,fields,unresolved:required.filter(k=>!fields.some(f=>f.kind===k)).map(k=>`${k}: not extracted; inspect every original page. Absence of extraction is not assurance of absence.`)}
}
export function validateExtraction(value:Extraction) {
 if(!value||!Array.isArray(value.pages)||value.pages.length>250||!Array.isArray(value.fields)||value.fields.length>2000||!Array.isArray(value.unresolved))throw new Refusal('Invalid review proposal.')
 for(const f of value.fields)if(!fieldKinds.includes(f.kind)||!Number.isInteger(f.page)||f.page<1||f.page>value.pages.length||typeof f.value!=='string'||!f.value.trim()||f.value.length>4000||typeof f.quote!=='string'||!f.quote.trim()||!value.pages[f.page-1].includes(f.quote))throw new Refusal('Each field must cite a real passage on its exact source page.')
 if(new Set(value.fields.map(f=>f.id)).size!==value.fields.length)throw new Refusal('Duplicate review field.')
}
