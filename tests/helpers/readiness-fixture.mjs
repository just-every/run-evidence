import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { collectGit } from '../../scripts/private-collector/git.mjs'
const execute = promisify(execFile)

// This fixture writes only through authenticated production HTTP doors. The
// collector reads an actual disposable Git repository with the shipped reader.
export function readinessClient(fetch, origin) {
 const request = async (path, init = {}, status = 200) => {
  const response = await fetch(path, init)
  assert.equal(response.status, status, path + ': ' + await response.clone().text())
  return response
 }
 const get = async path => (await request(path)).json()
 const post = async (path, body, status = 201) => (await request(path, { method:'POST', headers:{origin,'content-type':'application/json'}, body:JSON.stringify(body) }, status)).json()
 return { origin, request, get, post }
}

export function browserReadinessClient(request, origin) {
 return readinessClient(async (path, init = {}) => {
  const options = { method:init.method ?? 'GET', headers:init.headers, maxRedirects:0 }
  if (init.body instanceof FormData) {
   options.multipart = {}
   for (const [key, value] of init.body) options.multipart[key] = typeof value === 'string' ? value : {name:value.name,mimeType:value.type,buffer:Buffer.from(await value.arrayBuffer())}
  } else if (init.body !== undefined) options.data = init.body
  const response = await request.fetch(origin + path, options)
  return new Response(await response.body(), {status:response.status(),headers:response.headers()})
 }, origin)
}

export async function seedReadiness(client, { name = 'Northstar SOC 2 Type II', at = new Date().toISOString(), auditFrom = at.slice(0,10), auditTo = auditFrom } = {}) {
 const { get, post, request, origin } = client, day = at.slice(0,10), year = day.slice(0,4)
 const program = await post('/api/programs', {framework:'soc2',name,legal_entity:'Northstar Cloud Inc.',report_type:'Type II',categories:['Availability','Confidentiality','Processing integrity','Privacy'],products:['Billing API','Customer portal'],teams:['Engineering','Security'],systems:['Production Git service','Identity provider'],audit_from:auditFrom,audit_to:auditTo,assessor:'Harbour Assurance LLP'})
 const base = '/api/programs/' + program.id
 const detail = await get(base), initial = detail.readiness
 program.name = detail.program.name
 assert.equal(initial.totals.ready, 0, 'unproven, untested work cannot start ready')
 assert.ok(initial.requirements.every(r => !r.ready))
 for (const row of initial.requirements.slice(50)) await post(base + '/applicability', {ref:row.ref,state:'excluded',rationale:'Assessor reviewed: this privacy processing activity is outside this audit scope.'}, 200)
 const scoped = (await get(base)).readiness.requirements.filter(r => r.state === 'included')
 assert.equal(scoped.length, 50)
 const controls = [...new Map(scoped.flatMap(r => r.controls).map(c => [c.library_id,c])).values()]
 const owner = await post('/api/people', {name:'Priya Shah',email:`readiness-${program.id}@northstar.test`,kind:'employee'})
 const collectorControl = controls.find(c => c.library_id === 'GOV-09')
 await post(`/api/controls/${collectorControl.id}/owners`, {owner_person_id:owner.id,reason:'Accountable for the requirements register'}, 200)
 const requirements = (await get('/api/desk')).requirements.filter(r => controls.some(c => c.id === r.control_id))
 const upload = async requirement => {
  const form = new FormData()
  for (const [key,value] of Object.entries({source:'Owner-reviewed '+requirement.name,covered_from:year+'-01-01',covered_to:year+'-12-31',effective_date:day})) form.set(key,value)
  form.set('file',new File([`${requirement.name}\nReviewed by Priya Shah on ${day}.\nScope: Billing API and Customer portal.\n`],`${requirement.library_id}.txt`,{type:'text/plain'}))
  await request(`/app/requirements/${requirement.id}/uploads`, {method:'POST',headers:{origin},body:form},303)
 }
 for (const r of requirements.filter(r => !['GOV-03','RSK-03'].includes(r.library_id))) await upload(r)
 const builder = await get('/api/policies/builder?program=' + program.id), policies = new Map()
 for (const template of builder.templates) {
  const draft = await post('/api/policies/templates/' + template.id, {program_id:program.id,owner_person_id:owner.id})
  const revision = await get(`/api/policies/${draft.policy}/revisions/${draft.revision}`)
  await post(`/api/policies/${draft.policy}/revisions/${draft.revision}/decision`, {decision:'approved',body_sha256:revision.body_sha256},200)
  await post(`/api/policies/${draft.policy}/revisions/${draft.revision}/publish`, {effective_date:day,material:'no'},200)
  policies.set(template.id,draft)
 }
 const token = await post('/api/api-tokens', {name:'Assurance register import',scopes:['read','resource-push'],expires_at:year+'-12-31T23:59:59Z'})
 const type = 'readiness_register_' + program.id.replaceAll('-','')
 const push = async approved => {
  await request('/v1/resources/' + type, {method:'PUT',headers:{cookie:'',authorization:'Bearer '+token.token,'content-type':'application/json'},body:JSON.stringify({resources:[{uniqueId:'program-register',displayName:'Northstar control assurance register',attributes:{approved}}]})},200)
 }
 await request('/v1/resource-types/' + type, {method:'PUT',headers:{cookie:'',authorization:'Bearer '+token.token,'content-type':'application/json'},body:JSON.stringify({schema:{fields:{approved:'boolean'}}})},200)
 await push(true)
 const sharedTest = await post('/api/tests', {name:'Control assurance register has owner approval',resourceType:type,criteria:JSON.stringify([{attribute:'approved',op:'equals',value:true}]),cadence:'daily',category:'code',severity:'high',controls:controls.filter(c => c.library_id !== 'GOV-09').map(c => c.library_id)})
 await post(`/api/tests/${sharedTest.id}/run`,{},200)
 const label = 'Northstar requirements register source'
 const collector = await post('/api/collectors', {label,reviewed:'yes'})
 const collectorTest = await post('/api/tests', {name:'Requirements register repository has a maintained branch',resourceType:'private.git.repository',criteria:JSON.stringify([{attribute:'branches',op:'min',value:1}]),cadence:'hourly',category:'code',severity:'high',controls:['GOV-09']})
 const directory = await mkdtemp(join(tmpdir(),'evidence-readiness-source-'))
 try {
  await execute('git',['init','--initial-branch=main',directory])
  await execute('git',['config','user.name','Run Edit Run fleet'],{cwd:directory});await execute('git',['config','user.email',['fleet', 'runeditrun.com'].join('@')],{cwd:directory})
  await writeFile(join(directory,'requirements.txt'),'Requirements register reviewed by the security owner.\n')
  await execute('git',['add','requirements.txt'],{cwd:directory})
  await execute('env',['GIT_AUTHOR_NAME=Run Edit Run fleet','GIT_AUTHOR_EMAIL=' + ['fleet', 'runeditrun.com'].join('@'),'GIT_COMMITTER_NAME=Run Edit Run fleet','GIT_COMMITTER_EMAIL=' + ['fleet', 'runeditrun.com'].join('@'),'git','commit','-m','Record requirements register'],{cwd:directory})
 } catch (error) { await rm(directory,{recursive:true,force:true}); throw error }
 const collect = async (observedAt = new Date().toISOString()) => {
  const attributes = await collectGit(directory)
  await request(`/collectors/${collector.id}/observations`, {method:'POST',headers:{cookie:'',authorization:'Bearer '+collector.token,'content-type':'application/json'},body:JSON.stringify({revision:'private-git/v1',outcome:'complete',observedAt,resource:{uniqueId:label,displayName:label,attributes}})},201)
 }
 const close = () => rm(directory,{recursive:true,force:true})
 try { await collect(at) } catch (error) { await close(); throw error }
 return {program,base,owner,controls,requirements,policies,sharedTest,collectorTest,collector,collect,push,upload,close,getReady:async () => (await get(base)).readiness,board:query => get(base + '/board' + (query ? '?'+query : '')),completeProof:async () => {for (const r of requirements.filter(r => ['GOV-03','RSK-03'].includes(r.library_id))) await upload(r)} }
}

export function assertReadiness(readiness, ready, percent) {
 const totals = readiness.totals ?? readiness.readiness, rows = readiness.requirements
 assert.deepEqual([totals.included,totals.ready,totals.not_ready,totals.readiness_percent],[50,ready,50-ready,percent])
 assert.equal(rows.filter(r => r.state === 'included' && r.ready).length, ready)
 assert.ok(rows.filter(r => r.state === 'excluded').every(r => !r.ready))
 for (const r of rows.filter(r => r.ready)) {
  assert.equal(r.proof,'current',r.ref)
  assert.equal(r.testing,'passing',r.ref)
  assert.notEqual(r.policy,'missing',r.ref)
  assert.ok(r.controls.every(c => c.tests?.pass > 0 && !c.tests.fail && !c.tests.unknown && !c.tests.untested),r.ref)
 }
}

// RFC 4180 parser: report details contain commas, quotes and embedded JSON.
export function csvRows(text) {
 const rows = [], row = []; let cell = '', quoted = false
 for (let i=0;i<text.length;i++) {
  const c = text[i]
  if (c === '"') {if (quoted && text[i+1] === '"') {cell += '"';i++} else quoted = !quoted}
  else if (c === ',' && !quoted) {row.push(cell);cell=''}
  else if (c === '\n' && !quoted) {row.push(cell.replace(/\r$/,''));rows.push([...row]);row.length=0;cell=''}
  else cell += c
 }
 if (cell || row.length) {row.push(cell);rows.push(row)}
 return rows
}
