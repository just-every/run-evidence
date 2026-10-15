// Derive the source recipe from explicitly retained Base copy provenance.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
const files=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(p=>p&&existsSync(p))
const copies=JSON.parse(readFileSync('base-copies.json','utf8')).copies
const reserved=p=>['edition.json','sources.lock.json'].includes(p)||p.startsWith('.edition/')
const mapped=new Set(),groups=new Map()
for(const copy of copies){
 if(copy.revision!=='4a7833932a723c203191e84f1de905d84e4cbf1c')continue
 const entries=groups.get(copy.revision)||[]
 for(const p of Object.keys(copy.files)){mapped.add(p);entries.push({path:p,originPath:copy.originPath+p.slice(copy.path.length)})}
 groups.set(copy.revision,entries)
}
const components=[...groups].map(([revision,mappings],index)=>({id:index?'runeditrun/base-history-'+revision.slice(0,7):'runeditrun/base',role:'foundation',source:{kind:'local',paths:mappings.map(x=>x.path).sort(),origin:{repository:'https://github.com/runeditrun/base.git',revision,path:'.',paths:[...new Set(mappings.map(x=>x.originPath))].sort()},mappings:mappings.sort((a,b)=>a.path.localeCompare(b.path))}}))
components.push({id:'just-every/evidence',role:'edition',source:{kind:'local',paths:files.filter(p=>!reserved(p)&&!mapped.has(p)).sort()}})
writeFileSync('edition.json',JSON.stringify({schemaVersion:1,id:'just-every/evidence',identityKind:'project',toolchain:{id:'runeditrun/edition-authoring',version:'1.1.0'},parent:null,components},null,2)+'\n')
console.log('Updated Evidence source recipe.')
