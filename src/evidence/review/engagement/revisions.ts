import type {Bindings} from '../../../auth.server'
import type {Engagement} from './storage'
import {Refusal} from '../../upload'

// Intersect immutable revision lifetimes with the inclusive UTC audit dates.
// A revision already in force enters at the period boundary. Neither its
// earlier adoption date nor a later revision's contents enter the projection.
export async function sharedRevisions(env:Bindings,e:Engagement,test:string){
 const from=e.period_from+'T00:00:00.000Z'
 const to=new Date(Date.parse(e.period_to+'T00:00:00Z')+86400000).toISOString()
 const [definitions,libraries]=await env.DB.batch([
  env.DB.prepare(`SELECT revision,criteria_json,cadence,at FROM test_revisions WHERE test_id=? AND at<? AND (at>=? OR rowid=(SELECT rowid FROM test_revisions WHERE test_id=? AND at<? ORDER BY at DESC,revision DESC LIMIT 1)) ORDER BY at,revision LIMIT 5001`).bind(test,to,from,test,from),
  env.DB.prepare(`SELECT revision,at FROM library_acceptances WHERE at<? AND (at>=? OR rowid=(SELECT rowid FROM library_acceptances WHERE at<? ORDER BY at DESC,revision DESC LIMIT 1)) ORDER BY at,revision LIMIT 5001`).bind(to,from,from),
 ])
 type Definition={revision:number;criteria_json:string;cadence:string;at:string}
 type Library={revision:number;at:string}
 const criteria=definitions.results as Definition[],accepted=libraries.results as Library[]
 if(criteria.length>5000||accepted.length>5000)throw new Refusal('Shared test exceeds 5000 historical revisions; complete revision history is unavailable within this read bound.',413)
 const timeline=<T extends {at:string}>(values:T[])=>values.flatMap((r,i)=>{
  const start=r.at>from?r.at:from,end=values[i+1]?.at??to
  return start<end?[{row:r,from:start,to:end}]:[]
 })
 const history={
  criteria_revisions:timeline(criteria).map(({row,from,to})=>({revision:row.revision,criteria:JSON.parse(row.criteria_json),cadence:row.cadence,from,to})),
  library_revisions:timeline([{revision:1,at:'0001-01-01T00:00:00.000Z'},...accepted]).map(({row,from,to})=>({revision:row.revision,from,to})),
 }
 if(new TextEncoder().encode(JSON.stringify(history)).byteLength>8*1024*1024)throw new Refusal('Shared test exceeds 8 MiB of revision history; complete revision history is unavailable within this read bound.',413)
 return history
}
