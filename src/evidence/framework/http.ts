import { done, json, ownerRoutes, readInput, uuid, type Route } from '../door'
import { Refusal } from '../upload'
import { headers } from '../view'
import { admit, plan, readUpload } from './import'
import { hash } from './model'
import { frameworkReadiness } from './readiness'
import { createFramework, decideMapping, frameworks, mappingHistory, requireFramework, requirements, revisions, saveRequirement } from './storage'
import { frameworkPage, frameworksPage, requirementPage, reviewPage, revisionPage } from './view'
const id=`(${uuid})`, both=(path:string)=>new RegExp(`^/(?:app|api)${path}$`)
export function frameworkHandler(clock:()=>Date) {
 const routes:Route[]=[
  {method:'GET',pattern:both('/frameworks'),run:async c=>{const rows=await frameworks(c.env);return c.isApi?json({frameworks:rows}):frameworksPage(rows,c.actor.name)}},
  {method:'POST',pattern:both('/frameworks'),run:async c=>{const result=await createFramework(c.env,c.actor,await readInput(c.request),c.now);return done(c,'/app/frameworks/'+result.id,result,201)}},
  {method:'GET',pattern:both('/frameworks/template.csv'),run:async()=>new Response('id,title,description,section,control_ids\r\n',{headers:{...headers,'content-type':'text/csv; charset=utf-8','content-disposition':'attachment; filename="framework-template.csv"'}})},
  {method:'POST',pattern:both('/frameworks/import'),run:async c=>{
   const upload=await readUpload(c.request)
   if(upload.confirm){const result=await admit(c.env,c.actor,upload,c.now);return done(c,'/app/frameworks/'+result.id,result,201)}
   const checked=await plan(c.env,upload)
   return c.isApi?json({dry_run:true,...checked}):reviewPage(checked,upload,c.actor.name)
  }},
  {method:'GET',pattern:both(`/frameworks/${id}`),run:async(c,m)=>{const data=await frameworkReadiness(c.env,m[1],c.now),history=await revisions(c.env,m[1]);return c.isApi?json({...data,history}):frameworkPage(data,history,c.actor.name,c.url.searchParams.get('show')??'')}},
  {method:'GET',pattern:both(`/frameworks/${id}/readiness`),run:async(c,m)=>json(await frameworkReadiness(c.env,m[1],c.now))},
  {method:'GET',pattern:both(`/frameworks/${id}/export`),run:async(c,m)=>{
   const framework=await requireFramework(c.env,m[1]), [rows,history,mappings]=await Promise.all([requirements(c.env,m[1]),revisions(c.env,m[1]),mappingHistory(c.env,m[1])])
   return new Response(JSON.stringify({format:'evidence-custom-framework-v1',framework,requirements:rows,revisions:history.map(r=>({...r,snapshot:JSON.parse(r.snapshot_json),differences:JSON.parse(r.diff_json)})),mapping_history:mappings},null,2),{headers:{...headers,'content-type':'application/json; charset=utf-8','content-disposition':'attachment; filename="custom-framework.json"','x-content-type-options':'nosniff'}})
  }},
  {method:'POST',pattern:both(`/frameworks/${id}/requirements`),run:async(c,m)=>{const result=await saveRequirement(c.env,c.actor,m[1],null,await readInput(c.request),c.now);return done(c,`/app/frameworks/${m[1]}/requirements/${result.id}`,result,201)}},
  {method:'GET',pattern:both(`/frameworks/${id}/requirements/${id}`),run:async(c,m)=>{
   const framework=await requireFramework(c.env,m[1]),row=(await requirements(c.env,m[1])).find(q=>q.id===m[2]);if(!row)throw new Refusal('Requirement not found.',404)
   const history=await revisions(c.env,m[1]),mappings=await mappingHistory(c.env,m[1])
   return c.isApi?json({framework,requirement:row,history:history.flatMap(r=>{const q=JSON.parse(r.snapshot_json).requirements.find((x:{id:string})=>x.id===row.id);return q?[{revision:r.revision,actor_name:r.actor_name,at:r.at,requirement:q}]:[]}),mapping_history:mappings.filter(q=>q.requirement_id===row.id)}):requirementPage(framework,row,history,mappings,c.actor.name)
  }},
  {method:'POST',pattern:both(`/frameworks/${id}/requirements/${id}`),run:async(c,m)=>{const result=await saveRequirement(c.env,c.actor,m[1],m[2],await readInput(c.request),c.now);return done(c,`/app/frameworks/${m[1]}/requirements/${m[2]}`,result)}},
  {method:'POST',pattern:both(`/frameworks/${id}/requirements/${id}/mappings`),run:async(c,m)=>{const result=await decideMapping(c.env,c.actor,m[1],m[2],await readInput(c.request),c.now);return done(c,`/app/frameworks/${m[1]}/requirements/${m[2]}`,result)}},
  {method:'GET',pattern:both(`/frameworks/${id}/revisions/([1-9][0-9]*)`),run:async(c,m)=>{const framework=await requireFramework(c.env,m[1]),revision=(await revisions(c.env,m[1])).find(r=>r.revision===Number(m[2]));if(!revision)throw new Refusal('Revision not found.',404);return c.isApi?json({...revision,snapshot:JSON.parse(revision.snapshot_json),differences:JSON.parse(revision.diff_json)}):revisionPage(framework,revision,c.actor.name)}},
  {method:'GET',pattern:both(`/frameworks/${id}/revisions/([1-9][0-9]*)/file`),run:async(c,m)=>{
   const row=await c.env.DB.prepare('SELECT * FROM custom_framework_revisions WHERE framework_id=? AND revision=?').bind(m[1],Number(m[2])).first<{object_key:string|null;filename:string;size:number;sha256:string}>()
   if(!row?.object_key)throw new Refusal('Original file not found.',404)
   const object=await c.env.EXHIBITS.get(row.object_key),bytes=object?new Uint8Array(await object.arrayBuffer()):null
   if(!bytes||bytes.byteLength!==row.size||await hash(bytes)!==row.sha256) return json({error:'Unavailable bytes. The original file record and framework history are retained.'},410)
   return new Response(bytes,{headers:{...headers,'content-type':'application/octet-stream','content-disposition':`attachment; filename*=UTF-8''${encodeURIComponent(row.filename)}`,'x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; sandbox"}})
  }},
 ]
 return ownerRoutes(routes,clock)
}
