import type { Connection } from './storage'
// COLLECTION-001: Hosted collector intervals use elapsed UTC time since the last attempt.
// Cron dispatches every five minutes. Missed intervals do not create observations.
export function collectionMinutes(connection: Connection) {
 const config = JSON.parse(connection.config_json || '{}') as { collection_minutes?: number }
 return config.collection_minutes ?? 60
}
