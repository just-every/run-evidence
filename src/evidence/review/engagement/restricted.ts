// A single projection protects pages, observation reads, previews and packs.
// Hidden values are removed wherever repeated, including criteria and prose.
export async function restrictProjection<T>(data:T,engagement:string,settings:{detail_level:string;hidden_attributes:string[]}):Promise<T>{
 if(settings.detail_level!=='Restricted')return data
 const hidden=new Set(settings.hidden_attributes),values=new Set<string>(),identifiers=new Set<string>()
 const collect=(value:unknown)=>{
  if(Array.isArray(value)){value.forEach(collect);return}
  if(!value||typeof value!=='object')return
  const row=value as Record<string,unknown>
  for(const [key,item]of Object.entries(row)){
   if(key==='resource_id'&&typeof item==='string')identifiers.add(item)
   if(hidden.has(key.toLowerCase()))scalars(item)
   if(key==='attribute'&&typeof item==='string'&&hidden.has(item.toLowerCase()))scalars(row.value)
   collect(item)
  }
 }
 const scalars=(value:unknown)=>{if(Array.isArray(value))value.forEach(scalars);else if(value&&typeof value==='object')Object.values(value).forEach(scalars);else if(value!==null&&value!==undefined&&String(value))values.add(String(value))}
 collect(data)
 const encoded=JSON.stringify(data)
 if(hidden.has('email')||hidden.has('emails'))for(const match of encoded.matchAll(/[A-Z0-9.!#$%&'*+\/?=^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi))values.add(match[0])
 if([...hidden].some(k=>['ip','ip_address','ip_addresses'].includes(k)))for(const match of encoded.matchAll(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g))values.add(match[0])
 for(const id of identifiers)values.add(id)
 const replacements=new Map<string,string>()
 for(const value of values){
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(engagement+'\u0000'+value.toLowerCase()))
  replacements.set(value,'subject-'+Array.from(new Uint8Array(digest)).slice(0,12).map(n=>n.toString(16).padStart(2,'0')).join(''))
 }
 const sorted=[...replacements].sort((a,b)=>b[0].length-a[0].length)
 const hiddenValue=(value:unknown):unknown=>Array.isArray(value)?value.map(hiddenValue):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,hiddenValue(v)])):value===null?null:replacements.get(String(value))??'[hidden]'
 const scrub=(value:unknown):unknown=>{
  if(typeof value==='string'){
   let result=value
   for(const [original,replacement]of sorted)result=result.replace(new RegExp(original.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'),replacement)
   return result
  }
  if(Array.isArray(value))return value.map(scrub)
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,hidden.has(key.toLowerCase())||(key==='value'&&hidden.has(String((value as Record<string,unknown>).attribute).toLowerCase()))?hiddenValue(item):scrub(item)]))
  return value
 }
 return scrub(data) as T
}
