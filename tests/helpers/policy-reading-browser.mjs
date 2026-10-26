import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

// The caller owns the runtime and bridge; all writes use real public doors.
// Mail delivery is the runtime's existing network-edge fake.
export async function policyReadingJourney(app, bridge, ownerCookie) {
 const post = async (path, body) => {
  app.setCookie(ownerCookie)
  const response = await app.fetch(path, { method: 'POST', headers: { origin: app.origin, 'content-type': 'application/json' }, body: JSON.stringify(body) })
  assert.equal(response.status, 201, path)
  return response.json()
 }
 const program = await post('/api/programs', { framework: 'soc2', report_type:'Type II', name: 'Cedar Ridge assurance', legal_entity: 'Cedar Ridge Software', products: 'Cedar Ridge workspace', systems: 'Customer portal and production services', audit_from: '2026-07-01', audit_to: '2027-06-30' })
 for (const [width, name, email] of [[1440, 'Priya Shah', 'priya@cedar-ridge.test'], [390, 'Jess Tran', 'jess@cedar-ridge.test']]) {
  const owner = await bridge.context(width, ownerCookie), member = await bridge.context(width)
  const page = await owner.newPage(), reader = await member.newPage()
  const remoteRequests = []
  const observe = request => { if (request.url().startsWith('https://policy-images.invalid/')) remoteRequests.push(request.url()) }
  page.on('request', observe); reader.on('request', observe)
  try {
   await page.goto(bridge.origin + '/app/policies/builder?program=' + program.id)
   await page.locator('form[action="/app/policies/templates/access-control"]').getByRole('button').click()
   await page.locator('.policy-reading').waitFor()
   assert.equal(await page.locator('.policy-reading h2').filter({ hasText: /^Purpose$/ }).count(), 1)
   assert.ok(await page.locator('.policy-reading ol li').count() > 1)
   assert.doesNotMatch(await page.locator('.policy-reading').innerText(), /From the Evidence policy library|not legal advice/)
   assert.match(await page.locator('main').innerText(), /Review this draft for applicability/)
   await bridge.capture(page, 'policy-template-draft')

   const title = width === 1440 ? 'Remote working policy' : 'Flexible working policy'
   const body = `# ${title}\n\n## Purpose\n\nProtect customer information when working away from the office.\n\n## Responsibilities\n\n1. Use **approved devices** with disk encryption.\n2. Report lost equipment to the security lead.\n\n- Lock your screen when unattended.\n- Keep customer records out of shared spaces.\n\nUse the \`security-support\` channel for help.\n\n> Exceptions require written approval.\n\n[Read the policy register](/app/policies)\n\n[Unsafe example](javascript:alert%281%29)\n\n![Office illustration](https://policy-images.invalid/office.png)\n\n<span>Retained policy text</span>`
   await page.goto(bridge.origin + '/app/policies')
   const draft = page.locator('form[action="/app/policies"]')
   await draft.getByLabel('Policy', { exact: true }).fill(title)
   await draft.getByLabel('Text', { exact: true }).fill(body)
   await draft.getByRole('button', { name: 'Save draft revision' }).click()
   await page.locator('.policy-reading').waitFor()
   const revisionPath = new URL(page.url()).pathname
   const expectedDigest = createHash('sha256').update(body).digest('hex')
   assert.equal(await page.locator('input[name="body_sha256"]').inputValue(), expectedDigest)
   const checkReading = async target => {
    const article = target.locator('.policy-reading')
    assert.equal(await article.locator('ol li').count(), 2)
    assert.equal(await article.locator('ul li').count(), 2)
    assert.equal(await article.locator('strong').innerText(), 'approved devices')
    assert.equal(await article.locator('code').innerText(), 'security-support')
    assert.equal(await article.locator('blockquote').innerText(), 'Exceptions require written approval.')
    assert.match(await article.innerText(), /<span>Retained policy text<\/span>/)
    assert.equal(await article.locator('img,span,script').count(), 0)
    assert.equal(await article.getByRole('link', { name: 'Unsafe example' }).count(), 0)
    assert.equal(await article.getByRole('link', { name: 'Read the policy register' }).getAttribute('href'), '/app/policies')
    assert.deepEqual(remoteRequests, [], 'reading never fetches remote policy images')
   }
   await checkReading(page)
   await bridge.capture(page, 'owner-policy-reading')
   await page.getByRole('button', { name: 'Record decision on this exact text' }).click()
   await page.getByRole('button', { name: 'Publish this revision' }).click()
   await page.goto(bridge.origin + revisionPath)
   await page.locator('.policy-reading').waitFor()
   assert.doesNotMatch(await page.locator('main').innerText(), /Review this draft for applicability|not legal advice/)
   app.setCookie(ownerCookie)
   const stored = await (await app.fetch(revisionPath.replace('/app/', '/api/'))).json()
   assert.equal(stored.body, body); assert.equal(stored.body_sha256, expectedDigest); assert.equal(stored.approved_sha256, expectedDigest)

   const person = await post('/api/people', { name, email, kind: 'employee' })
   await page.goto(bridge.origin + '/app/people')
   await page.locator(`form[action="/app/people/${person.id}/invite"]`).getByRole('button').click()
   await page.getByRole('heading', { name: 'Invitation created', level: 1 }).waitFor()
   const mail = app.messages.filter(message => message.to?.includes(email)).at(-1)
   const token = new URL(mail.html.match(/href="([^"]*\/auth\/confirm\?token=[^"]+)"/)[1].replaceAll('&amp;', '&'), app.origin).searchParams.get('token')
   await page.goto(bridge.origin + '/app/attestations')
   const assignment = page.locator('form[action="/app/attestations/assign"]')
   await assignment.getByLabel('Policy', { exact: true }).selectOption(stored.policy_id)
   await assignment.getByLabel('Audience', { exact: true }).selectOption('selected')
   await assignment.getByLabel('Selected people', { exact: true }).selectOption(person.id)
   await assignment.getByLabel('Due date', { exact: true }).fill('2027-01-15')
   await assignment.getByRole('button', { name: 'Assign', exact: true }).click()
   await page.getByRole('heading', { name: 'Acknowledgments', exact: true }).waitFor()
   await reader.goto(bridge.origin + '/auth/confirm?token=' + token)
   await reader.locator('form').getByRole('button').click()
   await reader.waitForURL('**/me')
   await reader.getByRole('link', { name: `${title} (version ${stored.version})`, exact: true }).click()
   await checkReading(reader)
   assert.equal(await reader.locator('input[name="body_sha256"]').inputValue(), expectedDigest)
   assert.doesNotMatch(await reader.locator('main').innerText(), /Review this draft for applicability|not legal advice/)
   await bridge.capture(reader, 'member-policy-reading')
   await reader.getByRole('button', { name: `I have read and accept version ${stored.version}` }).click()
   await reader.waitForURL('**/me')
   app.setCookie(ownerCookie)
   const tracked = await (await app.fetch('/api/attestations')).json()
   const acknowledged = tracked.assignments.find(row => row.person_id === person.id && row.policy_id === stored.policy_id)
   assert.equal(acknowledged.status, 'acknowledged'); assert.equal(acknowledged.body_sha256, expectedDigest)
   console.log(`PASS owner and member policy reading, safe Markdown and exact acknowledgment at ${width}`)
  } finally { await member.close(); await owner.close(); app.setCookie(ownerCookie) }
 }
}
