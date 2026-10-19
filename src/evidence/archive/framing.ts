import { createHash } from 'node:crypto'
import { MAGIC, Reader, encoder, decoder, fail, u32 } from './format'
export const FRAME_BYTES=16*1024*1024
export const PART_BYTES=1024*1024
export const frame=(value:unknown)=>{const body=encoder.encode(JSON.stringify(value));if(body.length>FRAME_BYTES)fail('One archive record exceeds the 16 MiB frame bound.');return [u32(body.length),body]}
export const newHash=()=>createHash('sha256')
export async function readFrame(reader:Reader) {const n=await reader.number();if(!n||n>FRAME_BYTES)fail('Invalid archive frame size.');const bytes=await reader.read(n);let data:any;try{data=JSON.parse(decoder.decode(bytes))}catch{fail('Malformed archive frame.')}return {data,bytes,prefix:u32(n)}}
export async function objectDigest(body:ReadableStream<Uint8Array>) {const h=newHash();let size=0;const reader=body.getReader();try{for(;;){const r=await reader.read();if(r.done)break;h.update(r.value);size+=r.value.length}}finally{reader.releaseLock()}return {sha256:h.digest('hex'),size}}
export async function openArchive(body:ReadableStream<Uint8Array>) {const reader=new Reader(body);const magic=await reader.read(MAGIC.length);if(decoder.decode(magic)!==decoder.decode(MAGIC))fail('Not an Evidence custody archive.');return {reader,first:await readFrame(reader)}}
