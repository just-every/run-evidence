import { Buffer } from 'node:buffer'
import { Refusal } from '../upload'
import { canonicalJson, sha256 } from './base/provenance/identity'
import { unzip } from './zip'
import { manifestRows } from './html'
import { drataClasses } from './bundle/parse'
export interface EvidenceItem { id:string;path:string;source:string;requirement:string;original_path:string;covered_from:null;covered_to:null;collected_at:null }
export interface SourceControl { id:string;name:string;evidence:EvidenceItem[] }
export interface Manifest { format:'drata-evidence-html';account_id:null;exported_at:null;controls:SourceControl[] }
export interface ParsedArchive { manifest:Manifest;manifestBytes:Uint8Array;archive:Uint8Array;files:Map<string,Uint8Array>;summary:ReturnType<typeof summary> }
function summary(manifest:Manifest,files:Map<string,Uint8Array>,archive:Uint8Array,manifestBytes:Uint8Array){
 const evidence=manifest.controls.flatMap(c=>c.evidence.map(e=>({...e,control_id:c.id,...(files.has(e.path)?{available:true,size:files.get(e.path)!.length,sha256:sha256(files.get(e.path)!)}:{available:false,size:null,sha256:null})})))
 const referenced=new Set(evidence.map(e=>e.path))
 return{provider:'Drata' as const,classes:drataClasses(manifest.controls.length,evidence),shape:manifest.format,account_id:null,exported_at:null,archive_sha256:sha256(archive),manifest_sha256:sha256(manifestBytes),controls:manifest.controls.map(c=>({id:c.id,name:c.name})),evidence,counts:{controls:manifest.controls.length,evidence:evidence.length,available:evidence.filter(e=>e.available).length,missing:evidence.filter(e=>!e.available).length,unreferenced:[...files.keys()].filter(p=>p!=='evidence_manifest.html'&&!referenced.has(p)).length},missing:evidence.filter(e=>!e.available).map(e=>e.path),unreferenced:[...files.keys()].filter(p=>p!=='evidence_manifest.html'&&!referenced.has(p))}
}
export function parseArchive(archive:Uint8Array):ParsedArchive{
 const files=unzip(archive),manifestBytes=files.get('evidence_manifest.html')
 if(!manifestBytes||manifestBytes.length>512*1024)throw new Refusal('ZIP must contain evidence_manifest.html (up to 512 KiB).')
 let html:string;try{html=new TextDecoder('utf-8',{fatal:true}).decode(manifestBytes)}catch{throw new Refusal('Manifest must be UTF-8 HTML.')}
 const rows=manifestRows(html!),controls:SourceControl[]=[],seen=new Set<string>()
 for(const row of rows){
  const controlId=sha256(row.control).slice(0,32),id=sha256(canonicalJson(row)).slice(0,32)
  if(seen.has(id))throw new Refusal('Duplicate manifest evidence row.');seen.add(id)
  let c=controls.find(c=>c.id===controlId);if(!c){c={id:controlId,name:row.control,evidence:[]};controls.push(c)}
  c.evidence.push({id,path:row.path,source:'Drata manifest original path: '+row.original_path,requirement:row.requirement,original_path:row.original_path,covered_from:null,covered_to:null,collected_at:null})
 }
 if(controls.length>50)throw new Refusal('At most 50 source controls per import.')
 const manifest:Manifest={format:'drata-evidence-html',account_id:null,exported_at:null,controls}
 return{manifest,archive,manifestBytes,files,summary:summary(manifest,files,archive,manifestBytes)}
}
export const artifact=(name:string,bytes:Uint8Array)=>({name,size:bytes.length,sha256:sha256(bytes),original:{status:'available' as const,base64:Buffer.from(bytes).toString('base64')}})
export const payloadHash=(value:unknown)=>sha256(canonicalJson(value))
