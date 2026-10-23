import {fail} from '../../archive/format'
import {staged,type Store} from '../../archive/registry'
export async function validateEngagements(env:Store,id:string){
 const t=(name:string)=>staged(id,name)
 const bad=await env.DB.prepare(`SELECT 1 FROM ${t('audit_submissions')} s JOIN ${t('audit_requests')} q ON q.id=s.request_id JOIN ${t('audit_engagements')} e ON e.id=q.engagement_id JOIN ${t('receipts')} r ON r.id=s.receipt_id JOIN ${t('requirements')} x ON x.id=r.requirement_id WHERE x.control_id<>q.control_id OR r.covered_from<e.period_from OR r.covered_to>e.period_to LIMIT 1`).first()
 if(bad)fail('Auditor submission contradicts retained engagement scope or period.')
 const closed=await env.DB.prepare(`SELECT 1 FROM ${t('audit_requests')} q WHERE q.closed_at IS NOT NULL AND NOT EXISTS(SELECT 1 FROM ${t('audit_decisions')} d WHERE d.request_id=q.id AND d.state='accepted' AND d.revision=(SELECT MAX(x.revision) FROM ${t('audit_decisions')} x WHERE x.request_id=q.id) AND d.submission_id=(SELECT s.id FROM ${t('audit_submissions')} s WHERE s.request_id=q.id ORDER BY s.revision DESC LIMIT 1)) LIMIT 1`).first()
 if(closed)fail('Closed auditor request has no acceptance of its latest submission.')
}
