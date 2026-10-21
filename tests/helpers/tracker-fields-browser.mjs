import assert from 'node:assert/strict'
import { configs } from './tracker-matrix.mjs'
// WORK-001: use the same owner forms as a person, including a stale edit and
// an explicit new decision. Network fakes supply provider responses only.
export async function trackerFieldsBrowser({page,app,edge,cookie,destination,ticket,ob,provider,width,capture}) {
 const write=configs[provider].write,host=new URL(page.url()).origin
 await page.goto(host+'/app/trackers/'+destination.id)
 await page.getByLabel('Assignees (one per line: person@example.com = tracker user id)').fill(`dana@northstar.test = ${write.assignee}\nlena@northstar.test = ${write.otherAssignee}`)
 await page.getByLabel('Tracker statuses (one per line: label = native tracker state id or value)').fill(`working = ${write.working}\ndone = ${write.done}\nopen = ${write.open}`)
 await Promise.all([page.waitForNavigation(),page.getByRole('button',{name:'Save mapping',exact:true}).click()])
 await capture(provider+'-field-mapping')
 await page.goto(host+'/app/remediation/'+ob.id)
 await page.getByRole('link',{name:'Edit tracker fields',exact:true}).click()
 await page.getByLabel('Tracker assignee',{exact:true}).selectOption('dana@northstar.test')
 await page.getByLabel('Tracker status',{exact:true}).selectOption('working')
 await page.getByLabel('Reason',{exact:true}).fill('Dana owns the production service remediation.')
 await capture(provider+'-field-editor')
 await Promise.all([page.waitForNavigation(),page.getByRole('button',{name:'Write tracker fields',exact:true}).click()])
 assert.equal(new URL(page.url()).pathname,'/app/remediation/'+ob.id)
 const detail=async()=>{const r=await app.fetch('/api/remediation/'+ob.id,{headers:{cookie}});assert.equal(r.status,200);return r.json()}
 assert.equal((await detail()).obligation.state,'open')
 assert.ok((await detail()).tickets[0].remote_assignee)
 await capture(provider+'-fields-written')
 await page.getByRole('link',{name:'Edit tracker fields',exact:true}).click()
 await page.getByLabel('Tracker assignee',{exact:true}).selectOption('dana@northstar.test')
 await page.getByLabel('Reason',{exact:true}).fill('Keep Dana after checking the source.')
 const remote=edge.find(provider,ticket.remote_id)
 remote.assignee='Lena Ortiz';remote.assigneeIds=[write.otherAssignee]
 await Promise.all([page.waitForNavigation(),page.getByRole('button',{name:'Write tracker fields',exact:true}).click()])
 assert.equal(await page.getByRole('alert').count(),1)
 assert.match(await page.locator('main').innerText(),/Tracker fields changed/)
 await capture(provider+'-field-conflict')
 await page.goto(host+'/app/remediation/'+ob.id)
 await page.getByText('Sync history',{exact:true}).click()
 assert.match(await page.locator('main').innerText(),/field conflict/)
 await capture(provider+'-field-conflict-history')
 await page.getByRole('link',{name:'Edit tracker fields',exact:true}).click()
 await page.getByLabel('Tracker assignee',{exact:true}).selectOption('lena@northstar.test')
 await page.getByLabel('Tracker status',{exact:true}).selectOption('done')
 await page.getByLabel('Reason',{exact:true}).fill('Keep the source assignee and request a source re-test.')
 await Promise.all([page.waitForNavigation(),page.getByRole('button',{name:'Write tracker fields',exact:true}).click()])
 const view=await detail()
 assert.equal(view.obligation.state,'awaiting verification')
 assert.ok(view.events.some(e=>e.kind==='closed in tracker'))
 await capture(provider+'-closed-awaiting-verification')
 console.log(`PASS WORK-001: ${provider} mapped assignee/status writes, conflict, fresh decision and unverified closure at ${width}`)
}
