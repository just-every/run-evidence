import { inflateRawSync } from 'node:zlib'
import { Refusal } from '../upload'
export const MAX_ARCHIVE = 20 * 1024 * 1024
const MAX_EXPANDED = 25 * 1024 * 1024
const fail = (): never => { throw new Refusal('Invalid or unsafe ZIP. Use a ZIP with ordinary stored or deflated files; no encrypted files, links, duplicate paths or ZIP64.') }
export function safePath(path: string) {
 if (!path || path.length > 500 || path !== path.normalize('NFC') || /[\\:%?#\x00-\x1f\x7f]/.test(path) || path.startsWith('/') || path.split('/').some(p => !p || p === '.' || p === '..')) fail()
 return path
}
export function crc32(bytes: Uint8Array) {
 let value = 0xffffffff
 for (const byte of bytes) { value ^= byte; for (let b=0;b<8;b++) value=(value>>>1)^((value&1)?0xedb88320:0) }
 return (value^0xffffffff)>>>0
}
export function unzip(bytes: Uint8Array): Map<string, Uint8Array> {
 if (bytes.length > MAX_ARCHIVE || bytes.length < 22) fail()
 const v = new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength), u16=(n:number)=>v.getUint16(n,true), u32=(n:number)=>v.getUint32(n,true)
 let end = bytes.length-22
 while (end>=Math.max(0,bytes.length-65557) && u32(end)!==0x06054b50) end--
 if (end<0 || end<bytes.length-65557 || end+22+u16(end+20)!==bytes.length || u16(end+4) || u16(end+6) || u16(end+8)!==u16(end+10)) fail()
 const count=u16(end+10), central=u32(end+16), centralSize=u32(end+12)
 if (!count || count>150 || central+centralSize!==end) fail()
 const files=new Map<string,Uint8Array>(), seen=new Set<string>(), spans:{from:number;to:number}[]=[]
 let pos=central,total=0
 for(let i=0;i<count;i++) {
  if(pos+46>end || u32(pos)!==0x02014b50) fail()
  const flags=u16(pos+8),method=u16(pos+10),crc=u32(pos+16),packed=u32(pos+20),size=u32(pos+24),nameLen=u16(pos+28),extra=u16(pos+30),comment=u16(pos+32),start=u32(pos+42),attrs=u32(pos+38)
  if(flags & ~0x0808 || ![0,8].includes(method) || u16(pos+34) || size>10*1024*1024 || pos+46+nameLen+extra+comment>end || ((attrs>>>16)&0xf000)===0xa000) fail()
  const rawName=bytes.subarray(pos+46,pos+46+nameLen)
  let name:string;try{name=new TextDecoder('utf-8',{fatal:true}).decode(rawName)}catch{fail()}
  if (!(flags&0x0800) && rawName.some(n=>n>127)) fail()
  const directory=name!.endsWith('/'),path=safePath(directory?name!.slice(0,-1):name!)
  if(seen.has(path.toLocaleLowerCase('en-US'))) fail();seen.add(path.toLocaleLowerCase('en-US'))
  if(start+30>central || u32(start)!==0x04034b50 || u16(start+6)!==flags || u16(start+8)!==method || u16(start+26)!==nameLen) fail()
  const localName=bytes.subarray(start+30,start+30+nameLen)
  if(localName.length!==rawName.length || localName.some((n,j)=>n!==rawName[j])) fail()
  if(!(flags&8) && (u32(start+14)!==crc || u32(start+18)!==packed || u32(start+22)!==size)) fail()
  const at=start+30+nameLen+u16(start+28),to=at+packed
  if(to>central || at<start || spans.some(s=>start<s.to&&to>s.from)) fail();spans.push({from:start,to})
  total+=size;if(total>MAX_EXPANDED || (directory && (size || packed))) fail()
  if(!directory){let data:Uint8Array;try{data=method===0?bytes.slice(at,to):new Uint8Array(inflateRawSync(bytes.subarray(at,to),{maxOutputLength:Math.max(1,size)}))}catch{fail()}
   if(data!.length!==size || crc32(data!)!==crc) fail();files.set(path,data!)}
  pos+=46+nameLen+extra+comment
 }
 if(pos!==end) fail()
 return files
}
