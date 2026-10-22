import assert from 'node:assert/strict'
import { join } from 'node:path'
import { writeFile } from 'node:fs/promises'
import { sanitize } from './review-browser-runtime.mjs'
// Caller supplies separate real RER development sessions (already signed in)
// and owns their processes. No browser or server is started by this helper.
export async function portableBrowserJourney({sourcePage,targetPage,artifacts,width=1440,archiveBytes,journalBytes,capture,expectJournalRefusal=()=>{}}) {

 // Existing seeded programs may be supplied by the caller. This helper's
 // direct browser actions exercise only the archive interface and endpoints.
 await targetPage.setViewportSize({width,height:1000})
 const snap=async(page,name)=>capture?capture(page,name):page.screenshot({path:join(artifacts,name+'.png'),fullPage:true})
 const expectStatus=async expected=>{
  await targetPage.waitForFunction(expected=>{const text=document.querySelector('#archive-status')?.textContent??'';return text.includes(expected)||(text&&!document.querySelector('#archive-file')?.disabled)},expected,{timeout:120000})
  const actual=await targetPage.locator('#archive-status').innerText()
  assert.ok(actual.includes(expected),`Archive expected ${expected}; got ${sanitize(actual)}`)
 }
 const archivePath=join(artifacts,`portable-${width}.evidence`),journalPath=join(artifacts,`portable-${width}-journal.json`)
 if(sourcePage){
  await sourcePage.setViewportSize({width,height:1000})
  await sourcePage.goto(new URL('/app/archive',sourcePage.url()).href)
  const archive=await sourcePage.context().request.get(new URL('/api/archive/export',sourcePage.url()).href);assert.equal(archive.status(),200)
  const journal=await sourcePage.context().request.get(new URL('/api/archive/journal',sourcePage.url()).href);assert.equal(journal.status(),200)
  archiveBytes=await archive.body();journalBytes=await journal.body()
  await snap(sourcePage,`portable-export-${width}`)
 }
 assert.ok(archiveBytes&&journalBytes,'Supply sourcePage or captured source archive and journal bytes')
 await writeFile(archivePath,archiveBytes);await writeFile(journalPath,journalBytes)
 await targetPage.goto(new URL('/app/archive',targetPage.url()).href)
 await targetPage.locator('#archive-file').setInputFiles(archivePath)
 await targetPage.locator('#archive-dry-run').click()
 await expectStatus('Dry run passed')
 assert.equal(await targetPage.locator('#archive-confirm').isDisabled(),true)
 await snap(targetPage,`portable-unverified-${width}`)
 const invalidJournal=join(artifacts,`portable-invalid-journal-${width}.json`);await writeFile(invalidJournal,JSON.stringify({format:'invalid'}))
 expectJournalRefusal(true)
 await targetPage.locator('#archive-journal').setInputFiles(invalidJournal)
 await targetPage.locator('#archive-dry-run').click()
 await expectStatus('Invalid source erasure journal')
 await snap(targetPage,`portable-refused-${width}`)
 expectJournalRefusal(false)
 await targetPage.locator('#archive-journal').setInputFiles(journalPath)
 await targetPage.locator('#archive-dry-run').click()
 await expectStatus('Ready for confirmation')
 await snap(targetPage,`portable-dry-run-${width}`)
 await targetPage.locator('#archive-confirm').click()
 await expectStatus('Restore complete')
 assert.ok((await targetPage.locator('#archive-status').innerText()).startsWith('Restore complete'))
 await snap(targetPage,`portable-restored-${width}`)
 await targetPage.locator('#archive-capability').selectOption('schedules')
 await targetPage.locator('#archive-reauthorize-form button').click()
 await targetPage.waitForFunction(()=>document.querySelector('#archive-reauthorize-status')?.textContent?.includes('Reauthorized schedules'))
 await snap(targetPage,`portable-reauthorized-${width}`)
 assert.match(await targetPage.locator('#archive-capabilities').innerText(),/mail.*inactive after restore/)
 return {clause:'PORTABLE-001',archivePath,journalPath,width}
}
