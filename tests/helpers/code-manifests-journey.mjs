import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { runtime } from './runtime.mjs'
import { githubFixture } from './github-fixture.mjs'
import { gitlabFixture } from './gitlab-fixture.mjs'
import { bitbucketFixture } from './bitbucket-fixture.mjs'
import { azuredevopsFixture } from './azuredevops-fixture.mjs'
const hash=(bytes,kind='sha256')=>createHash(kind).update(bytes).digest('hex')
const blob=bytes=>createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex')
const contents={
 'package.json':Buffer.from('{\r\n  "name": "northstar-web", "dependencies": {"openai":"6.0.0"}\r\n}\r\n'),
 'package-lock.json':Buffer.from('{"name":"northstar-web","lockfileVersion":3,"packages":{"":{"dependencies":{"openai":"6.0.0"}}}}\n'),
 'requirements.txt':Buffer.from('openai==2.0.0\nrequests==2.32.0\n'),
 'go.mod':Buffer.from('module example.test/northstar\n\ngo 1.23\n\nrequire example.test/ai/sdk v1.0.0\n'),
}
// Re-sign frames after a custody-relationship mutation: refusal must validate
// the business binding, rather than merely detect a stale transport hash.
function changedArchive(source, mutate) {
 const magic=Buffer.from('EVIDENCE-ARCHIVE\n'),parts=[magic],digest=createHash('sha256');let at=magic.length,changed=false
 while(at<source.length){const size=source.readUInt32BE(at);at+=4;const frame=JSON.parse(source.subarray(at,at+size));at+=size
  if(frame.type==='rows'&&frame.table==='code_manifest_snapshots'&&!changed&&frame.rows.length){mutate(frame.rows[0]);changed=true}
  if(frame.type==='end')frame.sha256=digest.digest('hex')
  const bytes=Buffer.from(JSON.stringify(frame)),prefix=Buffer.alloc(4);prefix.writeUInt32BE(bytes.length);parts.push(prefix,bytes);if(frame.type!=='end')digest.update(prefix).update(bytes)
 }
 assert.ok(changed);return Buffer.concat(parts)
}
export async function codeManifestsJourney() {
 const gh=githubFixture(),gl=gitlabFixture(),bb=bitbucketFixture(),az=azuredevopsFixture(),fixtures={github:gh,gitlab:gl,bitbucket:bb,azuredevops:az}
 const calls=[],state={mode:null,move:false,head:hash('synthetic-evidence-revision-1','sha1')},second=hash('synthetic-evidence-revision-2','sha1')
 const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}})
 let duringRead=null
 const outbound=async request=>{
  const u=new URL(request.url),provider=u.hostname==='api.github.com'?'github':u.hostname==='gitlab.com'?'gitlab':u.hostname==='api.bitbucket.org'?'bitbucket':u.hostname==='dev.azure.com'?'azuredevops':null
  if(!provider)return null
  const p=u.pathname, token=provider==='github'?'synthetic-evidence-1':fixtures[provider].edge.token
  const root=provider==='github'?/^\/repos\/(northstar\/[^/]+)$/.exec(p):provider==='gitlab'?/^\/api\/v4\/projects\/(northstar%2F[^/]+)$/i.exec(p):provider==='bitbucket'?/^\/2\.0\/repositories\/(northstar\/[^/]+)$/.exec(p):new RegExp('^/northstar/([a-f0-9-]+)/_apis/git/repositories/([a-f0-9-]+)$').exec(p)
  const branch=provider==='github'?/\/branches\/main$/.test(p):provider==='gitlab'?/\/repository\/branches\/main$/.test(p):provider==='bitbucket'?/\/refs\/branches\/main$/.test(p):p.endsWith('/refs')
  const file=provider==='github'?p.includes('/contents/'):provider==='gitlab'?p.includes('/repository/files/'):provider==='bitbucket'?p.includes('/src/'):p.endsWith('/items')
  if(root||branch||file) {
   assert.equal(request.method,'GET');assert.equal(request.headers.get('authorization'),provider==='azuredevops'?'Basic '+Buffer.from(':'+token).toString('base64'):'Bearer '+token)
   calls.push({provider,url:u.href,path:p,query:Object.fromEntries(u.searchParams)})
   if(root) {
    if(provider==='github')return reply({full_name:root[1],default_branch:'main'})
    if(provider==='gitlab')return reply({path_with_namespace:decodeURIComponent(root[1]),default_branch:'main'})
    if(provider==='bitbucket')return reply({full_name:root[1],mainbranch:{name:'main'}})
    return reply({id:root[2],project:{id:root[1]},defaultBranch:'refs/heads/main'})
   }
   if(branch)return provider==='github'?reply({name:'main',commit:{sha:state.head}}):provider==='gitlab'?reply({name:'main',commit:{id:state.head}}):provider==='bitbucket'?reply({name:'main',target:{hash:state.head}}):reply({value:[{name:'refs/heads/main',objectId:state.head}]})
   if(duringRead){const action=duringRead;duringRead=null;await action()}
   const path=decodeURIComponent(provider==='azuredevops'?u.searchParams.get('path').slice(1):p.split('/').at(-1)),commit=provider==='github'||provider==='gitlab'?u.searchParams.get('ref'):provider==='bitbucket'?p.split('/src/')[1].split('/')[0]:u.searchParams.get('versionDescriptor.version')
   assert.ok(commit===hash('synthetic-evidence-revision-1','sha1')||commit===second,'all file reads use an immutable commit')
   if(state.move)state.head=second
   if(state.mode==='denied')return reply({message:'Denied'},403)
   if(state.mode==='absent')return reply({message:'Not found'},404)
   let bytes=contents[path];assert.ok(bytes,path)
   if(state.mode==='credential')bytes=Buffer.from('{"password":"synthetic-evidence-9"}')
   if(state.mode==='reflected')bytes=Buffer.from('{"description":"'+Buffer.from(token).toString('base64')+'"}')
   if(state.mode==='oversized')bytes=Buffer.alloc(131073,65)
   if(provider==='github')return reply({type:'file',path,encoding:'base64',content:bytes.toString('base64'),size:bytes.length,sha:state.mode==='bad-digest'?'0'.repeat(40):blob(bytes)})
   if(provider==='gitlab')return reply({file_path:path,encoding:'base64',content:bytes.toString('base64'),size:bytes.length,commit_id:state.mode==='wrong-revision'?'0'.repeat(40):commit,content_sha256:hash(bytes)})
   if(provider==='bitbucket')return new Response(bytes,{headers:{'content-type':'text/plain'}})
   if(!u.searchParams.has('download'))return reply({commitId:state.mode==='wrong-revision'?'0'.repeat(40):commit,path:'/'+path,objectId:state.mode==='bad-digest'?'0'.repeat(40):blob(bytes),isFolder:false})
   return new Response(bytes,{headers:{'content-type':'application/octet-stream'}})
  }
  return fixtures[provider].outbound(request)
 }
 console.log('Manifest journey: starting runtime')
 const app=await runtime({outbound});console.log('Manifest journey: source runtime ready');const target=await runtime({outbound}),connections=[];console.log('Manifest journey: restore runtime ready')
 const post=async(path,body,status=200)=>{const r=await app.fetch(path,{method:'POST',headers:{origin:app.origin,'content-type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,status,await r.clone().text());return r.json()}
 const get=async path=>{const r=await app.fetch(path);assert.equal(r.status,200,await r.clone().text());return r.json()}
 try {
  await app.signin();await app.clock('2026-10-11T12:00:00Z')
  const push=await post('/api/api-tokens',{name:'Manifest source reader',scopes:['read'],expires_at:'2027-04-01'},201)
  for(const provider of Object.keys(fixtures)) {
   console.log('Manifest journey: '+provider)
   state.mode=null;state.head=hash('synthetic-evidence-revision-1','sha1');state.move=true
   const token=provider==='github'?'synthetic-evidence-1':fixtures[provider].edge.token
   const c=await post('/api/connections',{provider,account:'northstar',token,...(provider==='bitbucket'?{admin_read_consent:'yes',reason:'Dedicated GET-only restriction-read grant'}:{})},201),root='/api/connections/'+c.id,originals=root+'/manifests'
   const repos=provider==='azuredevops'?[az.web,az.site]:['northstar/web','northstar/site']
   await post(root+'/repositories',{repositories:repos})
   for(const route of [originals,root+'/manifest-grants']) {
    assert.equal((await app.fetch(route,{method:'POST',headers:{cookie:'',origin:app.origin,'content-type':'application/json',authorization:'Bearer '+push.token},body:'{}'})).status,403)
    assert.equal((await app.fetch(route,{method:'POST',headers:{origin:'https://outside.example.test','content-type':'application/json'},body:'{}'})).status,403)
   }
   const before=calls.length;await post(originals,{},409);assert.equal(calls.length,before,'default deny before any original-source request')
   let view=await get(originals);assert.equal(view.allowed,false);assert.deepEqual(view.snapshots,[])
   const consent={decision:'grant',reason:'Retain these private originals for the owner audit',credential_revision:view.credential_revision}
   await post(root+'/manifest-grants',consent,400)
   await post(root+'/manifest-grants',{...consent,acknowledge_originals:'yes',credential_revision:'stale'},409)
   await post(root+'/manifest-grants',{...consent,acknowledge_originals:'yes'})
   console.log('Manifest journey: capture '+provider)
   const captured=await post(originals,{})
   assert.equal(captured.outcome,'complete',JSON.stringify(captured));assert.equal(captured.captured.length,8);assert.deepEqual(captured.gaps,[])
   view=await get(originals);assert.equal(view.snapshots.length,8)
   // Each repository is resolved once. A changed head cannot mix revisions
   // inside its four original-file reads.
   for(const repository of repos){const rows=view.snapshots.filter(s=>s.repository===repository);assert.equal(new Set(rows.map(s=>s.source_revision)).size,1)}
   assert.ok(calls.filter(c=>c.provider===provider).every(c=>!c.path.includes('/tools')),'unselected repositories must never be read')
   for(const row of view.snapshots) {
    assert.equal(row.sha256,hash(contents[row.manifest_path]));assert.equal(row.size,contents[row.manifest_path].length)
    const r=await app.fetch(row.download_url);assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'application/octet-stream');assert.deepEqual(Buffer.from(await r.arrayBuffer()),contents[row.manifest_path],'retain exact whitespace and line endings')
    assert.equal((await app.fetch(row.download_url,{headers:{cookie:''}})).status,401)
    assert.equal((await app.fetch(row.download_url,{headers:{cookie:'',authorization:'Bearer '+push.token}})).status,403)
   }
   state.move=false
   await post(originals,{}) // Only the second immutable revision may add rows.
   const count=(await get(originals)).snapshots.length;await post(originals,{});assert.equal((await get(originals)).snapshots.length,count,'unchanged revision does not duplicate originals')
   for(const mode of ['credential','reflected','oversized',...(provider==='gitlab'?['wrong-revision']:[]),...(['github','azuredevops'].includes(provider)?['bad-digest']:[]),'denied']) {
    state.mode=mode;const result=await post(originals,{})
    assert.equal(result.outcome,'partial',provider+' '+mode);assert.equal(result.captured.length,0,provider+' '+mode);assert.ok(result.gaps.length>0)
    assert.equal((await get(originals)).snapshots.length,count,'refused files must never enter custody')
   }
   state.mode='absent';const absent=await post(originals,{});assert.equal(absent.captured.length,0);assert.equal(absent.absent.length,8);assert.equal((await get(originals)).snapshots.length,count)
   state.mode=null
   const staleRevision=(await get(originals)).credential_revision
   await post(root+'/rotate',{token,...(provider==='bitbucket'?{admin_read_consent:'yes',reason:'Renew GET-only restriction read'}:{})})
   const noRead=calls.length;await post(originals,{},409);assert.equal(calls.length,noRead,'rotation invalidates original capture authority')
   await post(root+'/manifest-grants',{...consent,acknowledge_originals:'yes',credential_revision:staleRevision},409)
   await post(root+'/manifest-grants',{...consent,acknowledge_originals:'yes',credential_revision:(await get(originals)).credential_revision})
   if(provider==='github') {
    const beforeRevoke=calls.length
    duringRead=()=>post(root+'/manifest-grants',{decision:'revoke',reason:'Revoke while source file is in flight'})
    state.head=hash('synthetic-evidence-revision-1','sha1')
    // Force new source bytes so a cached old row cannot stand in for admission.
    const old=contents['package.json'];contents['package.json']=Buffer.from('{"name":"new-source-state"}\n')
    const interrupted=await post(originals,{});assert.equal(interrupted.outcome,'partial');assert.equal(interrupted.captured.length,0)
    contents['package.json']=old
    assert.equal((await get(originals)).snapshots.length,count);assert.equal(calls.length,beforeRevoke+3,'revocation stops every later source GET')
   }
   connections.push({id:c.id,provider,root,view:await get(originals),token})
  }
  assert.equal((await app.fetch(connections[0].view.snapshots[0].download_url.replace(connections[0].id,connections[1].id))).status,404,'no cross-connection original download')
  console.log('Manifest journey: archive')
  const exported=await app.fetch('/api/archive/export');assert.equal(exported.status,200,await exported.clone().text());const archive=Buffer.from(await exported.arrayBuffer())
  for(const c of connections)assert.ok(!archive.includes(Buffer.from(c.token))&&!archive.includes(Buffer.from(Buffer.from(c.token).toString('base64'))),'source keys and refused reflections never enter custody')
  await target.signin()
  for(const mutate of [row=>{row.grant_id=connections.find(c=>c.id!==row.connection_id).view.grant.id},row=>{row.source_url='javascript:globalThis.originalSourceExecuted=true'}]) {
   const refused=await target.fetch('/api/archive/restore',{method:'POST',headers:{origin:target.origin,'content-type':'application/octet-stream','x-evidence-confirm':'restore','x-evidence-erasure-history':'unverified acknowledged'},body:changedArchive(archive,mutate)})
   assert.equal(refused.status,400,await refused.clone().text());assert.equal((await target.db.prepare('SELECT COUNT(*) AS n FROM code_manifest_snapshots').first()).n,0,'hostile source custody writes no business facts');assert.equal((await(await target.mf.getR2Bucket('EXHIBITS')).list()).objects.length,0)
  }
  const restored=await target.fetch('/api/archive/restore',{method:'POST',headers:{origin:target.origin,'content-type':'application/octet-stream','x-evidence-confirm':'restore','x-evidence-erasure-history':'unverified acknowledged'},body:archive});assert.equal(restored.status,200,await restored.clone().text())
  for(const c of connections) {
   const view=await(await target.fetch(c.root+'/manifests')).json();assert.equal(view.allowed,false);assert.deepEqual(view.snapshots,c.view.snapshots);assert.deepEqual(view.grant,c.view.grant,'grant sequence and exact latest decision survive restore')
   for(const row of view.snapshots){const r=await target.fetch(row.download_url);assert.equal(r.status,200);assert.deepEqual(Buffer.from(await r.arrayBuffer()),contents[row.manifest_path])}
   const before=calls.length,r=await target.fetch(c.root+'/manifests',{method:'POST',headers:{origin:target.origin,'content-type':'application/json'},body:'{}'});assert.equal(r.status,409);assert.equal(calls.length,before)
  }
  console.log('PASS CODE-001: all four providers retain exact revision-bound original root manifests under credential-bound owner consent, refuse unsafe/unreadable files, and restore bytes with authority inactive')
 } finally { await app.close();await target.close() }
}
