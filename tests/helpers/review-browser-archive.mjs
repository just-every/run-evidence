import {decodeArchive} from './portable-format.mjs'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

const digest=bytes=>createHash('sha256').update(bytes).digest('hex')
// Independent decoding of the public streamed archive framing. This helper
// does not import the exporter or restore validator under test.
export function inspectArchive(bytes) {
 const {manifest,entries,envelope}=decodeArchive(bytes)
 assert.equal(digest(Buffer.from(envelope.manifest)),envelope.sha256,'manifest byte digest matches')
 const remaining=new Map(manifest.files.filter(file=>file.available).map(file=>[file.path,file]))
 let files=0
 for(const entry of entries.filter(e=>e.path.startsWith('files/'))){
  const file=remaining.get(entry.path);assert.ok(file,'entry is listed exactly once')
  assert.equal(entry.bytes.length,file.size,'file length matches');assert.equal(digest(entry.bytes),file.sha256,'file digest matches')
  remaining.delete(entry.path);files++
 }
 assert.equal(remaining.size,0,'every available exhibit is present')
 return {manifest,summary:{controls:manifest.rows.controls.length,receipts:manifest.rows.receipts.length,folders:manifest.rows.review_folders.length,events:manifest.rows.review_events.length,files,missing:manifest.files.filter(file=>!file.available).length}}
}
