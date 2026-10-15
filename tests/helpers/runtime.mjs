import { createRequire } from 'node:module'
import { readFile, readdir, mkdtemp, rm } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomBytes } from 'node:crypto'
const require = createRequire(import.meta.url)
const dependency = createRequire(require.resolve('wrangler/package.json'))
const { unstable_splitSqlQuery } = dependency('wrangler')
const { Miniflare, convertV4MiniflareOptions } = dependency('miniflare')
const { build } = dependency('esbuild')
export async function runtime({ migrationThrough } = {}) {
 const dir = await mkdtemp(join(tmpdir(),'evidence-http-'))
 const bundled = await build({ entryPoints:['tests/helpers/worker.ts'], bundle:true, write:false, format:'esm', platform:'neutral', target:'es2022', external:['cloudflare:*','node:*'] })
 const origin = 'http://127.0.0.1:8787'
 const vars = { AUTH_LOCAL:'true',AUTH_ORIGIN:origin,OWNER_EMAIL:'owner@example.test',SESSION_SECRET:randomBytes(32).toString('hex'),SETUP_TOKEN:randomBytes(32).toString('hex'),MAIL_PROVIDER:'development',MAIL_FROM:'auth@localhost.test',RER_DEV_KEY:randomBytes(32).toString('base64url'),HARNESS_NOW:'2026-10-11T12:00:00Z' }
 const options = () => ({ ...convertV4MiniflareOptions({ modules:true, script:bundled.outputFiles[0].text, compatibilityDate:'2026-09-08',compatibilityFlags:['nodejs_compat'],d1Databases:{DB:'evidence-tests'},r2Buckets:{EXHIBITS:'exhibits'},bindings:vars,unsafeLocalExplorer:false,unsafeTriggerHandlers:false }),resourcePersistencePath:dir })
 const mf = new Miniflare(options())
 let db = await mf.getD1Database('DB')
 for (const file of (await readdir('migrations/core')).filter(x=>x.endsWith('.sql') && (!migrationThrough || x.slice(0,4)<=migrationThrough || /^001[0-3]_/.test(x))).sort()) {
  const sql = await readFile(join('migrations/core',file),'utf8')
  // Use Wrangler's migration splitter so trigger bodies stay intact.
  for (const statement of unstable_splitSqlQuery(sql)) await db.prepare(statement).run()
 }
 let cookie = ''
 const fetch = async (path, init={}) => {
  const request = new Request(origin+path,{ ...init,duplex:'half',headers:{ ...(cookie ? {cookie}:{}),...init.headers } })
  const headers = Object.fromEntries(request.headers)
  headers['x-harness-url']=origin+path;headers['x-harness-host']=request.headers.get('host') || new URL(origin).host
  return mf.dispatchFetch(origin+path,{method:request.method,redirect:'manual',headers,body:request.body,duplex:'half'})
 }
 const post = (path,body) => fetch(path,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)})
 async function signin() {
  const claim = await post('/auth/bootstrap',{token:vars.SETUP_TOKEN,displayName:'Evidence owner'})
  if (claim.status !== 303) throw Error('Claim failed '+claim.status)
  const link = await post('/auth/magic-link',{email:vars.OWNER_EMAIL}); if(link.status!==202) throw Error('Mail failed')
  const outbox = await (await fetch('/__dev/outbox',{headers:{'x-rer-dev-key':vars.RER_DEV_KEY}})).text()
  const path = outbox.match(/href="(\/__dev\/outbox\?message=[^"]+)"/)?.[1]
  const mail = await (await fetch(path.replaceAll('&amp;','&'),{headers:{'x-rer-dev-key':vars.RER_DEV_KEY}})).text()
  const token = new URL(mail.match(/href="([^"]*\/auth\/confirm\?token=[^"]+)"/)[1].replaceAll('&amp;','&'),origin).searchParams.get('token')
  const confirmed = await post('/auth/confirm',{token}); if(confirmed.status!==303) throw Error('Confirmation failed')
  cookie=confirmed.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ')
  const complete = await fetch('/setup',{method:'POST',headers:{origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'})
  if(complete.status!==303) throw Error('First-run completion failed')
  return cookie
 }
 return { mf,persistencePath:dir,get db(){return db},origin,fetch,signin, setCookie:value=>{cookie=value}, clock:async now=>{vars.HARNESS_NOW=now;await mf.setOptions(options());db=await mf.getD1Database('DB')}, close:async()=>{await mf.dispose();await rm(dir,{recursive:true,force:true})} }
}
