import type {Bindings} from '../../../auth.server'
import type {Engagement} from './storage'
import type {sharedPopulation} from './population'
import {DAY,defaultSla} from '../../remedy/storage'
import {Refusal} from '../../upload'

type Population=Awaited<ReturnType<typeof sharedPopulation>>
type Event={id:string;obligation_id:string;resource_id:string;kind:string;actor_id:string;actor_name:string;body:string;observation_id:string|null;at:string;observed_at:string|null;result:string|null;category:string;severity:string;sla_policy_id:string|null;sla_days:number|null;historically_in_scope:number}
type Exception={id:string;resource_id:string|null;reason:string;approved_by:string;approved_name:string;approved_at:string;expires_at:string;revoked_at:string|null}
type TicketEvent={id:string;ticket_id:string;obligation_id:string;resource_id:string;kind:string;remote_value:string|null;local_value:string|null;detail:string;trigger:string;at:string}
type Cycle={opened:Event;verified:Event|null;events:Event[];number:number}
const stamp=(ms:number)=>new Date(ms).toISOString()
const exceptionEnd=(e:Exception)=>Math.min(Date.parse(e.expires_at),e.revoked_at?Date.parse(e.revoked_at):Infinity)
function bounded<T>(rows:T[]){
 if(rows.length>5000||new TextEncoder().encode(JSON.stringify(rows)).byteLength>8*1024*1024)throw new Refusal('Shared test exceeds the bounded remediation history read; complete history requires a narrower engagement.',413)
 return rows
}
function cyclesOf(events:Event[]){
 const cycles:Cycle[]=[],running=new Map<string,Cycle>()
 for(const event of events){
  if(event.kind==='opened'||event.kind==='reopened'){
   if(event.result!=='fail'||!event.observed_at||running.has(event.obligation_id))throw new Refusal('Remediation opening history is incomplete; historical SLA cannot be established.',409)
   const cycle={opened:event,verified:null,events:[event],number:cycles.filter(c=>c.opened.obligation_id===event.obligation_id).length+1}
   running.set(event.obligation_id,cycle);cycles.push(cycle)
  }else{
   const cycle=running.get(event.obligation_id)
   if(!cycle)continue
   cycle.events.push(event)
   if(event.kind==='verified'){
    if(event.result!=='pass'||!event.observed_at)throw new Refusal('Remediation verification history is incomplete; a verified source result is required.',409)
    cycle.verified=event;running.delete(event.obligation_id)
   }
  }
 }
 return cycles
}
function stateAt(cycle:Cycle,at:number){
 let state='open',acceptedUntil=Infinity
 for(const event of cycle.events){
  if(Date.parse(event.at)>at)break
  if(event.kind==='verified')state='verified'
  else if(event.kind==='marked done')state='awaiting verification'
  else if(event.kind==='risk accepted'){
   state='risk accepted'
   const expiry=/ until (\d{4}-\d\d-\d\dT[^) ]+)\)/.exec(event.body)?.[1]
   acceptedUntil=expiry?Date.parse(expiry):Infinity
  }else if(['opened','reopened','retest failed','acceptance expired'].includes(event.kind))state='open'
 }
 return state==='risk accepted'&&acceptedUntil<=at?'open':state
}
function slaAt(cycle:Cycle,exceptions:Exception[],at:number){
 const start=Date.parse(cycle.opened.observed_at!),verified=cycle.verified&&Date.parse(cycle.verified.at)<=at?Date.parse(cycle.verified.at):null,end=verified??at
 const days=cycle.opened.sla_days??defaultSla[cycle.opened.severity]??30
 const intervals=exceptions.map(e=>({from:Math.max(start,Date.parse(e.approved_at)),to:Math.min(end,exceptionEnd(e))})).filter(i=>i.to>i.from).sort((a,b)=>a.from-b.from)
 let paused=0,through=start
 for(const interval of intervals){paused+=Math.max(0,interval.to-Math.max(through,interval.from));through=Math.max(through,interval.to)}
 const due=start+days*DAY+paused,pausedNow=verified===null&&exceptions.some(e=>Date.parse(e.approved_at)<=at&&exceptionEnd(e)>at)
 return {status:verified!==null?'resolved':at>=due?'SLA missed':at>=due-Math.max(DAY,days*DAY*.2)?'approaching':'within SLA',
  due:stamp(due),days,policy_id:cycle.opened.sla_policy_id,paused:pausedNow,paused_hours:paused/3600000,
  elapsed_hours:(end-start)/3600000,hours_to_remediate:verified===null?null:Math.round((end-start)/3600000),resolved_within_sla:verified===null?null:end<=due}
}

// Current obligation rows keep only identity here. Reopening rewrites their
// clock, policy, state and closure; none of those mutable fields can establish
// a historical cycle. Category and severity are immutable test-definition fields:
// every shipped revision door changes criteria and cadence, never these fields.
export async function sharedRemediation(env:Bindings,e:Engagement,test:string,population:Population,now:Date){
 const from=e.period_from+'T00:00:00.000Z',to=stamp(Date.parse(e.period_to+'T00:00:00Z')+DAY),clock=now.toISOString(),end=clock<to?clock:to
 if(end<from)return {remediation:[],exceptions:[],remediated_before_period:[]}
 const [eventRows,exceptionRows,ticketRows]=await env.DB.batch([
  env.DB.prepare(`SELECT v.id,v.obligation_id,b.resource_id,v.kind,v.actor_id,v.actor_name,v.body,v.observation_id,v.at,
   o.observed_at,o.result,t.category,t.severity,p.id AS sla_policy_id,p.days AS sla_days,
   CASE WHEN EXISTS(SELECT 1 FROM resource_versions rv WHERE rv.resource_id=b.resource_id AND rv.at<=v.at AND rv.change<>'removed'
    AND rv.rowid=(SELECT rv2.rowid FROM resource_versions rv2 WHERE rv2.resource_id=b.resource_id AND rv2.at<=v.at ORDER BY rv2.at DESC,rv2.rowid DESC LIMIT 1))
    AND EXISTS(SELECT 1 FROM test_revisions tr WHERE tr.test_id=b.test_id AND tr.at<=v.at
     AND tr.revision=(SELECT tr2.revision FROM test_revisions tr2 WHERE tr2.test_id=b.test_id AND tr2.at<=v.at ORDER BY tr2.at DESC,tr2.revision DESC LIMIT 1)
     AND NOT EXISTS(SELECT 1 FROM json_each(tr.excluded_json) x WHERE json_extract(x.value,'$.resource_id')=b.resource_id)) THEN 1 ELSE 0 END AS historically_in_scope
   FROM obligation_events v JOIN obligations b ON b.id=v.obligation_id JOIN tests t ON t.id=b.test_id
   LEFT JOIN observations o ON o.id=v.observation_id AND o.test_id=b.test_id AND o.resource_id=b.resource_id
   LEFT JOIN sla_policies p ON p.rowid=(SELECT sp.rowid FROM sla_policies sp WHERE sp.category=t.category AND sp.severity=t.severity AND sp.effective_at<=o.observed_at ORDER BY sp.effective_at DESC,sp.rowid DESC LIMIT 1)
   WHERE b.test_id=? AND v.at<? AND v.at<=? ORDER BY v.at,v.rowid LIMIT 5001`).bind(test,to,clock),
  env.DB.prepare('SELECT id,resource_id,reason,approved_by,approved_name,approved_at,expires_at,revoked_at FROM test_exceptions WHERE test_id=? AND approved_at<? AND approved_at<=? ORDER BY approved_at,rowid LIMIT 5001').bind(test,to,clock),
  env.DB.prepare(`SELECT v.id,v.ticket_id,t.obligation_id,b.resource_id,v.kind,v.remote_value,v.local_value,v.detail,v.trigger,v.at
   FROM ticket_events v JOIN tickets t ON t.id=v.ticket_id JOIN obligations b ON b.id=t.obligation_id
   WHERE b.test_id=? AND v.at<? AND v.at<=? AND v.kind<>'comment source' ORDER BY v.at,v.rowid LIMIT 5001`).bind(test,to,clock),
 ])
 const events=bounded(eventRows.results as Event[]),exceptions=bounded(exceptionRows.results as Exception[]),tickets=bounded(ticketRows.results as TicketEvent[])
 // Attribute revisions may split population rows without changing membership.
 // SLA lifetimes span adjacent membership intervals as one continuous period.
 const members=population.map(member=>{
  const intervals:typeof member.intervals=[]
  for(const interval of member.intervals){const last=intervals.at(-1);if(last?.to===interval.from)last.to=interval.to;else intervals.push({...interval})}
  return {...member,intervals}
 })
 const cycles=cyclesOf(events),memberById=new Map(members.map(p=>[p.resource_id,p]))
 const visibleAt=(resource:string,at:string)=>at>=from&&at<to&&at<=clock&&!!memberById.get(resource)?.intervals.some(i=>i.from<=at&&at<i.to)
 const exceptionProjection=(exception:Exception,visibleFrom:string,visibleTo:string)=>({
  id:exception.id,resource_id:exception.resource_id,reason:exception.reason,approved_by:exception.approved_by,approved_name:exception.approved_name,
  approved_at:exception.approved_at<from?null:exception.approved_at,carried_in:exception.approved_at<from,expires_at:exception.expires_at,
  revoked_at:exception.revoked_at&&exception.revoked_at<=visibleTo?exception.revoked_at:null,from:visibleFrom,to:visibleTo,
 })
 const sharedExceptions=exceptions.flatMap(exception=>members.flatMap(member=>{
  if(exception.resource_id!==null&&exception.resource_id!==member.resource_id)return []
  return member.intervals.flatMap(interval=>{
   const start=[from,interval.from,exception.approved_at].sort().at(-1)!,finish=stamp(Math.min(Date.parse(end),Date.parse(interval.to),exceptionEnd(exception)))
   return start<finish?[{...exceptionProjection(exception,start,finish),resource_id:member.resource_id}]:[]
  })
 }))
 const remediation=members.flatMap(member=>{
  const own=cycles.filter(c=>c.opened.resource_id===member.resource_id),ownExceptions=exceptions.filter(x=>x.resource_id===null||x.resource_id===member.resource_id)
  const history=own.flatMap(cycle=>member.intervals.flatMap(interval=>{
   const start=[from,interval.from,cycle.opened.at].sort().at(-1)!,finish=[end,interval.to,cycle.verified?.at??end].sort()[0]
   // A verified event at a membership or period boundary belongs only to the
   // interval containing it; an out-of-scope fix cannot close an earlier span.
   const resolved=!!cycle.verified&&visibleAt(member.resource_id,cycle.verified.at)&&cycle.verified.at<=finish
   if(start>finish||start===finish&&!resolved)return []
   const eventHistory=cycle.events.filter(v=>v.at>=start&&v.at<=finish&&visibleAt(member.resource_id,v.at))
   const points=[...new Set([start,finish,...eventHistory.map(v=>v.at),...ownExceptions.flatMap(x=>[x.approved_at,stamp(exceptionEnd(x))])].filter(at=>at>=start&&at<=finish))].sort()
   // At a scope boundary the state is the instant immediately before leaving.
   const lastAt=Date.parse(finish)-(resolved||finish===clock&&clock<to?0:1)
   const snapshots=points.map(at=>({at,state:stateAt(cycle,at===finish?lastAt:Date.parse(at)),sla:slaAt(cycle,ownExceptions,at===finish?lastAt:Date.parse(at))}))
   return [{cycle:cycle.number,from:start,to:finish,carry_in:cycle.opened.at<from,state:stateAt(cycle,lastAt),
    severity:cycle.opened.severity,category:cycle.opened.category,sla:slaAt(cycle,ownExceptions,lastAt),history:snapshots,
    events:eventHistory.map(v=>({id:v.id,kind:v.kind,actor_id:v.actor_id,actor_name:v.actor_name,body:v.body,at:v.at,
     observation_id:v.observed_at&&visibleAt(member.resource_id,v.observed_at)?v.observation_id:null,sla:slaAt(cycle,ownExceptions,Date.parse(v.at))}))}]
  }))
  if(!history.length)return []
  const obligation_id=own[0].opened.obligation_id
  const links=tickets.filter(t=>t.obligation_id===obligation_id&&visibleAt(member.resource_id,t.at)).map(({obligation_id:_ob,resource_id:_resource,...ticket})=>ticket)
  // Prior ticket events establish that a link existed at the period boundary;
  // expose identity, not its pre-period status, comments or remote values.
  const carriedLinks=[...new Set(tickets.filter(t=>t.obligation_id===obligation_id&&t.at<from&&t.kind==='created').map(t=>t.ticket_id))].map(ticket_id=>({ticket_id,carried_in:true}))
  return [{obligation_id,resource_id:member.resource_id,cycles:history,exceptions:sharedExceptions.filter(x=>x.resource_id===member.resource_id),linked_remediation:[...carriedLinks,...links]}]
 })
 const remediated_before_period=cycles.filter(c=>c.verified&&c.verified.at<from&&c.verified.historically_in_scope===1).map(c=>({
  obligation_id:c.opened.obligation_id,resource_id:c.opened.resource_id,cycle:c.number,label:'remediated before period',opened_at:c.opened.at,verified_at:c.verified!.at,
 }))
 const result={remediation,exceptions:sharedExceptions,remediated_before_period}
 bounded([result])
 return result
}
