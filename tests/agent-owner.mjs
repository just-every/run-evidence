// Disposable verification drives the same setup-token lifecycle as installation.
export default async function ({ request, origin, claim, displayName }) {
 const claimed = await request(new URL(claim.path, origin).href, { method: 'POST', redirect: 'manual', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ token: claim.token, displayName, returnTo: '/setup' }) })
 if (claimed.status !== 303) { console.error('Evidence conformance bootstrap HTTP ' + claimed.status); throw new Error('Native bootstrap refused') }
 const cookie = claimed.headers.getSetCookie().map(value => value.split(';', 1)[0]).join('; ')
 const setup = await request(new URL('/setup', origin).href, { method: 'POST', redirect: 'manual', headers: { origin, cookie, 'content-type': 'application/x-www-form-urlencoded' }, body: 'confirm=yes' })
 await setup.body?.cancel()
 if (setup.status !== 303) { console.error('Evidence conformance setup HTTP ' + setup.status); throw new Error('Native setup confirmation refused') }
 return claimed
}
