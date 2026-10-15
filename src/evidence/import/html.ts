import { Refusal } from '../upload'
import { safePath } from './zip'
const fail=():never=>{throw new Refusal('Unsupported Drata HTML table. Expected Requirement, Control, Original Path and Abbreviated Filename (/Evidence) columns with relative Evidence/ file links.')}
export function entities(text:string):string{return text.replace(/&(#(?:x[0-9a-f]+|[0-9]+)|amp|lt|gt|quot|apos|nbsp);/gi,(_,key:string)=>{if(key[0]==='#'){const n=key[1]?.toLowerCase()==='x'?parseInt(key.slice(2),16):parseInt(key.slice(1),10);if(!Number.isSafeInteger(n)||n<1||n>0x10ffff||(n>=0xd800&&n<=0xdfff))fail();return String.fromCodePoint(n)}return({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '} as Record<string,string>)[key.toLowerCase()]})}
const plain=(html:string)=>entities(html.replace(/<!--[\s\S]*?-->/g,'').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim()
export interface HtmlRow { requirement:string;control:string;original_path:string;path:string }
export function manifestRows(html:string):HtmlRow[]{
 // Parse an inert, statically rendered table only. Scripts, styles and comments
 // cannot inject apparent rows, and no HTML or JS is executed or shown inline.
 const inert=html.replace(/<!--[\s\S]*?-->/g,'').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'')
 const wanted=['requirement','control','original path','abbreviated filename (/evidence)'],matches:HtmlRow[][]=[]
 for(const table of inert.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table\s*>/gi)){
  const rows=[...table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/gi)],first=rows[0]
  if(!first)continue
  const heads=[...first[1].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]\s*>/gi)].map(m=>plain(m[1]).toLowerCase())
  if(!wanted.every(h=>heads.includes(h)))continue
  if(heads.length!==4||new Set(heads).size!==4)fail()
  if(/\b(?:rowspan|colspan)\s*=/i.test(table[1]))fail()
  const result:HtmlRow[]=[]
  for(const row of rows.slice(1)){
   const cells=[...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td\s*>/gi)].map(m=>m[1]);if(!cells.length)continue;if(cells.length!==4)fail()
   const at=(name:string)=>cells[heads.indexOf(name)],requirement=plain(at('requirement')),control=plain(at('control')),original_path=plain(at('original path'))
   if(!control||control.length>300||requirement.length>1000||!original_path||original_path.length>1000)fail()
   const links=[...at(wanted[3]).matchAll(/<a\b([^>]*)>/gi)]
   if(links.length!==1)fail()
   const hrefs=[...links[0][1].matchAll(/(?:^|\s)href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi)]
   if(hrefs.length!==1)fail()
   let path=entities(hrefs[0][1]??hrefs[0][2]??hrefs[0][3]);if(path.startsWith('./'))path=path.slice(2)
   // URL escapes are decoded once before checking traversal and exact ZIP names.
   try{path=decodeURIComponent(path)}catch{fail()}
   path=safePath(path);if(!path.startsWith('Evidence/')||path.split('/').length!==2)fail()
   result.push({requirement,control,original_path,path})
  }
  matches.push(result)
 }
 if(matches.length!==1||!matches[0].length||matches[0].length>100)fail()
 return matches[0]
}
