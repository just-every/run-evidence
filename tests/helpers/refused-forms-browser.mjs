import assert from 'node:assert/strict'

// One-off queue proof, called by an authenticated browser journey at each width.
// The same probes run on the baseline and candidate; failures are collected so
// every refused door is attempted even when an earlier baseline probe fails.
export async function retainedFormsJourney(page, origin, width, capture, today) {
 const created = await page.request.post(origin + '/app/controls', { headers: { origin }, form: {
  name: `synthetic-evidence-${width} proof review`, group: 'Access', proof: 'Retained proof', cadence: 'daily',
 } })
 assert.equal(created.status(), 200)
 const requirementURL = created.url()
 assert.match(new URL(requirementURL).pathname, /^\/app\/requirements\/[a-f0-9-]+$/)
 await page.goto(requirementURL)
 const controlURL = await page.getByRole('link', { name: 'Control definition, mappings and additional requirements', exact: true }).getAttribute('href')
 const failures = []
 const probe = async (label, run) => {
  try { await run(); console.log(`PASS retained forms ${label} at ${width}`) }
  catch (error) { failures.push(new Error(`${label} at ${width}: ${error.message}`, { cause: error })) }
 }
 for (const [label, buffer, status] of [['empty', Buffer.alloc(0), 400], ['oversize', Buffer.alloc(11 * 1024 * 1024), 413]]) {
  await probe(`proof ${label}`, async () => {
   await page.goto(requirementURL)
   await page.getByLabel('Source', { exact: true }).fill('synthetic-evidence-1 retained source')
   await page.getByLabel('Sensitivity', { exact: true }).selectOption('sensitive')
   await page.getByLabel('Covered from (UTC)', { exact: true }).fill(today)
   await page.getByLabel('Covered through (UTC)', { exact: true }).fill(today)
   await page.locator('[name="effective_date"]').fill(today)
   await page.getByLabel('File', { exact: true }).setInputFiles({ name: `synthetic-evidence-${label}.txt`, mimeType: 'text/plain', buffer })
   const response = page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname.endsWith('/uploads'))
   await page.getByRole('button', { name: 'Store proof & issue receipt', exact: true }).click()
   assert.equal((await response).status(), status)
   await capture(page, `${width}-refused-proof-${label}`)
   assert.equal(await page.getByRole('heading', { name: 'Add proof', exact: true }).count(), 1, 'upload form remains beside its refusal')
   assert.equal(await page.getByLabel('Source', { exact: true }).inputValue(), 'synthetic-evidence-1 retained source')
   assert.equal(await page.getByLabel('Sensitivity', { exact: true }).inputValue(), 'sensitive')
   assert.equal(await page.getByLabel('Covered from (UTC)', { exact: true }).inputValue(), today)
   assert.equal(await page.getByLabel('Covered through (UTC)', { exact: true }).inputValue(), today)
   assert.equal(await page.locator('[name="effective_date"]').inputValue(), today)
   assert.equal(await page.getByLabel('File', { exact: true }).inputValue(), '')
   assert.match(await page.getByRole('alert').innerText(), /choose.*file.*again/i)
   assert.match(await page.locator('section[aria-labelledby="add-proof-title"]').innerText(), /10 MiB/)
  })
 }
 await probe('framework mapping', async () => {
  await page.goto(origin + controlURL)
  const form = page.locator(`form[action="${controlURL}/mappings"]`)
  await form.getByLabel('Framework', { exact: true }).selectOption('iso27001')
  await form.getByLabel('Edition', { exact: true }).fill('synthetic-evidence-1')
  await form.getByLabel('Requirement reference', { exact: true }).fill('A.5.18')
  await form.getByLabel('Reason', { exact: true }).fill('synthetic-evidence-2 mapping reason')
  const response = page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname === controlURL + '/mappings')
  await form.getByRole('button', { name: 'Add custom mapping', exact: true }).click()
  assert.equal((await response).status(), 400)
  await capture(page, `${width}-refused-framework-mapping`)
  assert.equal(await page.getByRole('heading', { name: 'Framework mappings', exact: true }).count(), 1, 'control page remains beside its refusal')
  assert.equal(await form.getByLabel('Framework', { exact: true }).inputValue(), 'iso27001')
  assert.equal(await form.getByLabel('Edition', { exact: true }).inputValue(), 'synthetic-evidence-1')
  assert.equal(await form.getByLabel('Requirement reference', { exact: true }).inputValue(), 'A.5.18')
  assert.equal(await form.getByLabel('Reason', { exact: true }).inputValue(), 'synthetic-evidence-2 mapping reason')
  assert.ok((await form.getByRole('alert').innerText()).length)
 })
 await probe('population mapping', async () => {
  await page.goto(origin + '/app/populations')
  await page.getByLabel('List', { exact: true }).selectOption('roster')
  await page.getByLabel('Source system', { exact: true }).fill('synthetic-evidence-3 roster source')
  await page.getByLabel('True as of', { exact: true }).fill(today)
  await page.getByLabel('Refresh window (days)', { exact: true }).fill('30')
  await page.getByText('Renamed columns', { exact: true }).click()
  await page.getByLabel('Column for name', { exact: true }).fill('Full Name')
  await page.getByLabel('File (CSV or XLSX)', { exact: true }).setInputFiles({ name: 'synthetic-evidence-3.csv', mimeType: 'text/csv', buffer: Buffer.from('Work Email,Full Name\r\nsynthetic-evidence-1@example.test,Synthetic Evidence\r\n') })
  const response = page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname === '/app/populations')
  await page.getByRole('button', { name: 'Check every row', exact: true }).click()
  assert.equal((await response).status(), 400)
  await capture(page, `${width}-refused-population-mapping`)
  assert.equal(await page.getByRole('heading', { name: 'Upload a population', exact: true }).count(), 1, 'population form remains beside its refusal')
  assert.equal(await page.getByLabel('List', { exact: true }).inputValue(), 'roster')
  assert.equal(await page.getByLabel('Source system', { exact: true }).inputValue(), 'synthetic-evidence-3 roster source')
  assert.equal(await page.getByLabel('True as of', { exact: true }).inputValue(), today)
  assert.equal(await page.getByLabel('Refresh window (days)', { exact: true }).inputValue(), '30')
  assert.equal(await page.getByLabel('Column for name', { exact: true }).inputValue(), 'Full Name')
  assert.equal(await page.getByLabel('File (CSV or XLSX)', { exact: true }).inputValue(), '')
  assert.match(await page.getByRole('alert').innerText(), /email/)
  assert.match(await page.getByRole('alert').innerText(), /choose.*file.*again/i)
 })
 if (failures.length) throw new AggregateError(failures, failures.map(error => error.message).join('\n'))
 return { requirementURL, controlURL }
}
