import type {Bindings} from '../../../auth.server'
import type {Engagement} from './storage'
import {Refusal} from '../../upload'

// Historical membership and attributes come from retained versions, never the
// resource's current attributes or display name. Exclusion revisions split
// membership too, so a later scope edit cannot erase an earlier population.
export async function sharedPopulation(env:Bindings,e:Engagement,test:string){
 const from=e.period_from+'T00:00:00.000Z',to=new Date(Date.parse(e.period_to+'T00:00:00Z')+86400000).toISOString()
 const [history,definitions]=await env.DB.batch([
  env.DB.prepare(`SELECT v.resource_id,v.change,v.attributes_json,v.source_ref,v.at FROM resource_versions v JOIN resources r ON r.id=v.resource_id
   WHERE r.type=(SELECT resource_type FROM tests WHERE id=?) AND v.at<? AND
   (v.at>=? OR v.rowid=(SELECT p.rowid FROM resource_versions p WHERE p.resource_id=v.resource_id AND p.at<? ORDER BY p.at DESC,p.rowid DESC LIMIT 1))
   ORDER BY v.at,v.rowid LIMIT 5001`).bind(test,to,from,from),
  env.DB.prepare('SELECT revision,excluded_json,at FROM test_revisions WHERE test_id=? AND at<? ORDER BY at,revision LIMIT 5001').bind(test,to),
 ])
 type Version={resource_id:string;change:string;attributes_json:string;source_ref:string;at:string}
 type Definition={revision:number;excluded_json:string;at:string}
 const versions=history.results as Version[],revisions=definitions.results as Definition[]
 if(versions.length>5000||revisions.length>5000)throw new Refusal('Shared test exceeds 5000 population versions; complete population history is unavailable within this read bound.',413)
 const population=[]
 for(const resource_id of new Set(versions.map(v=>v.resource_id))){
  const own=versions.filter(v=>v.resource_id===resource_id)
  const points=[...new Set([from,to,...own.map(v=>v.at),...revisions.map(r=>r.at)].filter(at=>at>=from&&at<=to))].sort()
  const intervals:{from:string;to:string;attributes:Record<string,unknown>;source_ref:string;revision:number}[]=[]
  for(let i=0;i<points.length-1;i++){
   const start=points[i],end=points[i+1],version=own.findLast(v=>v.at<=start),revision=revisions.findLast(r=>r.at<=start)
   if(!version||version.change==='removed'||!revision||JSON.parse(revision.excluded_json).some((x:{resource_id:string})=>x.resource_id===resource_id))continue
   intervals.push({from:start,to:end,attributes:JSON.parse(version.attributes_json),source_ref:version.source_ref,revision:revision.revision})
  }
  if(intervals.length)population.push({resource_id,intervals,changes:own.filter(v=>v.at>=from&&v.at<to&&intervals.some(i=>i.from<=v.at&&v.at<i.to||v.change==='removed'&&i.to===v.at)).map(v=>({change:v.change,at:v.at}))})
 }
 if(new TextEncoder().encode(JSON.stringify(population)).byteLength>8*1024*1024)throw new Refusal('Shared test exceeds 8 MiB of population history; complete population history is unavailable within this read bound.',413)
 return population
}
