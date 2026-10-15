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
