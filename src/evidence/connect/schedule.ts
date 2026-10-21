import type { Bindings } from '../../auth.server'
import { auditStatement, type Actor, type Input } from '../door'
import { Refusal } from '../upload'
import { requireConnection, type Connection } from './storage'
// COLLECTION-001: Hosted collector intervals use elapsed UTC time since the last attempt.
// Cron dispatches every five minutes. Missed intervals do not create observations.
export function collectionMinutes(connection: Connection) {
 const config = JSON.parse(connection.config_json || '{}') as { collection_minutes?: number }
 return config.collection_minutes ?? 60
}
export async function saveCollectionSchedule(env: Bindings, actor: Actor, id: string, input: Input, now: Date) {
 const connection = await requireConnection(env, id)
 if (connection.provider === 'private-git') throw new Refusal('Private Git collectors run on their own computer; configure their local scheduler.', 409)
 const minutes = typeof input.minutes === 'string' && /^\d+$/.test(input.minutes) ? Number(input.minutes) : input.minutes
 if (typeof minutes !== 'number' || !Number.isInteger(minutes) || minutes < 5 || minutes > 60 || minutes % 5) throw new Refusal('Choose a whole multiple of five minutes, from 5 to 60.')
 const config = { ...JSON.parse(connection.config_json || '{}'), collection_minutes: minutes }
 await env.DB.batch([
  env.DB.prepare('UPDATE connections SET config_json=? WHERE id=?').bind(JSON.stringify(config), id),
  auditStatement(env, actor, 'connection.schedule', 'connection:' + id, now, 'succeeded', `${minutes} minutes; previous ${collectionMinutes(connection)} minutes`),
 ])
 return { minutes }
}
