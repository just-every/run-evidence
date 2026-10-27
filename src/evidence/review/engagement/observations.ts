import type {Bindings} from '../../../auth.server'
import type {Engagement} from './storage'
import {Refusal} from '../../upload'

// Only the explicitly selected test and inclusive UTC engagement dates enter
// this read. Current resource attributes never reconstruct historical facts.
export async function sharedObservations(env:Bindings,e:Engagement,test:string){
 const end=new Date(Date.parse(e.period_to+'T00:00:00Z')+86400000).toISOString()
 const result=await env.DB.prepare(`SELECT o.id,o.test_id,o.revision,o.resource_id,o.result,o.expected_json,o.actual_json,o.reason,o.source_kind,o.source_ref,o.observed_at,
 l.library_revision,c.provider AS source_connector,c.account AS source_account
 FROM observations o LEFT JOIN run_library_revisions l ON l.run_id=o.run_id
 LEFT JOIN connections c ON o.source_kind='source-observed' AND (o.source_ref=c.id OR substr(o.source_ref,-length(c.id)-1)=':'||c.id)
 WHERE o.test_id=? AND o.observed_at>=? AND o.observed_at<? ORDER BY o.observed_at,o.id LIMIT 5001`).bind(test,e.period_from+'T00:00:00.000Z',end).all<{id:string;test_id:string;revision:number;resource_id:string;result:string;expected_json:string;actual_json:string;reason:string;source_kind:string;source_ref:string;observed_at:string;library_revision:number|null;source_connector:string|null;source_account:string|null}>()
 if(result.results.length>5000)throw new Refusal('Shared test exceeds 5000 period observations; use a narrower engagement period.',413)
 const observations=result.results.map(({expected_json,actual_json,...o})=>({...o,criteria:JSON.parse(expected_json),actual:JSON.parse(actual_json)}))
 if(new TextEncoder().encode(JSON.stringify(observations)).byteLength>8*1024*1024)throw new Refusal('Shared test exceeds 8 MiB of period observations; use a narrower engagement period.',413)
 return observations
}
