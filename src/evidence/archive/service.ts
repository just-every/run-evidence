import { MAGIC,stream,fail } from './format'
import { restoreArchive as restoreLegacy } from './restore'
import { portableInventory,portableExport,portableSummary } from './portable-export'
import { openArchive } from './framing'
import { createSession,ownedSession,cleanupSession } from './sessions'
import { decodePortable,admitPortable,type RestoreOptions } from './portable-restore'
import type { Store } from './registry'
export { exportJournal } from './journal'
export const inventory=portableInventory,exportArchive=portableExport,summary=portableSummary
export async function restoreArchive(env:Store,body:ReadableStream<Uint8Array>,dryRun=false,now=new Date(),_maxTotal=Infinity,options:RestoreOptions={}) {
 const {reader,first}=await openArchive(body)
 try {
 if(first.data?.version!==10){
  if(await env.DB.prepare('SELECT 1 FROM portable_journal UNION ALL SELECT 1 FROM portable_history WHERE sequence>0 LIMIT 1').first()||(options.journal as any)?.sequence>0)fail('A legacy archive has no source lineage to reconcile with the known erasure journal. Obtain a new archive after erasure.')
  if(!dryRun&&!options.acceptUnverifiedHistory)fail('Legacy archive erasure history unverified. Explicitly acknowledge unavailable later erasure history.')
  async function* original(){yield MAGIC;yield first.prefix;yield first.bytes;yield* reader.remainder()}
  return {...await restoreLegacy(env,stream(original()),dryRun,now,Infinity),erasure_history:'unverified',requires_latest_journal:!options.acceptUnverifiedHistory}
 }
 const created=await createSession(env,'offline',now),s=await ownedSession(env,created.id,'offline')
 try{const result=await decodePortable(env,s,reader,first,options);if(dryRun)return result;return await admitPortable(env,await ownedSession(env,s.id,'offline'),options,now)}finally{await cleanupSession(env,s.id).catch(()=>{})}
 } finally { await reader.close() }
}
