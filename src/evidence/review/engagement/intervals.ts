import type {Bindings} from '../../../auth.server'
import type {Engagement} from './storage'
import type {sharedPopulation} from './population'
import {CADENCE_MS} from '../../tests/storage'
import {Refusal} from '../../upload'

// Prior observations are read only to establish state at the period boundary;
// their contents never leave this function. Future dates are never labelled
// stale or unknown before the supplied product clock reaches them.
export async function sharedIntervals(env:Bindings,e:Engagement,test:string,population:Awaited<ReturnType<typeof sharedPopulation>>,now:Date){
 const from=e.period_from+'T00:00:00.000Z',end=new Date(Math.min(now.getTime(),Date.parse(e.period_to+'T00:00:00Z')+86400000)).toISOString()
 if(end<=from)return []
 const history=await env.DB.prepare(`SELECT o.resource_id,o.revision,o.result,o.observed_at,r.cadence FROM observations o JOIN test_revisions r ON r.test_id=o.test_id AND r.revision=o.revision
  WHERE o.test_id=? AND o.observed_at<? AND (o.observed_at>=? OR o.rowid=(SELECT p.rowid FROM observations p WHERE p.test_id=o.test_id AND p.resource_id=o.resource_id AND p.observed_at<? ORDER BY p.observed_at DESC,p.rowid DESC LIMIT 1))
  ORDER BY o.observed_at,o.rowid LIMIT 5001`).bind(test,end,from,from).all<{resource_id:string;revision:number;result:string;observed_at:string;cadence:'hourly'|'daily'}>()
 if(history.results.length>5000)throw new Refusal('Shared test exceeds 5000 observations for interval history; use a narrower engagement period.',413)
 const intervals:{resource_id:string;from:string;to:string;state:string}[]=[]
 for(const member of population){
  const observations=history.results.filter(o=>o.resource_id===member.resource_id)
  for(const membership of member.intervals){
   const start=membership.from,to=membership.to<end?membership.to:end
   if(start>=to)continue
   const points=[...new Set([start,to,...observations.flatMap(o=>[o.observed_at,new Date(Date.parse(o.observed_at)+CADENCE_MS[o.cadence]*1.5).toISOString()])].filter(at=>at>=start&&at<=to))].sort()
   for(let i=0;i<points.length-1;i++){
    const at=points[i],through=points[i+1],observation=observations.findLast(o=>o.observed_at<=at)
    const state=!observation||observation.revision!==membership.revision||observation.result==='unknown'?'unknown':Date.parse(at)>=Date.parse(observation.observed_at)+CADENCE_MS[observation.cadence]*1.5?'stale':null
    if(state){
     const previous=intervals.at(-1)
     if(previous?.resource_id===member.resource_id&&previous.state===state&&previous.to===at)previous.to=through
     else intervals.push({resource_id:member.resource_id,from:at,to:through,state})
    }
   }
  }
 }
 if(new TextEncoder().encode(JSON.stringify(intervals)).byteLength>8*1024*1024)throw new Refusal('Shared test exceeds 8 MiB of interval history; use a narrower engagement period.',413)
 return intervals
}
