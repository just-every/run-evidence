import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, writeFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { fixture } from '../fixtures/drata/fixture.mjs'
import { vantaZip } from '../fixtures/vanta/bundle.mjs'
import { secureframeZip } from '../fixtures/secureframe/bundle.mjs'

// Runs after the ordinary owner proof journey in the same disposable checkout.
export async function moveInAndPrepare(page, origin, width, capture, scratch, now = () => new Date()) {
 await page.goto(origin+'/app/import')
 await capture(page,`${width}-move-in`)
 await page.getByRole('link',{name:'Supported export shape'}).click()
 await capture(page,`${width}-import-shape`)
 await page.goto(origin+'/app/import')
 await page.getByLabel('Audit evidence ZIP').setInputFiles({name:'drata-audit.zip',mimeType:'application/zip',buffer:await fixture({deflate:width===390})})
 await page.getByRole('button',{name:'Check Drata ZIP and review'}).click()
 await page.waitForURL(/\/app\/import\/[a-f0-9-]+$/)
 for (const field of await page.locator('[name^="covered_from_"]').all()) await field.fill('2026-09-01')
 for (const field of await page.locator('[name^="covered_to_"]').all()) await field.fill('2026-09-30')
 await capture(page,`${width}-import-dry-run`)
 await page.getByRole('button',{name:'Save mapping for review'}).click()
 await page.getByRole('heading',{name:'Approve this import',exact:true}).waitFor()
 await capture(page,`${width}-import-mapping`)
 await page.getByRole('checkbox',{name:/I reviewed the saved controls mapping/}).check()
 await page.getByRole('button',{name:'Approve and import',exact:true}).click()
 await page.getByRole('heading',{name:'Durable import journal'}).waitFor()
 assert.match(await page.locator('main').innerText(),/completed/)
 await capture(page,`${width}-import-complete`)
 await page.getByRole('checkbox',{name:/Unlink this import/}).check()
 await page.getByRole('button',{name:'Undo imported additions',exact:true}).click()
 assert.match(await page.locator('main').innerText(),/undone/)
 await capture(page,`${width}-import-undone`)

 // Vanta and Secureframe: reconciliation per record class, owner identity decision, approval, records, undo.
 for (const [name,label,buffer] of [['Vanta','Vanta API pages ZIP',vantaZip()],['Secureframe','Secureframe API pages ZIP',secureframeZip()]]) {
  const key=name.toLowerCase()
  await page.goto(origin+'/app/import')
  await page.getByLabel(label).setInputFiles({name:key+'.zip',mimeType:'application/zip',buffer})
  await page.getByRole('button',{name:`Check ${name} ZIP and review`}).click()
  await page.waitForURL(/\/app\/import\/[a-f0-9-]+$/)
  await page.getByRole('heading',{name:'Reconciliation by record class'}).waitFor()
  assert.match(await page.locator('.import-reconciliation').innerText(),/Original exhibits/)
  await capture(page,`${width}-${key}-reconciliation`)
  await page.locator('select[name="decision_0"]').selectOption('same')
  await page.getByRole('button',{name:'Save review for approval'}).click()
  await page.getByRole('heading',{name:'Approve this import',exact:true}).waitFor()
  await page.getByRole('checkbox',{name:/I reviewed the reconciliation/}).check()
  await page.getByRole('button',{name:'Approve and import',exact:true}).click()
  await page.getByRole('heading',{name:'Durable import journal'}).waitFor()
  for (let i=0;i<5&&!/completed/.test(await page.locator('main').innerText());i++){await page.getByRole('button',{name:'Continue durable job'}).click();await page.getByRole('heading',{name:'Durable import journal'}).waitFor()}
  assert.match(await page.locator('main').innerText(),/completed/)
  await page.locator('.import-reconciliation').getByRole('link',{name:'People'}).click()
  await page.locator('.import-records').waitFor()
  assert.match(await page.locator('.import-records').innerText(),/Imported from /)
  await capture(page,`${width}-${key}-records`)
  await page.getByRole('checkbox',{name:/Unlink this import/}).check()
  await page.getByRole('button',{name:'Undo imported additions',exact:true}).click()
  assert.match(await page.locator('main').innerText(),/undone/)
  await capture(page,`${width}-${key}-undone`)
 }

 await page.goto(origin+'/app/agent')
 await page.getByLabel('Agent label').fill('Audit preparation assistant')
 const expires=new Date(now().getTime()+86400000).toISOString().slice(0,16)
 await page.getByLabel('Expiry (UTC)').fill(expires)
 await capture(page,`${width}-agent-access`)
 await page.getByRole('button',{name:'Grant prepare-only access'}).click()
 const token=await page.locator('[data-secret]').innerText()
 assert.match(token,/^[a-f0-9]{64}$/)
 await capture(page,`${width}-agent-token-masked`)
 const cli=async(command,extra=[])=>{
  const child=spawn(process.execPath,['scripts/evidence-agent.mjs',command,'--origin',origin,'--token-env','EVIDENCE_BROWSER_AGENT',...extra],{cwd:scratch,env:{...process.env,EVIDENCE_BROWSER_AGENT:token},stdio:['ignore','pipe','pipe']})
  let output='';child.stdout.on('data',c=>output+=c);child.stderr.resume()
  const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve)})
  assert.equal(code,0,'agent command succeeds');assert.ok(!output.includes(token),'CLI does not disclose credential')
  return JSON.parse(output)
 }
 const desk=await cli('desk'),today=now().toISOString().slice(0,10)
 const input=join(scratch,'.cache','folder-input.json')
 await mkdir(join(scratch,'.cache'),{recursive:true})
 await writeFile(input,JSON.stringify({reviewer_label:'Quarterly audit reviewer',period_from:today,period_to:today,expires_at:new Date(now().getTime()+3600000).toISOString(),control_ids:[desk.controls[0].id]}))
 const {proposal}=await cli('prepare-folder',['--input',input]);await unlink(input)
 assert.ok((await cli('proposals')).proposals.some(row=>row.id===proposal.id))
 await page.goto(origin+'/app/agent/proposals/'+proposal.id)
 await capture(page,`${width}-agent-proposal`)
 await page.getByRole('button',{name:'Approve exact proposal and create folder'}).click()
 await page.locator('input[readonly]').waitFor()
 await capture(page,`${width}-agent-folder-issued`)
 await page.goto(origin+'/app/agent/proposals/'+proposal.id)
 assert.equal(await page.getByRole('heading',{name:'approved',exact:true}).count(),1)
 await capture(page,`${width}-agent-approved`)
 await page.goto(origin+'/app/agent')
 for(const button of await page.getByRole('button',{name:'Revoke access',exact:true}).all()) { await button.click(); break }
 // LOG-001: the import, its undo and the agent approval are on the owner's audit.
 await page.goto(origin+'/app/audit')
 const audit=await (await page.request.get(origin+'/api/audit')).json()
 for(const action of ['import.commit','import.undo','agent.proposal-approved']) assert.ok(audit.entries.some(entry=>entry.action===action),action)
 await capture(page,`${width}-audit`)
}
