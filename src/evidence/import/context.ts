import type { Bindings } from '../../auth.server'
import type { D1ImportContext } from './base/d1/types'
import type { Review } from './types'
import { targets } from './targets'
import { MAPPING_VERSION } from './plan'
import { BUNDLE_MAPPING_VERSION } from './bundle/plan'
export function importContext(env:Bindings,review:Review,session:{id:string;operatorId:string},fingerprint?:string):D1ImportContext{
 const provider:string=JSON.parse(review.summary_json).provider,drata=provider==='Drata',namespace=provider.toLowerCase()+'-package:'+review.archive_sha256
 return{destination:'evidence',namespace,mappingVersion:drata?MAPPING_VERSION:BUNDLE_MAPPING_VERSION,reviewedFingerprint:fingerprint,operationKey:provider.toLowerCase()+'-review:'+review.id,batchSize:drata?5:50,maxBatches:1,storage:{database:env.DB,targets},authorization:{principalId:session.operatorId,predicate:action=>({sql:`EXISTS(SELECT 1 FROM oa_sessions s JOIN oa_operators o ON o.id=s.operator_id WHERE s.id=? AND o.id=? AND o.role='owner' AND o.status='active' AND s.operator_version=o.version AND s.revoked_at IS NULL AND s.expires_at>?) AND EXISTS(SELECT 1 FROM import_reviews WHERE id=? AND actor_id=? ${!['plan','read'].includes(action)?'AND approved_at IS NOT NULL AND fingerprint=?':''})`,params:[session.id,session.operatorId,Date.now(),review.id,session.operatorId,...(!['plan','read'].includes(action)?[fingerprint??review.fingerprint]:[])]})}}
}
