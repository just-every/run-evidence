import { fileURLToPath as __rerTestEntryPath } from 'node:url';
const __rerTestEntry = __rerTestEntryPath(import.meta.resolve('@runeditrun/rer/internal/global/rer.mjs'));
const __rerTestEntryArgs = args => args[1] === 'dev' && !args.some(arg => ['--foreground', '--detach', '--stop', '--help'].includes(arg)) ? [...args, '--foreground'] : args;
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { cp, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { createServer } from 'node:net'

// Output is private until reduced to phase/status. Never publish a sign-in or
// reviewer URL, or Playwright's navigation diagnostics.
export const sanitize = value => String(value).replace(/https?:\/\/[^\s"'<>]+/g,'[private URL]').replace(/[A-Za-z0-9_-]{40,}/g,'[private value]').replace(/^.*(?:RER_OPEN|RER_DEV_KEY|SESSION_SECRET|SETUP_TOKEN).*$/gm,'[private output withheld]').slice(-1500)
export const wait = ms => new Promise(done=>setTimeout(done,ms))

export async function installation(root) {
 const dir=await mkdtemp(join(tmpdir(),'evidence-review-browser-'))
 let server,log=''
 const env={...process.env,RER_SERVER_JOURNEY:'1',WRANGLER_SEND_METRICS:'false'}
 delete env.RER_LOCAL_OPERATION
 const queue=process.env.EVIDENCE_NO_QUEUE==='1'?['--no-queue']:[]
 const run=async args=>{
  const child=spawn(process.execPath,[__rerTestEntry,...args,...(args.includes('--stop')?[]:queue)],{cwd:dir,env,stdio:['ignore','pipe','pipe']})
  let output='';for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{output+=chunk})
  const code=await new Promise((done,fail)=>{child.once('error',fail);child.once('close',done)})
  assert.equal(code,0,`rer ${args[0]} failed (${code}): ${sanitize(output)}`)
 }
 const stop=async()=>{
  if(!server)return
  try {await run(['dev','--stop'])} finally {
   if(server.exitCode===null&&server.signalCode===null)server.kill('SIGTERM')
   await new Promise(done=>server.exitCode!==null||server.signalCode!==null?done():server.once('close',done));server=null
  }
 }
 try {
  await cp(root,dir,{recursive:true,filter:path=>!['node_modules','.git','.wrangler','.rer','.seed','.cache','dist','.tanstack','.dev.vars'].includes(basename(path))&&!basename(path).startsWith('.env')})
  const socket=createServer();await new Promise(done=>socket.listen(0,'127.0.0.1',done));const port=socket.address().port;await new Promise(done=>socket.close(done))
  const origin=`http://127.0.0.1:${port}`
  return {dir,origin,run,stop,async start(){
   await run(['setup','--owner-email','owner@example.test','--port',String(port),'--non-interactive'])
   log='';server=spawn(process.execPath,__rerTestEntryArgs([__rerTestEntry,'dev','--port',String(port),...queue]),{cwd:dir,env,stdio:['ignore','pipe','pipe']})
   for(const stream of [server.stdout,server.stderr])stream.on('data',chunk=>{log+=chunk})
   for(let n=0;n<720&&!/^RER_OPEN /m.test(log);n++){if(server.exitCode!==null||server.signalCode!==null)throw Error('rer dev failed: '+sanitize(log));await wait(250)}
   const open=log.match(/^RER_OPEN (\S+)/m)?.[1];assert.ok(open,'dev supplied owner sign-in');return open
  },async close(){try{await stop()}finally{await rm(dir,{recursive:true,force:true})}}}
 } catch(error) {await rm(dir,{recursive:true,force:true});throw error}
}

export async function signIn(page,open) {
 await page.goto(open)
 await page.waitForURL(url=>url.pathname==='/setup'||url.pathname==='/app')
 if(new URL(page.url()).pathname==='/setup'){await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Finish setup'}).click()}
 await page.waitForURL(url=>url.pathname==='/app')
}
