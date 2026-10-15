import type { Bindings } from '../../auth.server'
import { validDate } from '../model'
import { controls } from '../review/storage'
import type { FolderInput } from '../review/types'
import { boundedBody, Refusal } from '../upload'
export async function inputBody(request:Request):Promise<Record<string,unknown>> {
 const text=new TextDecoder().decode(await boundedBody(request,32768))
 if(request.headers.get('content-type')?.startsWith('application/json')) {
  try { const value=JSON.parse(text); if(!value || typeof value!=='object' || Array.isArray(value)) throw Error(); return value } catch { throw new Refusal('Use a JSON object.') }
 }
 if(request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) return Object.fromEntries(new URLSearchParams(text))
 throw new Refusal('Use JSON or the owner form.')
}
export function future(value:unknown,now:Date) {
 if(typeof value!=='string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,3})?)?Z?$/.test(value)) throw new Refusal('Choose a future UTC expiry.')
 const date=new Date(value.endsWith('Z')?value:value+'Z')
 if(!validDate(value.slice(0,10)) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0,16)!==value.slice(0,16) || date.getTime()<=now.getTime()) throw new Refusal('Choose a future UTC expiry.')
 return date.toISOString()
}
export async function folderInput(env:Bindings,value:Record<string,unknown>,now:Date):Promise<FolderInput> {
 if(typeof value.reviewer_label!=='string' || !value.reviewer_label.trim() || value.reviewer_label.trim().length>300) throw new Refusal('Name the reviewer (up to 300 characters).')
 if(!validDate(value.period_from) || !validDate(value.period_to) || value.period_from>value.period_to) throw new Refusal('Choose a real inclusive UTC period.')
 if(!Array.isArray(value.control_ids) || !value.control_ids.length || value.control_ids.length>500 || value.control_ids.some(id=>typeof id!=='string')) throw new Refusal('Select existing controls.')
 const ids=[...new Set(value.control_ids as string[])].sort(), known=new Set((await controls(env)).map(c=>c.id))
 if(ids.some(id=>!known.has(id))) throw new Refusal('Select existing controls.')
 return { reviewer_label:value.reviewer_label.trim(),period_from:value.period_from,period_to:value.period_to,expires_at:future(value.expires_at,now),control_ids:ids }
}
