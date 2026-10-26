import { fileURLToPath } from 'node:url'
import { readableRecordsBrowser } from './readable-records-browser.mjs'
import assert from 'node:assert/strict'
import {runtime} from './runtime.mjs'
export async function readableRecordsJourney({ browser = false } = {}) {
console.log('Preparing native readable-record fixtures')
const app=await runtime(), failures=[]
console.log('Native readable-record runtime ready')
let ownerCookie
const post=async(path,body,status=201)=>{const r=await app.fetch(path,{method:'POST',headers:{origin:app.origin,'content-type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,status,path);return r.json()}
const check=async(name,fn)=>{try{await fn();console.log('PASS '+name)}catch(e){failures.push(name);console.log('FAIL '+name)}}
const plain=s=>s.replace(/<[^>]+>/g,' ')
const uuid=/\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/
try{
 ownerCookie=await app.signin()
 const p=await post('/api/programs',{framework:'soc2',name:'SOC 2 Type II FY2027',legal_entity:'Cedar Ridge Health Analytics, Inc.',products:['Claims analytics'],report_type:'Type II',audit_from:'2026-07-01',audit_to:'2027-06-30'})
 await post('/api/people',{name:'Jess Tran',email:'jess@cedar-ridge.test',kind:'contractor'})
 await post(`/api/programs/${p.id}/documents`,{kind:'soc2-description'})
 const document=`/app/programs/${p.id}/documents/soc2-description`
 await check('Auditor document uses named sources and singular headcount',async()=>{const html=plain(await(await app.fetch(document)).text());assert.doesNotMatch(html,uuid);assert.match(html,/1 current contractor is recorded/);assert.match(html,/Program scope: SOC 2 Type II FY2027/)})
 for(const format of ['pdf','docx'])await check('Auditor '+format+' export uses named sources',async()=>{const r=await app.fetch(document+'/export?format='+format);assert.equal(r.status,200);const bytes=Buffer.from(await r.arrayBuffer());assert.ok(!bytes.includes(Buffer.from(p.id)));assert.ok(bytes.includes(Buffer.from('Program scope: SOC 2 Type II FY2027')))})
 const control=await app.fetch('/app/controls',{method:'POST',headers:{origin:app.origin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({name:'Quarterly access review',group:'Access',proof:'Signed access review',cadence:'quarterly'})})
 const req=control.headers.get('location').split('/').at(-1)
 const form=new FormData();for(const[k,v]of Object.entries({source:'Approved access review',covered_from:'2026-10-01',covered_to:'2026-10-11'}))form.set(k,v);form.set('file',new File(['Approved access review'],'access-review.txt'))
 const uploaded=await app.fetch(`/app/requirements/${req}/uploads`,{method:'POST',headers:{origin:app.origin},body:form}), receipt=uploaded.headers.get('location')
 await check('Owner receipt shows actor and file names without machine links',async()=>{const html=plain(await(await app.fetch(receipt)).text());assert.doesNotMatch(html,uuid);assert.ok(!html.includes('Receipt JSON'))})
 const desk=await(await app.fetch('/api/desk')).json(), r=desk.requirements.find(x=>x.id===req)
 const folder=await post('/api/folders',{reviewer_label:'Cedar Ridge annual review',period_from:'2026-10-01',period_to:'2026-10-11',expires_at:'2026-11-01T12:00:00Z',control_ids:[r.control_id]})
 const review=new URL(folder.review_url).pathname
 await app.fetch(review,{headers:{cookie:''}})
 await app.fetch(review+'/receipts/'+receipt.split('/').at(-1)+'/download',{headers:{cookie:''}})
 await check('Reviewer receipt has file names without internal identifiers',async()=>{const html=plain(await(await app.fetch(review+'/receipts/'+receipt.split('/').at(-1)+'/view',{headers:{cookie:''}})).text());assert.doesNotMatch(html,uuid);assert.ok(!html.includes('Receipt JSON'))})
 await check('Folder access log names the folder and file',async()=>{const html=plain(await(await app.fetch('/app/folders/events')).text());assert.doesNotMatch(html,uuid);assert.match(html,/Cedar Ridge annual review/);assert.match(html,/access-review.txt/)})
 await post('/api/trust/settings',{postal_address:'Cedar Ridge Health Analytics, Inc., 80 Test Street, Brisbane QLD 4000, Australia',notice_days:30,public_enabled:true,confirmations_enabled:false},200)
 await post('/api/trust/categories',{name:'Assurance operations',slug:'assurance-operations'})
 const update=await post('/api/trust/updates',{category:'assurance-operations',title:'Annual assurance review',body:'Our annual assurance review is underway.',visibility:'public'})
 await post(`/api/trust/updates/${update.id}/approve`,{notify:false},200)
 await post(`/api/trust/updates/${update.id}/publish`,{},200)
 await check('Public trust center names the business and category with readable dates',async()=>{const html=plain(await(await app.fetch('/trust',{headers:{cookie:''}})).text());assert.match(html,/Cedar Ridge Health Analytics/);assert.match(html,/Assurance operations/);assert.ok(!html.includes('assurance-operations'));assert.doesNotMatch(html,/2026-10-11T12:00/)})
 assert.equal(failures.length,0,failures.join('; '))
 if (browser) {
  for (const template of ['encryption','sanctions','human-resources']) await post('/api/policies/templates/'+template,{program_id:p.id})
  await readableRecordsBrowser(app,ownerCookie,{document,receipt,review})
 }
}finally{await app.close()}
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await readableRecordsJourney({ browser: true })
