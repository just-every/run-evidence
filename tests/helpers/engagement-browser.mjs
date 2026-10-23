import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {readFile,mkdir} from 'node:fs/promises'
import {resolve,extname,join} from 'node:path'
import {chromium} from 'playwright'
export async function engagementBrowser(app,{cookie,program,leaver,stage='open'}){
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
   await context.addCookies(cookie.split('; ').map(pair=>{const i=pair.indexOf('=');return{name:pair.slice(0,i),value:pair.slice(i+1),url:origin}}))
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
   for(const [name,path,expected]of [['handover','/app/handover?person='+leaver,'Continuous control evidence'],['readiness','/app/programs/'+program,'Audit requests'],['board','/app/programs/'+program+'/board','Audit engagements']]){
    assert.equal((await page.goto(origin+path)).status(),200)
    await page.getByRole('cell').filter({hasText:expected}).first().waitFor();await page.evaluate(()=>document.fonts.ready)
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' overflow at '+width)
    const iconOnly=await page.locator('button,a,[role="button"]').evaluateAll(elements=>elements.filter(e=>e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})&&!e.innerText.trim()&&!e.querySelector('input')).map(e=>({label:e.getAttribute('aria-label'),tooltip:e.getAttribute('data-tooltip'),html:e.outerHTML.slice(0,100)})))
    assert.deepEqual(iconOnly,[],name+' has no icon-only controls requiring tooltips')
    await page.screenshot({path:join(output,width+'-'+stage+'-'+name+'.png'),fullPage:true})
   }
   const link=page.getByRole('link',{name:'Continuous control evidence',exact:true});await link.focus();await page.keyboard.press('Enter');await page.waitForURL(/\/api\/audit-engagements\//);assert.match(await page.locator('body').innerText(),/Continuous control evidence/)
   assert.deepEqual(errors,[]);await context.close()
  }
 }finally{await browser?.close();if(server)await new Promise(done=>server.close(done))}
}
