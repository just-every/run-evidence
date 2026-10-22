import type { Client } from './github'
import { record } from './github-schema'
// GitHub dependency graph SPDX 2.3 export. Keep package metadata only: no
// download locations, file contents, credentials or arbitrary SPDX annotations.
// https://docs.github.com/en/rest/dependency-graph/sboms#export-a-software-bill-of-materials-sbom-for-a-repository
export class DependencyGap extends Error {}
export interface Dependency { id:string;name:string;version:string|null }
export interface Dependencies { generated_at:string|null;packages:Dependency[];note:string }
export async function githubDependencies(client:Client,name:string):Promise<Dependencies> {
 const reply=await client.get('/repos/'+name.split('/').map(encodeURIComponent).join('/')+'/dependency-graph/sbom')
 if(reply.status!==200)throw new DependencyGap('dependency graph unreadable: GitHub answered '+reply.status)
 const v=record(reply.body)?reply.body.sbom:null
 if(!record(v)||v.spdxVersion!=='SPDX-2.3'||!record(v.creationInfo)||typeof v.creationInfo.created!=='string'||!Number.isFinite(Date.parse(v.creationInfo.created))||!Array.isArray(v.packages))throw new DependencyGap('schema drift: dependency graph SPDX export')
 if(v.packages.length>500)throw new DependencyGap('dependency graph exceeds 500 packages per repository; dependency inventory unknown')
 const packages:Dependency[]=v.packages.map(p=>{
  if(!record(p)||typeof p.SPDXID!=='string'||!/^SPDXRef-[A-Za-z0-9.-]{1,190}$/.test(p.SPDXID)||typeof p.name!=='string'||!/^[@A-Za-z0-9_.+/-]{1,200}$/.test(p.name)||!(p.versionInfo===undefined||typeof p.versionInfo==='string'&&/^[A-Za-z0-9._+^~*<>=| -]{1,100}$/.test(p.versionInfo)))throw new DependencyGap('schema drift: dependency package metadata')
  return {id:p.SPDXID,name:p.name,version:typeof p.versionInfo==='string'?p.versionInfo:null}
 })
 if(new Set(packages.map(p=>p.id)).size!==packages.length)throw new DependencyGap('schema drift: repeated dependency identity')
 return {generated_at:new Date(v.creationInfo.created).toISOString(),packages,note:'GitHub-generated SPDX dependency metadata, not retained original manifest files. GitHub does not establish an exact commit revision for this export; manifest revision and historical completeness remain unknown. Package presence is source-observed, never approval of an AI tool.'}
}
