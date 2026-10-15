import { createRequire } from 'node:module'
import { mkdtemp,rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join,resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
const require=createRequire(import.meta.url), dependency=createRequire(require.resolve('wrangler/package.json'))
export async function localStore(config,state) {
 const {getPlatformProxy}=dependency('wrangler')
 return getPlatformProxy({configPath:resolve(config),persist:{path:resolve(state)},remoteBindings:false})
}
export async function engine() {
 const dir=await mkdtemp(join(tmpdir(),'evidence-archive-engine-'))
 try {
  await dependency('esbuild').build({stdin:{contents:"export {inventory,summary} from './src/evidence/archive/inventory'; export {exportArchive} from './src/evidence/archive/export'; export {restoreArchive} from './src/evidence/archive/restore';",resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',target:'node22',outfile:join(dir,'engine.mjs')})
  return {module:await import(pathToFileURL(join(dir,'engine.mjs')).href),close:()=>rm(dir,{recursive:true,force:true})}
 }catch(error){await rm(dir,{recursive:true,force:true});throw error}
}
