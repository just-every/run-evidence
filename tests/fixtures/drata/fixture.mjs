import { readFile } from 'node:fs/promises'
import { deflateRawSync } from 'node:zlib'
export const digest=async bytes=>Buffer.from(await crypto.subtle.digest('SHA-256',bytes)).toString('hex')
function crc32(bytes){let n=0xffffffff;for(const b of bytes){n^=b;for(let k=0;k<8;k++)n=(n>>>1)^((n&1)?0xedb88320:0)}return(n^0xffffffff)>>>0}
export function zip(entries,{deflate=false}={}){
 const locals=[],central=[];let at=0
 for(const [name,value]of entries){const path=Buffer.from(name),bytes=Buffer.from(value),packed=deflate?deflateRawSync(bytes):bytes,crc=crc32(bytes),local=Buffer.alloc(30),record=Buffer.alloc(46)
  local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(0x0800,6);local.writeUInt16LE(deflate?8:0,8);local.writeUInt32LE(crc,14);local.writeUInt32LE(packed.length,18);local.writeUInt32LE(bytes.length,22);local.writeUInt16LE(path.length,26)
  record.writeUInt32LE(0x02014b50);record.writeUInt16LE(20,4);record.writeUInt16LE(20,6);record.writeUInt16LE(0x0800,8);record.writeUInt16LE(deflate?8:0,10);record.writeUInt32LE(crc,16);record.writeUInt32LE(packed.length,20);record.writeUInt32LE(bytes.length,24);record.writeUInt16LE(path.length,28);record.writeUInt32LE(at,42)
  locals.push(local,path,packed);central.push(record,path);at+=local.length+path.length+packed.length
 }
 const c=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(c.length,12);end.writeUInt32LE(at,16)
 return Buffer.concat([...locals,c,end])
}
export async function fixture(options={}){const manifest=await readFile(new URL('./evidence_manifest.html',import.meta.url));return zip([['evidence_manifest.html',manifest],['Evidence/1.txt','Historical access review\n'],['Evidence/3.txt','Historical training register\n'],['AuditInfo.txt','Synthetic audit package; no source timestamp asserted.\n'],['Controls-to-Requirements.csv','Control,Requirement\nAC-1,CC6.1\nPE-1,CC1.4\n'],['ControlEvidence/readme.txt','Original folder retained in ZIP.\n']],options)}
