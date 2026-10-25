import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {readFile,mkdir} from 'node:fs/promises'
import {resolve,extname,join} from 'node:path'
import {chromium} from 'playwright'
export async function engagementBrowser(app,{cookie,program,leaver,stage='open',screens,followLink=true,expand=false,decisionForm=false,trustForms=false}){
 const output=resolve(process.env.EVIDENCE_BROWSER_OUTPUT??'.cache/browser/engagements');let browser,server,origin
 try{
  server=createServer(async(req,res)=>{try{
   const url=new URL(req.url,origin),path=resolve('public','.'+url.pathname)
   if(path.startsWith(resolve('public')+'/')&&/\.(css|woff2?|svg|png|js)$/.test(path)){const data=await readFile(path);res.writeHead(200,{'content-type':({'.css':'text' + '/' + 'css','.woff2':'font' + '/' + 'woff2','.woff':'font' + '/' + 'woff','.svg':'image' + '/' + 'svg+xml','.png':'image' + '/' + 'png','.js':'text' + '/' + 'javascript'})[extname(path)]});res.end(data);return}
   const chunks=[];for await(const chunk of req)chunks.push(chunk)
   const headers={...req.headers,host:new URL(app.origin).host};if(headers.origin===origin)headers.origin=app.origin
   const response=await app.fetch(url.pathname+url.search,{method:req.method,headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})}),out=Object.fromEntries(response.headers)
   if(out.location?.startsWith(app.origin))out.location=origin+out.location.slice(app.origin.length)
   res.writeHead(response.status,out);res.end(Buffer.from(await response.arrayBuffer()))
  }catch{res.writeHead(500);res.end('Transport unavailable')}})
  await new Promise(done=>server.listen(0,'127.0.0.1',done));origin='http://127.0.0.1:'+server.address().port
  browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});await mkdir(output,{recursive:true})
  for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:1000}})
   if(cookie)await context.addCookies(cookie.split('; ').map(pair=>{const i=pair.indexOf('=');return{name:pair.slice(0,i),value:pair.slice(i+1),url:origin}}))
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
   for(const [name,path,expected]of screens??[['handover','/app/handover?person='+leaver,'Continuous control evidence'],['readiness','/app/programs/'+program,'Audit requests'],['board','/app/programs/'+program+'/board','Audit engagements']]){
    assert.equal((await page.goto(origin+path)).status(),200)
    await page.getByText(expected,{exact:false}).first().waitFor();if(expand)await page.locator('details').evaluateAll(elements=>elements.forEach(e=>e.open=true));await page.evaluate(()=>document.fonts.ready)
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' overflow at '+width)
    if(path.endsWith('/preview'))assert.equal(await page.locator('form').count(),0,'owner preview is read-only')
    const iconOnly=await page.locator('button,a,[role="button"]').evaluateAll(elements=>elements.filter(e=>e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})&&!e.innerText.trim()&&!e.querySelector('input')).map(e=>({label:e.getAttribute('aria-label'),tooltip:e.getAttribute('data-tooltip'),html:e.outerHTML.slice(0,100)})))
    assert.deepEqual(iconOnly,[],name+' has no icon-only controls requiring tooltips')
    if(decisionForm){
     const comment='Auditor browser review at '+width,form=page.locator('form').filter({has:page.getByRole('button',{name:'Record decision',exact:true})}).first()
     await form.getByRole('combobox').selectOption('flagged');await form.locator('[name=reason]').fill(comment)
     await form.getByRole('button',{name:'Record decision',exact:true}).click()
     await page.getByText(comment,{exact:false}).first().waitFor()
     assert.equal(new URL(page.url()).pathname.startsWith('/auditor/'),true,'decision returns to the auditor screen')
    }
    await page.screenshot({path:join(output,width+'-'+stage+'-'+name+'.png'),fullPage:true})
   }
   if(trustForms){
    const email='browser-'+width+'@customer.test'
    await page.goto(origin+'/trust');await page.getByRole('textbox',{name:'Email',exact:true}).fill(email)
    await page.getByRole('checkbox',{name:'Subprocessors',exact:true}).check()
    await page.getByRole('button',{name:'Send confirmation email',exact:true}).click()
    await page.getByRole('heading',{name:'Check your email',exact:true}).waitFor()
    await page.screenshot({path:join(output,width+'-subscription-requested.png'),fullPage:true})
    const message=app.messages.findLast(m=>m.to.includes(email));assert.ok(message,'browser subscription reaches the provider edge')
    const token=message.text.match(/\/trust\/confirm\/([a-f0-9]{64})/)[1]
    await page.goto(origin+'/trust/confirm/'+token);await page.getByRole('button',{name:'Confirm my subscription',exact:true}).click()
    await page.getByRole('heading',{name:'Subscription confirmed',exact:true}).waitFor()
    await page.screenshot({path:join(output,width+'-subscription-confirmed.png'),fullPage:true})
    const withdrawal=new URL(message.headers['List-Unsubscribe'].slice(1,-1)).pathname
    await page.goto(origin+withdrawal);await page.getByRole('heading',{name:'Unsubscribed',exact:true}).waitFor()
    await page.screenshot({path:join(output,width+'-subscription-unsubscribed.png'),fullPage:true})
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'subscription end states fit the viewport')
   }
   if(followLink){const name=typeof followLink==='object'?followLink.name:'Continuous control evidence',expected=typeof followLink==='object'?followLink.text:'Continuous control evidence',link=page.getByRole('link',{name,exact:true}).and(page.locator('a[href^="/api/audit-engagements/"]'));await link.focus();await page.keyboard.press('Enter');await page.waitForURL(/\/api\/audit-engagements\//);assert.ok((await page.locator('body').innerText()).includes(expected),'source drilldown retains review context');await page.screenshot({path:join(output,width+'-'+stage+'-source.png'),fullPage:true})}
   assert.deepEqual(errors,[]);await context.close()
  }
 }finally{await browser?.close();if(server)await new Promise(done=>server.close(done))}
}
