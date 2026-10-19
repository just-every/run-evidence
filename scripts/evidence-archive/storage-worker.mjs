import { WorkerEntrypoint } from 'cloudflare:workers'
// A local storage adapter only. Keeping this operation inside workerd preserves
// R2's fixed-length body and atomic create-if-absent precondition across the
// Node RPC boundary. The archive decoder and admission remain the shared engine.
export default class ArchiveStorage extends WorkerEntrypoint {
 async copyOriginal(source,key,size,session) {
  const object=await this.env.EXHIBITS.get(source)
  if(!object||object.size!==size)throw Error('Validated staging original disappeared.')
  const result=await this.env.EXHIBITS.put(key,object.body,{onlyIf:{etagDoesNotMatch:'*'},customMetadata:{portable_session:session},httpMetadata:{contentType:'application/octet-stream'}})
  return !!result
 }
}
