import assert from 'node:assert/strict'
export async function trustAvailabilityJourney(app,bridge,cookie) {
 app.setCookie(cookie)
 const request=await app.fetch('/api/trust/subprocessors',{method:'POST',headers:{origin:app.origin,'content-type':'application/json'},body:JSON.stringify({action:'add',name:'Cedar Ridge data warehouse',purpose:'Approved reporting',data_categories:'Customer contact information',location:'Australia',effective_on:'2026-11-30'})})
 assert.equal(request.status,201)
 const notice=await request.json()
 for(const width of [1440,390]) {
  const context=await bridge.context(width,cookie),page=await context.newPage()
  try {
   await page.goto(bridge.origin+'/app/trust')
   assert.ok(await page.getByRole('link',{name:'Open Settings to enable it',exact:true}).count())
   await page.getByRole('link',{name:'Open Settings to enable it',exact:true}).click()
   await page.locator('#trust-settings summary').click()
   await bridge.capture(page,'trust-settings-unavailable')
   await page.goto(bridge.origin+'/app/trust/updates/'+notice.update.id)
   assert.equal(await page.getByRole('button',{name:'Approve, publish and send notice',exact:true}).isDisabled(),true)
   assert.match(await page.getByRole('status').innerText(),/HTTPS/)
   await bridge.capture(page,'notice-needs-secure-address')
   console.log('PASS local trust prerequisites explained before approval at '+width)
  } finally {await context.close()}
 }
}
