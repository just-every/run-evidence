// Native email-link flow through the production HTTP handler. Only the paid
// Resend edge is faked by the runtime; local dev no longer captures an outbox.
import assert from 'node:assert/strict'
import { runtime } from './helpers/runtime.mjs'
const app = await runtime()
try {
 const cookie = await app.signin()
 assert.ok(cookie)
 assert.equal(app.messages.length, 1)
 const session = await app.fetch('/auth/session')
 assert.equal(session.status, 200)
 assert.equal((await session.json()).operator.email, 'owner@example.test')
 const message = app.messages[0]
 const token = new URL(message.html.match(/href="([^"]*\/auth\/confirm\?token=[^"]+)"/)[1].replaceAll('&amp;','&'), app.origin).searchParams.get('token')
 const replay = await app.fetch('/auth/confirm', {method:'POST',headers:{origin:app.origin,'content-type':'application/json'},body:JSON.stringify({token})})
 assert.equal(replay.status, 400)
 assert.equal((await app.fetch('/__dev/outbox')).status,404)
 console.log('Email-link sign-in passed: native claim, provider request, confirmation, session and replay refusal')
} finally { await app.close() }

// Exercise the installation's Managed mail configuration at the provider edge.
const {test} = await import('node:test')
test('Hosted owner sign-in uses the assigned RER mail relay', async () => {
 const relay = 'https://mail.example.test/relay'
 const sent = []
 const hosted = await runtime({settings: {MAIL_PROVIDER: 'rer', MAIL_RELAY_URL: relay}, outbound: async request => {
  assert.equal(request.url, relay)
  assert.equal(request.method, 'POST')
  assert.ok(request.headers.get('authorization') === `Bearer ${hosted.harnessState().settings.MAIL_API_KEY}`, 'The relay receives this installation credential')
  sent.push(await request.json())
  return Response.json({messageId: '<synthetic-evidence-1@mail.example.test>'}, {status: 202})
 }})
 try {
  const post = (path, body) => hosted.fetch(path, {method: 'POST', headers: {origin: hosted.origin, 'content-type': 'application/json'}, body: JSON.stringify(body)})
  assert.equal((await post('/auth/bootstrap', {token: hosted.harnessState().settings.SETUP_TOKEN, displayName: 'Hosted owner'})).status, 303)
  assert.equal((await post('/auth/magic-link', {email: 'owner@example.test'})).status, 202)
  assert.equal(sent.length, 1)
  assert.equal(sent[0].to, 'owner@example.test')
  assert.equal(Object.hasOwn(sent[0], 'from'), false)
  assert.equal(Object.hasOwn(sent[0], 'installationId'), false)
  const token = new URL(sent[0].html.match(/href="([^"]*\/auth\/confirm\?token=[^"]+)"/)[1].replaceAll('&amp;', '&'), hosted.origin).searchParams.get('token')
  const confirmed = await post('/auth/confirm', {token})
  assert.equal(confirmed.status, 303)
  hosted.setCookie(confirmed.headers.getSetCookie().map(value => value.split(';')[0]).join('; '))
  const session = await hosted.fetch('/auth/session')
  assert.equal(session.status, 200)
  assert.equal((await session.json()).operator.email, 'owner@example.test')
 } finally {await hosted.close()}
})
