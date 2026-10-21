import { done, json, ownerRoutes, readInput, text, oneOf, uuid, type Route } from '../door'
import { requireControl } from '../program/control'
import { Refusal } from '../upload'
import { page, escape } from '../view'
import { investigation,prepareInvestigation,decideInvestigation } from './period-storage'
import { investigationPage } from './period-view'
const both=(path:string)=>new RegExp(`^/(?:app|api)${path}$`),id=`(${uuid})`
export function periodAgentHandler(clock:()=>Date) {
 const routes:Route[]=[
  {method:'POST',pattern:both(`/controls/${id}/investigate`),run:async(c,m)=>{
   const input=await readInput(c.request),row=await prepareInvestigation(c.env,m[1],text(input,'from',10),text(input,'to',10),c.actor,c.now)
   return done(c,`/app/controls/${m[1]}/investigations/${row.id}`,row,201)
  }},
  {method:'GET',pattern:both(`/controls/${id}/investigations/${id}`),run:async(c,m)=>{
   const row=await investigation(c.env,m[2]);if(row.control_id!==m[1])throw new Refusal('Investigation not found.',404)
   return c.isApi?json(row):investigationPage(row,c.actor.name)
  }},
  {method:'POST',pattern:both(`/controls/${id}/investigations/${id}/decision`),run:async(c,m)=>{
   const row=await investigation(c.env,m[2]);if(row.control_id!==m[1])throw new Refusal('Investigation not found.',404)
   const input=await readInput(c.request),result=await decideInvestigation(c.env,m[2],text(input,'snapshot_hash',64),oneOf(input,'action',['reviewed','rejected']),text(input,'reason',500),c.actor,c.now)
   return done(c,`/app/controls/${m[1]}/investigations/${m[2]}`,result)
  }},
  {method:'GET',pattern:both(`/controls/${id}/investigation-source`),run:async(c,m)=>{
   await requireControl(c.env,m[1])
   const kind=c.url.searchParams.get('kind'),source=c.url.searchParams.get('id')
   const queries:Record<string,string>={
    observation:'SELECT o.* FROM observations o JOIN test_controls tc ON tc.test_id=o.test_id WHERE tc.control_id=?1 AND o.id=?2 UNION SELECT o.* FROM observations o JOIN run_control_definitions d ON d.run_id=o.run_id WHERE d.control_id=?1 AND o.id=?2',
    'resource-version':'SELECT v.* FROM resource_versions v JOIN resources r ON r.id=v.resource_id WHERE v.id=?2 AND (EXISTS(SELECT 1 FROM tests t JOIN test_controls tc ON tc.test_id=t.id WHERE tc.control_id=?1 AND t.resource_type=r.type) OR EXISTS(SELECT 1 FROM control_scope s WHERE s.control_id=?1 AND (s.asset=r.id OR s.asset=r.unique_id)))',
    'control-revision':'SELECT * FROM control_revisions WHERE control_id=? AND id=?',
    'run-definition':'SELECT * FROM run_control_definitions WHERE control_id=? AND run_id=?',
    'test-revision':'SELECT tr.* FROM test_revisions tr JOIN test_controls tc ON tc.test_id=tr.test_id WHERE tc.control_id=? AND tr.id=?',
    scope:'SELECT * FROM control_scope WHERE control_id=? AND id=?',
   }
   if(!kind||!source||!queries[kind])throw new Refusal('Choose a cited source.',404)
   const row=await c.env.DB.prepare(queries[kind]).bind(m[1],source).first()
   if(!row)throw new Refusal('Cited source not found.',404)
   return c.isApi?json(row):page('Original investigation source',`<p>${escape(kind)} · ${escape(source)}</p><pre>${escape(JSON.stringify(row,null,2))}</pre><p><a href="/app/controls/${m[1]}">Return to control</a></p>`,200,{owner:c.actor.name,active:'programs'})
  }},
 ]
 return ownerRoutes(routes,clock)
}
