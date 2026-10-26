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
export async function runtime({ migrationThrough, outbound, mailOutbound, settings = {}, origin = 'http://127.0.0.1:8787', ownerEmail = 'owner@example.test', persistencePath, reuse = false } = {}) {
 const dir = persistencePath ?? await mkdtemp(join(tmpdir(),'evidence-http-'))
 const bundled = await build({ entryPoints:['tests/helpers/worker.ts'], bundle:true, write:false, format:'esm', platform:'neutral', target:'es2022', external:['cloudflare:*','node:*'] })
 const vars = { AUTH_LOCAL:'true',AUTH_ORIGIN:origin,OWNER_EMAIL:ownerEmail,SESSION_SECRET:randomBytes(32).toString('hex'),SETUP_TOKEN:randomBytes(32).toString('hex'),MAIL_PROVIDER:'resend',MAIL_API_KEY:randomBytes(32).toString('hex'),MAIL_FROM:'auth@localhost.test',RER_DEV_KEY:randomBytes(32).toString('base64url'),HARNESS_NOW:'2026-10-11T12:00:00Z',...settings }
 const messages = []
 // Fake only the paid mail-provider edge; authentication and D1/R2 remain real.
 // A suite may add another provider's fake at the same network edge (outbound).
 const mailProvider = async request => {
  if(mailOutbound && request.url === 'https://api.resend.com/emails') return mailOutbound(request)
  if(outbound && request.url !== 'https://api.resend.com/emails') { const answer = await outbound(request); if (answer) return answer }
  if(request.url !== 'https://api.resend.com/emails' || request.method !== 'POST') throw Error('Unexpected outbound request')
  messages.push(await request.json())
  return Response.json({id:crypto.randomUUID()})
 }
 let omitted = new Set()
 const options = () => ({ ...convertV4MiniflareOptions({ modules:true, script:bundled.outputFiles[0].text, compatibilityDate:'2026-09-08',compatibilityFlags:['nodejs_compat'],d1Databases:omitted.has('DB')?{}:{DB:'evidence-tests'},r2Buckets:omitted.has('EXHIBITS')?{}:{EXHIBITS:'exhibits'},bindings:vars,outboundService:mailProvider,unsafeLocalExplorer:false,unsafeTriggerHandlers:false }),resourcePersistencePath:dir })
 const mf = new Miniflare(options())
 let db = await mf.getD1Database('DB')
 for (const file of (reuse ? [] : await readdir('migrations/core')).filter(x=>x.endsWith('.sql') && (!migrationThrough || x.slice(0,4)<=migrationThrough || /^00(1\d|2\d)_/.test(x))).sort()) {
  const sql = await readFile(join('migrations/core',file),'utf8')
  // Use Wrangler's migration splitter so trigger bodies stay intact; one
  // transaction per file, as D1 applies a migration.
  await db.batch(unstable_splitSqlQuery(sql).map(statement => db.prepare(statement)))
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
  const token = new URL(messages.at(-1).html.match(/href="([^"]*\/auth\/confirm\?token=[^"]+)"/)[1].replaceAll('&amp;','&'),origin).searchParams.get('token')
  const confirmed = await post('/auth/confirm',{token}); if(confirmed.status!==303) throw Error('Confirmation failed')
  cookie=confirmed.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ')
  const complete = await fetch('/setup',{method:'POST',headers:{origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'})
  if(complete.status!==303) throw Error('First-run completion failed')
  return cookie
 }
 // The Cron Trigger at the harness clock, as rer dev and Cloudflare fire it.
 const tick = async () => (await mf.getWorker()).scheduled({ cron:'*/5 * * * *', scheduledTime:new Date(vars.HARNESS_NOW) })
 return { mf,messages,tick,harnessState:()=>({persistencePath:dir,settings:{...vars},reuse:true}),omitBindings:async names=>{omitted=new Set(names);await mf.setOptions(options());if(!omitted.has('DB'))db=await mf.getD1Database('DB')},persistencePath:dir,get db(){return db},origin,fetch,signin, setCookie:value=>{cookie=value}, setSettings:async extra=>{for(const [key,value] of Object.entries(extra)){if(value===undefined)delete vars[key];else vars[key]=value}await mf.setOptions(options());db=await mf.getD1Database('DB')}, clock:async now=>{vars.HARNESS_NOW=now;await mf.setOptions(options());db=await mf.getD1Database('DB')}, close:async()=>{await mf.dispose();await rm(dir,{recursive:true,force:true})} }
}
