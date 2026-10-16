// AWS Signature Version 4 for read-only API calls, with Web Crypto only.
// https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_sigv-create-signed-request.html
export interface Credentials { accessKeyId: string; secretAccessKey: string; sessionToken?: string }
const encoder = new TextEncoder()
const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('')
export const sha256 = async (value: string) => hex(await crypto.subtle.digest('SHA-256', encoder.encode(value)))
async function hmac(key: ArrayBuffer | Uint8Array<ArrayBuffer>, value: string) { return crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), encoder.encode(value)) }
// RFC 3986 encoding as SigV4 requires (unreserved characters stay literal).
export const uriEncode = (value: string) => encodeURIComponent(value).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())
export async function sign(input: { method: string; url: URL; headers: Record<string, string>; body: string; region: string; service: string; credentials: Credentials; now: Date }) {
 const amzDate = input.now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''), day = amzDate.slice(0, 8)
 const payloadHash = await sha256(input.body)
 const headers: Record<string, string> = { ...Object.fromEntries(Object.entries(input.headers).map(([k, v]) => [k.toLowerCase(), v])), host: input.url.host, 'x-amz-date': amzDate }
 if (input.credentials.sessionToken) headers['x-amz-security-token'] = input.credentials.sessionToken
 if (input.service === 's3') headers['x-amz-content-sha256'] = payloadHash
 const names = Object.keys(headers).sort(), signedHeaders = names.join(';')
 const query = [...input.url.searchParams].map(([k, v]) => [uriEncode(k), uriEncode(v)]).sort(([a, x], [b, y]) => a < b ? -1 : a > b ? 1 : x < y ? -1 : x > y ? 1 : 0).map(([k, v]) => `${k}=${v}`).join('&')
 const path = input.service === 's3' ? input.url.pathname.split('/').map(s => uriEncode(decodeURIComponent(s))).join('/') : input.url.pathname.split('/').map(s => uriEncode(uriEncode(decodeURIComponent(s)))).join('/')
 const canonical = [input.method, path || '/', query, names.map(n => `${n}:${headers[n].trim().replace(/\s+/g, ' ')}\n`).join(''), signedHeaders, payloadHash].join('\n')
 const scope = `${day}/${input.region}/${input.service}/aws4_request`
 const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, await sha256(canonical)].join('\n')
 let key = await hmac(encoder.encode('AWS4' + input.credentials.secretAccessKey), day)
 for (const part of [input.region, input.service, 'aws4_request']) key = await hmac(key, part)
 const signature = hex(await hmac(key, toSign))
 return { ...headers, authorization: `AWS4-HMAC-SHA256 Credential=${input.credentials.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}` }
}
