import type { Bindings } from '../../auth.server'
import { categories, settings, type CustomerGrant, type Delivery, type Update } from './model'
import { subscriberExport } from './subscribers'
import { subprocessorList } from './updates'
export async function trustOverview(env:Bindings,now:Date) {
 const [rules,categoryRows,updates,subscribers,customers,deliveries,subprocessors,webhooks]=await Promise.all([
  settings(env),categories(env),env.DB.prepare('SELECT * FROM trust_updates ORDER BY drafted_at DESC,rowid DESC').all<Update>(),subscriberExport(env),
  env.DB.prepare('SELECT g.*,s.email FROM trust_customer_grants g JOIN trust_subscribers s ON s.id=g.subscriber_id ORDER BY g.approved_at DESC,g.rowid DESC').all<CustomerGrant&{email:string}>(),
  env.DB.prepare('SELECT * FROM trust_deliveries ORDER BY queued_at DESC,rowid DESC LIMIT 200').all<Delivery>(),subprocessorList(env,now),
  env.DB.prepare('SELECT provider,updated_by,updated_at FROM trust_mail_webhooks ORDER BY provider').all(),
 ])
 return {settings:rules,categories:categoryRows,updates:updates.results,...subscribers,customer_grants:customers.results,deliveries:deliveries.results,subprocessors,webhooks:webhooks.results}
}
export async function publicFeed(env:Bindings,customers:boolean,category:string|null=null) {
 const rows=(await env.DB.prepare("SELECT id,category,title,body,visibility,approved_at,published_at FROM trust_updates WHERE published_at IS NOT NULL AND approved_at IS NOT NULL AND (?=1 OR visibility='public') AND (? IS NULL OR category=?) ORDER BY published_at DESC,rowid DESC").bind(customers?1:0,category,category).all<Pick<Update,'id'|'category'|'title'|'body'|'visibility'|'approved_at'|'published_at'>>()).results
 return rows
}
