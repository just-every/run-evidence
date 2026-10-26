import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile,mkdir } from 'node:fs/promises'
import { resolve,extname,join } from 'node:path'
import { chromium } from 'playwright'
import { runtime } from './runtime.mjs'
import { tailoringFixture } from './tailoring-journey.mjs'
import { declareAndEnable, fakeModel } from './model-fixture.mjs'
import { questionRows } from './answer-journey.mjs'
export async function assuranceBrowser(){const model=fakeModel(),app=await runtime({outbound:model.outbound}),output=resolve(process.env.EVIDENCE_BROWSER_OUTPUT??'.cache/browser/assurance');let browser,server,origin
 try{
  const cookie=await app.signin()
  server=createServer(async(req,res)=>{try{const url=new URL(req.url,origin),path=resolve('public','.'+url.pathname)
   if(path.startsWith(resolve('public')+'/')&&/\.(css|woff2?|svg|png|js)$/.test(path)){res.writeHead(200,{'content-type':({'.css':'text/css','.woff2':'font/woff2','.woff':'font/woff','.svg':'image/svg+xml','.png':'image/png','.js':'text/javascript'})[extname(path)]});res.end(await readFile(path));return}
   const chunks=[];for await(const chunk of req)chunks.push(chunk)
   const headers={...req.headers,host:new URL(app.origin).host};if(headers.origin===origin)headers.origin=app.origin
   const r=await app.fetch(url.pathname+url.search,{method:req.method,headers,redirect:'manual',...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})}),out=Object.fromEntries(r.headers);if(out.location?.startsWith(app.origin))out.location=origin+out.location.slice(app.origin.length);res.writeHead(r.status,out);res.end(Buffer.from(await r.arrayBuffer()))
  }catch{res.writeHead(500);res.end('Transport unavailable')}})
  await new Promise(done=>server.listen(0,'127.0.0.1',done));origin='http://127.0.0.1:'+server.address().port
  browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});await mkdir(output,{recursive:true})
  for(const width of [1440,390]){
   const fixture=await tailoringFixture(app,'browser'+width),context=await browser.newContext({viewport:{width,height:1000}})
   await context.addCookies(cookie.split('; ').map(pair=>{const i=pair.indexOf('=');return{name:pair.slice(0,i),value:pair.slice(i+1),url:origin}}))
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
   const capture=async name=>{await page.evaluate(()=>document.fonts.ready);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' overflow at '+width);await page.screenshot({path:join(output,`${width}-${name}.png`),fullPage:true})}
   await page.goto(origin+'/app/agent');await capture('agent-preparation-links')
   await page.getByRole('link',{name:'Tailor policies, risks and obligations'}).click();await page.getByRole('heading',{name:'Tailor obligations',exact:true}).waitFor();await capture('tailoring-workspace')
   const prepare=async index=>{
    await page.goto(origin+'/app/tailoring')
    for(const [label,value]of Object.entries({'Receiving program':fixture.program.id,'Customer addendum':fixture.framework.id,'Customer requirement':fixture.requirements[index].id,'Selected framework or regulatory requirement':fixture.material.id,'Control hint (optional)':index===0?'':fixture.control,'Approved policy revision':fixture.policy.revision}))await page.getByLabel(label,{exact:true}).selectOption(value)
    await page.getByRole('checkbox',{name:'Production customer service browser'+width,exact:true}).check()
    await page.getByLabel('Applicability and interpretation assumptions').fill(fixture.input.assumptions)
    await page.getByLabel('Proposed likelihood').fill('2');await page.getByLabel('Proposed impact').fill('4')
    await page.getByRole('button',{name:'Prepare exact proposal'}).click();await page.getByRole('heading',{name:'Tailoring proposal',exact:true}).waitFor()
   }
   // SECURE-001 and AGENT-006: the declared flow screen, then an interpretation drafted through it.
   await declareAndEnable(fixture.post,{account:'org-synthetic-'+width,api_key:'synthetic-evidence-model-key-'+width});await page.goto(origin+'/app/connections/flows');await page.getByRole('heading',{name:'Declared outbound flows',exact:true}).waitFor();await capture('declared-flows')
   await page.goto(origin+'/app/roles');await page.getByRole('heading',{name:'Roles',exact:true}).waitFor();await capture('access-roles')
   await page.goto(origin+'/app/tailoring')
   for(const [label,value]of Object.entries({'Receiving program':fixture.program.id,'Customer addendum':fixture.framework.id,'Customer requirement':fixture.requirements[2].id,'Selected framework or regulatory requirement':fixture.material.id,'Control hint (optional)':fixture.control,'Approved policy revision':fixture.policy.revision}))await page.getByLabel(label,{exact:true}).selectOption(value)
   await page.getByRole('checkbox',{name:'Production customer service browser'+width,exact:true}).check()
   await page.getByRole('button',{name:'Interpret with the declared model flow'}).click();await page.getByRole('heading',{name:'Interpretation',exact:true}).waitFor();await page.getByText('Quoted verbatim from the cited source.').first().waitFor();await capture('tailoring-interpretation')
   await prepare(1);await page.getByText('Ambiguous obligation:',{exact:false}).waitFor();await capture('tailoring-ambiguous-proposal')
   const proposalUrl=page.url();await page.getByRole('link',{name:'Original source US-2',exact:true}).click();await capture('tailoring-original-clause');await page.goto(proposalUrl)
   await page.getByLabel('Named security/legal owner',{exact:true}).selectOption(fixture.owner.id)
   await page.getByLabel('Decision',{exact:true}).selectOption('rejected');await page.getByLabel('Decision reason').fill('Reject the ambiguous interpretation; keep the original policy and scope')
   await page.getByRole('button',{name:'Record individual decision'}).click();await page.getByRole('heading',{name:'rejected',exact:true}).waitFor();await capture('tailoring-rejected')
   await prepare(0)
   const approvedProposal=new URL(page.url()).pathname.split('/').at(-1),recommendation=await fixture.get('/api/tailoring/'+approvedProposal),approvedControl=recommendation.snapshot.mapping.control_id
   assert.equal(recommendation.snapshot.control_selection.mode,'source-based recommendation')
   await page.getByLabel('Named security/legal owner',{exact:true}).selectOption(fixture.owner.id);await page.getByLabel('Decision',{exact:true}).selectOption('approved');await page.getByLabel('Decision reason').fill('Approved exact passage, proposed risk and policy draft')
   await page.getByRole('button',{name:'Record individual decision'}).click();await page.getByRole('heading',{name:'approved',exact:true}).waitFor();await capture('tailoring-approved')
   await page.getByRole('link',{name:'Proposals and structured obligations',exact:true}).click();await page.locator('section').filter({has:page.getByRole('heading',{name:'US-1',exact:true})}).filter({has:page.locator('a[href="/app/controls/'+approvedControl+'"]')}).filter({has:page.locator('a[href="/app/tailoring/'+approvedProposal+'"]')}).waitFor();await capture('tailoring-structured-obligation')
   const selectedPassage=await fixture.post('/api/questionnaires/sources',{kind:'policy',source_id:fixture.policy.revision,quote:'Access reviews occur annually.'})
   await page.goto(origin+'/app/questionnaires');await page.getByRole('heading',{name:'Questionnaires',exact:true}).waitFor();await capture('questionnaires-workspace')
   const form=page.locator('form[action="/app/questionnaires"]'),rows=questionRows.map((r,i)=>i===1?[r[0],r[1],'Describe access reviews',r[3],r[4]]:i===3?[r[0],r[1],'Do you perform annual access reviews?',r[3],r[4]]:r),bytes=Buffer.from(rows.map(r=>r.map(s=>'"'+s.replaceAll('"','""')+'"').join(',')).join('\r\n'))
   await form.getByLabel('Name',{exact:true}).fill('Buyer assurance '+width);await form.getByLabel('Program',{exact:true}).selectOption(fixture.program.id)
   await form.getByLabel('File',{exact:true}).setInputFiles({name:'buyer.csv',mimeType:'text/csv',buffer:bytes})
   await form.getByRole('button',{name:'Retain template and questions'}).click();await page.getByRole('heading',{name:'Buyer assurance '+width,exact:true}).waitFor();await capture('questionnaire-template')
   await page.getByRole('button',{name:'Generate cited extractive draft'}).click();await page.getByRole('heading',{name:'Questionnaire draft review',exact:true}).waitFor();await capture('questionnaire-cited-draft')
   await page.getByLabel('Question ID',{exact:true}).fill('Q1')
   await page.getByLabel('Authorized source passage',{exact:true}).selectOption(selectedPassage.id)
   await page.getByRole('button',{name:'Retain revised draft'}).click()
   await page.getByText('Draft 2 ·',{exact:false}).waitFor();await capture('questionnaire-revised-draft')
   await page.getByLabel('Question ID',{exact:true}).fill('Q3')
   await page.getByLabel('Authorized source passage',{exact:true}).selectOption(selectedPassage.id)
   await page.getByLabel('Exact choice value (only for a declared yes/no format)',{exact:true}).fill('yes')
   await page.getByLabel('I checked that the cited passage supports this exact choice',{exact:true}).check()
   await page.getByLabel('Reason',{exact:true}).fill('The approved policy explicitly requires annual access reviews')
   await page.getByRole('button',{name:'Retain revised draft'}).click()
   await page.getByText('Draft 3 ·',{exact:false}).waitFor();await capture('questionnaire-reviewed-choice')
   await page.getByLabel('Named security/legal reviewer',{exact:true}).selectOption(fixture.owner.id);await page.getByLabel('Exact recipient email').fill('buyer@customer.test');await page.getByLabel('Answer set expires on').fill('2027-01-01');await page.getByLabel('Review reason').fill('Exact excerpts and flagged gaps reviewed for this recipient')
   await page.getByRole('button',{name:'Approve exact answer set and recipient'}).click();await page.getByRole('heading',{name:'Approved recipient',exact:true}).waitFor();await capture('questionnaire-approved')
   const exportUrl=await page.getByRole('link',{name:'Export approved buyer template'}).getAttribute('href'),downloadPromise=page.waitForEvent('download');await page.getByRole('link',{name:'Export approved buyer template'}).click();assert.equal(await (await downloadPromise).failure(),null)
   const citationsPromise=page.waitForEvent('download');await page.getByRole('link',{name:'Export approved citations and flagged gaps'}).click();assert.equal(await (await citationsPromise).failure(),null)
   await page.goto(origin+'/app/programs/'+fixture.program.id);await page.getByRole('link',{name:'Buyer assurance '+width,exact:true}).waitFor();await capture('questionnaire-readiness-drilldown')
   const changed=await fixture.post('/api/policies',{title:'Customer access policy browser'+width,body:'Access reviews occur monthly.'}),revision=await fixture.get(`/api/policies/${changed.policy}/revisions/${changed.revision}`)
   await fixture.post(`/api/policies/${changed.policy}/revisions/${changed.revision}/decision`,{decision:'approved',body_sha256:revision.body_sha256},200)
   await page.goto(origin+exportUrl);await page.getByRole('alert').waitFor();await capture('questionnaire-source-invalidated')
   assert.deepEqual(errors,[]);await context.close();console.log(`PASS ANSWER-001 / AGENT-006: cited templates, approval, invalidation, exact tailoring decisions and program drilldowns at ${width}`)
  }
 }finally{await browser?.close();if(server)await new Promise(done=>server.close(done));await app.close()}
}
