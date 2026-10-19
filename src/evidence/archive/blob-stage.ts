import { fail } from './format'
import { newHash } from './framing'
import type { Store } from './registry'
const MULTIPART_BYTES=5*1024*1024
export class BlobStage {
 private upload!:R2MultipartUpload;private buffer=new Uint8Array(MULTIPART_BYTES);private used=0;private total=0;private index=0;private hash=newHash();private parts:R2UploadedPart[]=[]
 constructor(private env:Store,private key:string,private size:number,private sha256:string){}
 async start(){this.upload=await this.env.EXHIBITS.createMultipartUpload(this.key,{httpMetadata:{contentType:'application/octet-stream'}});return this.upload.uploadId}
 async part(index:number,data:unknown){if(index!==this.index++||typeof data!=='string'||data.length>350000)fail('Invalid or out-of-order original byte frame.');const b=Buffer.from(data,'base64');if(b.toString('base64')!==data||!b.length)fail('Invalid original byte encoding.');this.total+=b.length;if(this.total>this.size)fail('Original exceeds its declared size.');this.hash.update(b);let at=0;while(at<b.length){const n=Math.min(this.buffer.length-this.used,b.length-at);this.buffer.set(b.subarray(at,at+n),this.used);at+=n;this.used+=n;if(this.used===this.buffer.length)await this.flush()}}
 private async flush(){this.parts.push(await this.upload.uploadPart(this.parts.length+1,this.buffer.subarray(0,this.used)));this.used=0}
 async finish(size:number){if(size!==this.size||this.total!==this.size||this.hash.digest('hex')!==this.sha256)fail('Original file digest or size does not match custody.');if(this.used)await this.flush();await this.upload.complete(this.parts)}
 async abort(){await this.upload?.abort().catch(()=>{})}
}
