import { createRequire } from 'node:module'
import { mkdtemp,rm,readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join,resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
const require=createRequire(import.meta.url), dependency=createRequire(require.resolve('wrangler/package.json'))
export async function localStore(config,state) {
 const {unstable_getMiniflareWorkerOptions}=dependency('wrangler')
 const {Miniflare,convertV4MiniflareOptions}=dependency('miniflare')
 const {workerOptions}=unstable_getMiniflareWorkerOptions(resolve(config))
 const script=await readFile(new URL('./storage-worker.mjs',import.meta.url),'utf8')
 const mf=new Miniflare({...convertV4MiniflareOptions({modules:true,script,compatibilityDate:workerOptions.compatibilityDate,compatibilityFlags:workerOptions.compatibilityFlags,d1Databases:workerOptions.d1Databases,r2Buckets:workerOptions.r2Buckets,unsafeLocalExplorer:false}),resourcePersistencePath:resolve(state)})
 try {
  const env=await mf.getBindings(),worker=await mf.getWorker()
  return {env:{...env,ARCHIVE_COPY:(source,key,size,session)=>worker.copyOriginal(source,key,size,session)},dispose:()=>mf.dispose()}
 }catch(error){await mf.dispose();throw error}
}
export async function engine() {
 const dir=await mkdtemp(join(tmpdir(),'evidence-archive-engine-'))
 try {
  await dependency('esbuild').build({stdin:{contents:"export {inventory,summary,exportArchive,restoreArchive,exportJournal} from './src/evidence/archive/service';",resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',target:'node22',outfile:join(dir,'engine.mjs')})
  return {module:await import(pathToFileURL(join(dir,'engine.mjs')).href),close:()=>rm(dir,{recursive:true,force:true})}
 }catch(error){await rm(dir,{recursive:true,force:true});throw error}
}
