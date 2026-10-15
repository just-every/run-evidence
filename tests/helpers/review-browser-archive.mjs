import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

const digest=bytes=>createHash('sha256').update(bytes).digest('hex')
// Independent decoding of the public streamed archive framing. This helper
// does not import the exporter or restore validator under test.
export function inspectArchive(bytes) {
 let offset=bytes.indexOf(10)+1
 assert.ok(offset>0,'archive has a framing line')
 const take=size=>{assert.ok(offset+size<=bytes.length,'archive is complete');const part=bytes.subarray(offset,offset+size);offset+=size;return part}
 const number=()=>take(4).readUInt32BE(0)
 const envelope=JSON.parse(take(number()).toString('utf8'))
 assert.equal(digest(Buffer.from(envelope.manifest)),envelope.sha256,'manifest byte digest matches')
 const manifest=JSON.parse(envelope.manifest)
 const remaining=new Map(manifest.files.filter(file=>file.available).map(file=>[file.path,file]))
 let files=0
 while(offset<bytes.length){
  const path=take(number()).toString('utf8'),body=take(number()),file=remaining.get(path)
  assert.ok(file,'entry is listed exactly once');assert.equal(body.length,file.size,'file length matches');assert.equal(digest(body),file.sha256,'file digest matches')
  remaining.delete(path);files++
 }
 assert.equal(remaining.size,0,'every available file is present')
 return {manifest,summary:{controls:manifest.rows.controls.length,receipts:manifest.rows.receipts.length,folders:manifest.rows.review_folders.length,events:manifest.rows.review_events.length,files,missing:manifest.files.filter(file=>!file.available).length}}
}
