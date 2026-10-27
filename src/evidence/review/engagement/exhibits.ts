import type {Bindings} from '../../../auth.server'
import type {Engagement} from './storage'
import {Refusal} from '../../upload'
import {withheldSql} from '../../secure/records'
// Selected test mappings and engagement scope both constrain supporting exhibits.
// Original file bytes are never released by the request-free projection.
export async function sharedExhibits(env:Bindings,e:Engagement,test:string){
 const result=await env.DB.prepare(`SELECT r.id,r.origin,r.source,r.covered_from,r.covered_to,r.added_by_name,r.added_at,r.sha256,x.filename
 FROM receipts r JOIN exhibits x ON x.id=r.exhibit_id JOIN requirements q ON q.id=r.requirement_id
 WHERE r.covered_from>=? AND r.covered_to<=? AND ${withheldSql('r.id')} AND EXISTS(SELECT 1 FROM test_controls t JOIN audit_scope s ON s.control_id=t.control_id WHERE t.test_id=? AND t.control_id=q.control_id AND s.engagement_id=?)
 ORDER BY r.added_at,r.id LIMIT 5001`).bind(e.period_from,e.period_to,test,e.id).all<Record<string,unknown>>()
 if(result.results.length>5000||new TextEncoder().encode(JSON.stringify(result.results)).byteLength>8*1024*1024)throw new Refusal('Shared test exceeds the supporting exhibit read bound; use a narrower audit period.',413)
 return result.results
}
