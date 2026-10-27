import type {Bindings} from '../../../auth.server'
import {text,type Actor,type Input} from '../../door'
import {Refusal} from '../../upload'
import type {Engagement} from './storage'

// The authority and active share are checked inside the append, so a revoked
// session or withdrawn share cannot acquire a decision during an earlier read.
export async function evidenceDecision(env:Bindings,e:Engagement,share:string,input:Input,actor:Actor,email:string,session:string,now:Date){
 const state=text(input,'state'),reason=typeof input.reason==='string'?input.reason.trim():''
 if(!['accepted','flagged','not-applicable'].includes(state)||reason.length>2000||state!=='accepted'&&!reason)throw new Refusal('Choose accepted, flagged with a comment, or not-applicable with a reason.')
 const raw=input.expected_revision,previous=typeof raw==='string'&&/^(0|[1-9][0-9]*)$/.test(raw)?Number(raw):NaN
 if(!Number.isSafeInteger(previous)||previous<0)throw new Refusal('Provide the current decision revision, or zero for the first decision.')
 const id=crypto.randomUUID(),at=now.toISOString()
 const statement=env.DB.prepare(`INSERT INTO audit_evidence_decisions(id,share_id,revision,state,reason,actor_id,actor_name,at)
 SELECT ?,?,COALESCE((SELECT MAX(revision) FROM audit_evidence_decisions WHERE share_id=?),0)+1,?,?,?,?,?
 WHERE EXISTS(SELECT 1 FROM audit_evidence_shares s JOIN audit_engagements e ON e.id=s.engagement_id JOIN audit_grants g ON g.engagement_id=e.id
 WHERE s.id=? AND e.id=? AND s.unshared_at IS NULL AND s.kind IN ('test','policy','document') AND e.closed_at IS NULL AND g.email=? AND g.revoked_at IS NULL AND g.expires_at>?)
 AND EXISTS(SELECT 1 FROM oa_sessions s JOIN oa_operators o ON o.id=s.operator_id JOIN audit_identities a ON a.email=o.email WHERE s.id=? AND s.revoked_at IS NULL AND s.expires_at>? AND o.status='active' AND o.version=s.operator_version AND o.role='member' AND o.email=?)
 AND COALESCE((SELECT MAX(revision) FROM audit_evidence_decisions WHERE share_id=?),0)=?`).bind(id,share,share,state,reason,actor.id,actor.name,at,share,e.id,email,at,session,Date.now(),email,share,previous)
 const log=env.DB.prepare(`INSERT INTO product_audit(id,actor_kind,actor_id,actor_name,action,subject,outcome,detail,at,reason,revision)
 SELECT ?,'system',?,?,'audit.evidence.decided',?,'succeeded','Authenticated auditor',?,?,CAST(revision AS TEXT) FROM audit_evidence_decisions WHERE id=?`).bind(crypto.randomUUID(),actor.id,actor.name,share,at,reason,id)
 const [result]=await env.DB.batch([statement,log])
 if(!result.meta.changes)throw new Refusal('Authority ended, evidence is not shared, or the decision changed. Refresh before deciding.',409)
 return {id,revision:Number(previous)+1}
}
export async function evidenceReply(env:Bindings,e:Engagement,share:string,input:Input,actor:Actor,now:Date){
 const decision=text(input,'decision_id'),body=text(input,'body',5000),id=crypto.randomUUID(),at=now.toISOString()
 const statement=env.DB.prepare(`INSERT INTO audit_evidence_replies(id,share_id,decision_id,revision,body,actor_id,actor_name,at)
 SELECT ?,?,?,COALESCE((SELECT MAX(revision) FROM audit_evidence_replies WHERE share_id=?),0)+1,?,?,?,?
 WHERE EXISTS(SELECT 1 FROM audit_evidence_shares s JOIN audit_engagements e ON e.id=s.engagement_id JOIN audit_evidence_decisions d ON d.share_id=s.id WHERE s.id=? AND e.id=? AND s.unshared_at IS NULL AND e.closed_at IS NULL AND d.id=?)`).bind(id,share,decision,share,body,actor.id,actor.name,at,share,e.id,decision)
 const log=env.DB.prepare(`INSERT INTO product_audit(id,actor_kind,actor_id,actor_name,action,subject,outcome,detail,at,reason,revision)
 SELECT ?,'owner',?,?,'audit.evidence.replied',?,'succeeded','',?,'',CAST(revision AS TEXT) FROM audit_evidence_replies WHERE id=?`).bind(crypto.randomUUID(),actor.id,actor.name,share,at,id)
 const [result]=await env.DB.batch([statement,log])
 if(!result.meta.changes)throw new Refusal('Open shared evidence and its exact decision are required.',409)
 return {id}
}
