import type { Bindings } from '../../auth.server'
import { MAGIC,sha,encoder,u32,stream,fail,type Manifest } from './format'
import { archiveFiles } from './extensions'
import { bytesFor } from './inventory'
export async function exportArchive(env:Pick<Bindings,'DB'|'EXHIBITS'>, manifest:Manifest) {
 const text = JSON.stringify(manifest), envelope = encoder.encode(JSON.stringify({manifest:text,sha256:await sha(encoder.encode(text))}))
 async function* generate() {
  yield MAGIC; yield u32(envelope.length); yield envelope
  for(const file of archiveFiles(manifest)) if(file.available) {
   const bytes = await bytesFor(env,file.object_key,file.size,file.sha256,20*1024*1024)
   if(!bytes) fail('Stored bytes changed after inventory; export aborted. Export again for a fresh missing-file inventory.')
   const path = encoder.encode(file.path); yield u32(path.length); yield path; yield u32(bytes.length)
   for(let offset=0;offset<bytes.length;offset+=65536) yield bytes.subarray(offset,offset+65536)
  }
 }
 return stream(generate())
}
