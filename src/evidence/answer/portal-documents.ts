import type { Bindings } from '../../auth.server'
import { receipt,storedBytes } from '../storage'
import { withheld } from '../secure/records'
import { Refusal } from '../upload'
export interface PortalDocument {receipt_id:string;filename:string;sha256:string;size:number;media_type:string}
export async function portalDocument(env:Bindings,id:string):Promise<PortalDocument>{
 const row=await receipt(env,id)
 if(!row||row.superseded_by||!await storedBytes(env,row))throw new Refusal('The approved document is superseded or unavailable.',409)
 if((await withheld(env)).has(id))throw new Refusal('Publish the sensitive document explicitly before approving it for a portal.',409)
 return {receipt_id:id,filename:row.filename,sha256:row.sha256,size:row.size,media_type:row.media_type}
}
export async function assertPortalDocuments(env:Bindings,answers:{document?:PortalDocument}[]){
 for(const answer of answers)if(answer.document&&JSON.stringify(await portalDocument(env,answer.document.receipt_id))!==JSON.stringify(answer.document))throw new Refusal('An approved document changed. Review and approve a fresh revision.',409)
}
