#!/usr/bin/env node
import { createReadStream,createWriteStream } from 'node:fs'
import { unlink,mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { createHash } from 'node:crypto'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { localStore,engine } from './evidence-archive/local.mjs'
const args=process.argv.slice(2),verb=args.shift(),options={}
let proxy,compiled,outputCreated=false
try {
 while(args.length) { const key=args.shift(); if(['--yes','--dry-run'].includes(key)) options[key]=true; else if(['--input','--output','--config','--state'].includes(key) && args[0] && !args[0].startsWith('--')) options[key]=args.shift(); else throw Error('Unknown or missing archive argument.') }
 if(!['export','restore'].includes(verb)) throw Error('Use: node scripts/archive.mjs export --output FILE [--dry-run], or restore --input FILE [--dry-run | --yes]. Optional --config PATH --state PATH select only local storage. Stop dev first.')
 if(verb==='export' && !options['--dry-run'] && !options['--output']) throw Error('Export requires --output FILE.')
 if(verb==='restore' && (!options['--input'] || (!options['--dry-run'] && !options['--yes']))) throw Error('Restore requires --input FILE and --dry-run or --yes.')
 proxy=await localStore(options['--config'] || 'wrangler.jsonc',options['--state'] || '.wrangler/state/v3');compiled=await engine()
 const api=compiled.module,env=proxy.env
 if(verb==='export') {
  const manifest=await api.inventory(env)
  if(!options['--dry-run']) {
   await mkdir(dirname(options['--output']),{recursive:true})
   const output=createWriteStream(options['--output'],{flags:'wx',mode:0o600})
   output.once('open',()=>{outputCreated=true})
   await pipeline(Readable.fromWeb(await api.exportArchive(env,manifest)),output)
  }
  console.log(JSON.stringify({operation:'export',dry_run:!!options['--dry-run'],...api.summary(manifest),manifest_sha256:createHash('sha256').update(JSON.stringify(manifest)).digest('hex'),...(options['--dry-run'] ? {inventory:manifest.files} : {})},null,2))
 } else {
  console.log(JSON.stringify({operation:'restore',...await api.restoreArchive(env,Readable.toWeb(createReadStream(options['--input'])),!!options['--dry-run'],new Date(),Infinity)},null,2))
 }
}catch(error){if(outputCreated && options['--output']) await unlink(options['--output']).catch(()=>{});console.error(error?.message || 'Archive operation failed.');process.exitCode=1}
finally{await proxy?.dispose();await compiled?.close()}
