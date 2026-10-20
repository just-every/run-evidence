import { json, ownerRoutes, done, auditStatement } from '../door'
import { Refusal } from '../upload'
import { operationHealth } from './health'
import { operationsPage } from './view'
export const operationsHandler = (clock: () => Date) => ownerRoutes([
 { method:'GET',pattern:/^\/(api|app)\/operations$/,run:async c=>{const data=await operationHealth(c.env);return c.isApi?json(data):operationsPage(data,c.actor.name)} },
 { method:'POST',pattern:/^\/(?:api|app)\/operations\/([a-f0-9-]{36})\/cancel$/,run:async(c,m)=>{
  const row=await c.env.DB.prepare("SELECT id FROM operation_steps WHERE id=? AND outcome='running'").bind(m[1]).first()
  if(!row)throw new Refusal('No running operation with that identity.',409)
  const results=await c.env.DB.batch([
   auditStatement(c.env,c.actor,'operation.cancel',m[1],c.now),
   c.env.DB.prepare("UPDATE operation_steps SET outcome='unknown',finished_at=?,detail='Cancelled by owner; inspect underlying records. External acceptance may be unknown; no automatic resend.' WHERE id=? AND outcome='running'").bind(c.now.toISOString(),m[1]),
  ])
  return done(c,'/app/operations',{cancelled:results[1].meta.changes===1})
 } },
],clock)
