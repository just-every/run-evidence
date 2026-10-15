import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { siteServer } from './helpers/site-runtime.mjs'

// The emitted site is the public door: follow its links and asset imports.
const server=await siteServer()
const paths=[]
async function pages(dir,prefix=''){
 for(const item of await readdir(dir,{withFileTypes:true})){
  if(item.isDirectory())await pages(join(dir,item.name),prefix+'/'+item.name)
  else if(item.name==='index.html')paths.push(prefix||'/')
  else if(item.name.endsWith('.html'))paths.push(prefix+'/'+item.name.slice(0,-5))
 }
}
try {
 await pages('dist/site')
 assert.ok(paths.includes('/')&&paths.includes('/run')&&paths.includes('/docs'))
 const seen=new Map(),queue=[...paths]
 while(queue.length){
  const path=queue.shift();if(seen.has(path))continue
  const response=await fetch(server.origin+path)
  assert.equal(response.status,200,'Built site resolves '+path)
  const type=response.headers.get('content-type')||''
  const text=/html|css/.test(type)?await response.text():''
  seen.set(path,text)
  const refs=type.includes('html')?[...text.matchAll(/(?:href|src)="([^"]+)"/g)].map(m=>m[1]):type.includes('css')?[...text.matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g)].map(m=>m[1]):[]
  for(const ref of refs){
   const url=new URL(ref.replaceAll('&amp;','&'),server.origin+path)
   if(url.origin===server.origin){
    assert.ok(!/^\/(?:app|signin|setup|auth)(?:\/|$)/.test(url.pathname),'Site never points into a private installation')
    queue.push(url.pathname)
    if(url.hash){
     const target=await (await fetch(url)).text()
     const id=decodeURIComponent(url.hash.slice(1))
     assert.ok(target.includes(`id="${id}"`),'Section link resolves '+url.pathname+url.hash)
    }
   }
  }
 }
 const homepage=seen.get('/')
 assert.match(homepage,/<a[^>]*href="\/run"[^>]*>/,'Homepage opens the run instructions')
 assert.match(homepage,/<a[^>]*href="\/docs"[^>]*>/,'Homepage opens on-site guides')
 const docs=[...seen.keys()].filter(path=>path.startsWith('/docs/'))
 assert.ok(docs.length>0,'Repository guides are built')
 for(const path of docs){assert.match(seen.get(path),/<article/);assert.match(seen.get(path),/href="\/docs/)}
 assert.ok(!(homepage||'').includes('<script'),'Landing works without JavaScript')
 console.log(`PASS static run-site journey: ${paths.length} pages, ${seen.size} local pages/assets, working run/docs navigation and section links.`)
}finally{await server.close()}
