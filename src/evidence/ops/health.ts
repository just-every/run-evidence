import type { Bindings } from '../../auth.server'
import { operationOutcomes } from './outcomes'

// Measurements describe this installation; a successful storage read does not
// validate a provider, a backup kept elsewhere, or a control's effectiveness.
export async function operationHealth(env: Bindings) {
 const connectors = (await env.DB.prepare('SELECT id,label,provider,status,last_attempt_at,last_success_at,next_attempt_at,last_error FROM connections ORDER BY label,id').all()).results
 const queue = await env.DB.prepare("SELECT (SELECT count(*) FROM operation_steps WHERE outcome='running') AS running_steps,(SELECT count(*) FROM operation_steps WHERE outcome IN ('failed','unknown')) AS attention_steps,(SELECT count(*) FROM followups WHERE state='pending') AS pending_deliveries,(SELECT count(*) FROM followups WHERE state='uncertain') AS uncertain_deliveries").first()
 const storage = await env.DB.prepare('SELECT count(*) AS exhibits,coalesce(sum(size),0) AS recorded_bytes FROM exhibits').first()
 const objects = await env.EXHIBITS.list({limit:1000})
 const latestRestore = await env.DB.prepare("SELECT restored_at AS updated_at,'complete' AS state FROM operation_recovery WHERE singleton=1").first()
 return { ...(await operationOutcomes(env)), connectors, queue, storage:{...storage,bucket_read:'available',listed_objects:objects.objects.length,listing_truncated:objects.truncated},backup:{latest_restore:latestRestore,external_copy:'Not verified. Export a complete archive and retain it outside this installation.'},limits:{exhibit_mib:10,import_zip_mib:20,population_csv_mib:5,archive_part_mib:1,archive_total:'No total ceiling; bounded streaming frames.',outcome_page:100,delivery_reconciliation:100},costs:'/app/connections' }
}
