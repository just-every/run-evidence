import { createHash, generateKeyPairSync, createSign, createVerify, createPublicKey, randomBytes } from 'node:crypto'
// A fake OpenID Connect provider at the network edge only: discovery, keys, the
// authorization redirect and the token exchange. Everything Evidence does with
// its answer (state, PKCE, signature, claims, subject map, sessions) is real.
const b64 = value => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url')
// `paths` places the endpoints where a real provider keeps them (Google uses three origins).
export function fakeProvider({ issuer = 'https://okta.example.test', clientId = 'synthetic-evidence-client', clientSecret = 'synthetic-evidence-secret', paths = {}, clientPublicJwk = null } = {}) {
 const endpoint = { authorization: issuer + '/oauth2/v1/authorize', token: issuer + '/oauth2/v1/token', jwks: issuer + '/oauth2/v1/keys', ...paths }
 const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 }), kid = 'synthetic-evidence-key-1'
 const jwk = { ...publicKey.export({ format: 'jwk' }), kid, alg: 'RS256', use: 'sig' }
 const codes = new Map()
 const origins = new Set([issuer, ...Object.values(endpoint)].map(u => new URL(u).origin))
 const sign = claims => { const head = b64({ alg: 'RS256', kid, typ: 'JWT' }), body = b64(claims), signer = createSign('RSA-SHA256'); signer.update(head + '.' + body); return head + '.' + body + '.' + signer.sign(privateKey).toString('base64url') }
 return {
  issuer, clientId,
  // Answers the provider's own URLs; returns null for anything else.
  async outbound(request) {
   const url = new URL(request.url)
   if (!origins.has(url.origin)) return null
   if (url.pathname.endsWith('/.well-known/openid-configuration')) return Response.json({ issuer, authorization_endpoint: endpoint.authorization, token_endpoint: endpoint.token, jwks_uri: endpoint.jwks, id_token_signing_alg_values_supported: ['RS256'], token_endpoint_auth_methods_supported: ['client_secret_basic', 'private_key_jwt'], response_types_supported: ['code'], subject_types_supported: ['public'], code_challenge_methods_supported: ['S256'] })
   if (url.href.split('?')[0] === endpoint.jwks) return Response.json({ keys: [jwk] })
   if (url.href.split('?')[0] === endpoint.token) {
    const form = new URLSearchParams(await request.text()), basic = request.headers.get('authorization') ?? ''
    // A registered client key means the app proves itself with a signed assertion; otherwise the shared secret in a Basic header, with no client_id in the body, as Okta requires.
    if (clientPublicJwk) {
     const [head, body, sig] = (form.get('client_assertion') ?? '').split('.'), claims = body ? JSON.parse(Buffer.from(body, 'base64url').toString()) : {}
     const ok = form.get('client_assertion_type') === 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer' && sig && createVerify('RSA-SHA256').update(head + '.' + body).verify(createPublicKey({ key: clientPublicJwk, format: 'jwk' }), Buffer.from(sig, 'base64url')) && claims.iss === clientId && claims.sub === clientId && claims.aud === endpoint.token
     if (!ok) return Response.json({ error: 'invalid_client' }, { status: 401 })
    } else if (basic !== 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64')) return Response.json({ error: 'invalid_client' }, { status: 401 })
    const grant = codes.get(form.get('code') ?? ''); codes.delete(form.get('code') ?? '')
    if (!grant || createHash('sha256').update(form.get('code_verifier') ?? '').digest('base64url') !== grant.challenge) return Response.json({ error: 'invalid_grant' }, { status: 400 })
    const now = Math.floor(Date.now() / 1000)
    const claims = { iss: issuer, aud: clientId, sub: grant.sub, iat: now, exp: now + 300, nonce: grant.nonce, ...(grant.amr ? { amr: grant.amr } : {}), ...(grant.email ? { email: grant.email, email_verified: true } : {}), ...(grant.hd ? { hd: grant.hd } : {}) }
    return Response.json({ token_type: 'Bearer', access_token: randomBytes(16).toString('hex'), expires_in: 300, id_token: sign(claims) })
   }
   return new Response('not found', { status: 404 })
  },
  // The user authenticates at the provider: returns the callback path Evidence receives.
  authorize(location, { sub, amr, email, hd } = {}) {
   const url = new URL(location), code = randomBytes(16).toString('hex')
   codes.set(code, { sub, amr, email, hd, nonce: url.searchParams.get('nonce'), challenge: url.searchParams.get('code_challenge') })
   return { code, state: url.searchParams.get('state'), redirect: new URL(url.searchParams.get('redirect_uri')) }
  },
 }
}
