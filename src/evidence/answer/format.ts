import { parseTable,parseCsv,type Table } from '../tabular'
import { unzip } from '../import/zip'
import { zip } from '../program/documents/zip'
import { Refusal } from '../upload'
export const xml=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')
const plain=(s:string)=>s.replace(/<[^>]*>/g,'').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&quot;','"').replaceAll('&amp;','&').trim()
export interface Question {id:string;section:string;question:string;format:string;row:number}
export interface Mapping {id:string;question:string;section:string;format:string;answer:string}
export function readQuestionnaire(filename:string,bytes:Uint8Array,mapping:Mapping) {
 let table:Table
 if(/\.docx$/i.test(filename)){
  const file=unzip(bytes).get('word/document.xml');if(!file)throw new Refusal('DOCX document.xml is missing.')
  const rows=[...new TextDecoder().decode(file).matchAll(/<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/g)].map(m=>[...m[0].matchAll(/<w:tc\b[^>]*>[\s\S]*?<\/w:tc>/g)].map(c=>plain(c[0])))
  if(rows.length<2)throw new Refusal('Use a DOCX questionnaire table with one header row and one question per row.')
  const [headers,...data]=rows;table={headers,rows:data.map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??''])))}
 }else table=parseTable(filename,bytes)
 for(const key of ['id','question'] as const)if(!table.headers.includes(mapping[key]))throw new Refusal('Choose the question ID and text columns from the file.')
 if(!mapping.answer||!table.headers.includes(mapping.answer))throw new Refusal('Choose an existing answer column so the original template layout is preserved.')
 const questions=table.rows.map((r,i)=>({id:r[mapping.id],question:r[mapping.question],section:r[mapping.section]??'',format:r[mapping.format]??'text',row:i+2})).filter(q=>q.id||q.question)
 if(!questions.length||questions.length>2000||questions.some(q=>!q.id||!q.question)||new Set(questions.map(q=>q.id)).size!==questions.length)throw new Refusal('Provide 1–2,000 complete questions with stable, unique IDs.')
 return {questions,format:filename.toLowerCase().split('.').at(-1)!}
}
const csvCell=(s:string)=>'"'+s.replaceAll('"','""')+'"'
export function exportAnswers(filename:string,bytes:Uint8Array,mapping:Mapping,answers:Map<string,string>) {
 if(/\.csv$/i.test(filename)){
  const table=parseCsv(new TextDecoder().decode(bytes));return new TextEncoder().encode([table.headers.map(csvCell).join(','),...table.rows.map(r=>table.headers.map(h=>csvCell(h===mapping.answer?((v=>/^[=+\-@\t\r]/.test(v)?"'"+v:v)(answers.get(r[mapping.id])??r[h])):r[h])).join(','))].join('\r\n')+'\r\n')
 }
 const entries=unzip(bytes),files:Record<string,string|Uint8Array>=Object.fromEntries(entries)
 if(/\.docx$/i.test(filename)) {
  let first=true
  files['word/document.xml']=new TextDecoder().decode(entries.get('word/document.xml')!).replace(/<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/g,row=>{
   const cells=[...row.matchAll(/<w:tc\b[^>]*>[\s\S]*?<\/w:tc>/g)].map(m=>m[0]);if(first){first=false;return row}
   const header=[...new TextDecoder().decode(entries.get('word/document.xml')!).matchAll(/<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/g)][0]?.[0]??'',headers=[...header.matchAll(/<w:tc\b[^>]*>[\s\S]*?<\/w:tc>/g)].map(m=>plain(m[0]))
   const answer=answers.get(plain(cells[headers.indexOf(mapping.id)]??'')),index=headers.indexOf(mapping.answer);if(answer===undefined||!cells[index])return row
   const old=cells[index],props=/<w:tcPr\b[^>]*>[\s\S]*?<\/w:tcPr>/.exec(old)?.[0]??'',replacement=old.slice(0,old.indexOf('>')+1)+props+`<w:p><w:r><w:t xml:space="preserve">${xml(answer)}</w:t></w:r></w:p></w:tc>`
   return row.replace(old,replacement)
  })
 }else{
  const table=parseTable(filename,bytes),answerCol=table.headers.indexOf(mapping.answer),idCol=table.headers.indexOf(mapping.id),col=(n:number):string=>n<26?String.fromCharCode(65+n):col(Math.floor(n/26)-1)+col(n%26)
  // The input reader admits the first worksheet; preserve all other workbook
  // entries and update only its existing answer cells, including cell styles.
  const workbook=new TextDecoder().decode(entries.get('xl/workbook.xml')!),rels=new TextDecoder().decode(entries.get('xl/_rels/workbook.xml.rels')!),rid=/<sheet\b[^>]*\br:id="([^"]+)"/.exec(workbook)?.[1],target=new RegExp(`<Relationship\\b[^>]*Id="${rid}"[^>]*Target="([^"]+)"`).exec(rels)?.[1]??new RegExp(`<Relationship\\b[^>]*Target="([^"]+)"[^>]*Id="${rid}"`).exec(rels)?.[1],path=target?.startsWith('/')?target.slice(1):'xl/'+target?.replace(/^\.\//,'')
  if(!entries.has(path))throw new Refusal('Original worksheet is unavailable.')
  const shared=new TextDecoder().decode(entries.get('xl/sharedStrings.xml')??new Uint8Array()),strings=[...shared.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map(m=>plain(m[1]))
  files[path]=new TextDecoder().decode(entries.get(path)!).replace(/<row\b[^>]*>[\s\S]*?<\/row>/g,row=>{
   const n=Number(/\br="(\d+)"/.exec(row)?.[1]),idCell=new RegExp(`<c\\b[^>]*r="${col(idCol)}${n}"[^>]*>([\\s\\S]*?)<\\/c>`).exec(row)
   if(!idCell)return row
   const raw=/<v>([\s\S]*?)<\/v>/.exec(idCell[1])?.[1],qid=/\bt="s"/.test(idCell[0])?strings[Number(raw)]:plain(idCell[1]),answer=answers.get(qid)
   if(answer===undefined)return row
   const ref=col(answerCol)+n,pattern=new RegExp(`<c\\b[^>]*r="${ref}"[^>]*(?:/>|>[\\s\\S]*?<\\/c>)`),old=pattern.exec(row)?.[0],attrs=old?old.slice(0,old.indexOf('>')).replace(/\bt="[^"]*"/g,'').replace(/\/$/,''):`<c r="${ref}"`,replacement=attrs+` t="inlineStr"><is><t xml:space="preserve">${xml(answer)}</t></is></c>`
   return old?row.replace(old,replacement):row.replace('</row>',replacement+'</row>')
  })
 }
 return zip(files)
}

// A reviewer may map an exact cited passage to a declared binary choice.
// Unknown formats remain flagged rather than guessing the buyer's vocabulary.
export function choiceValues(format:string):string[] {
 const match=/^(yes)\s*[/|,]\s*(no)(?:\s*[/|,]\s*(na|n\/a|not applicable))?$/i.exec(format.trim())
 return match?match.slice(1).filter((s):s is string=>!!s):[]
}
