import { themeFrame } from '../base/theme-frame'
import { fontHead } from '../base/font-head'
import { escape } from './ui'

// Auth APIs keep JSON; a browser refusal gets the same identity frame as sign-in.
// Never reflect a token, query string or arbitrary provider response into it.
export async function authFailurePage(request: Request, response: Response) {
 const browser = request.headers.get('sec-fetch-dest') === 'document' || request.headers.get('accept')?.split(',').some(range => /^text\/html(?:\s*;|$)/i.test(range.trim()) && !/;\s*q=0(?:\.0{0,3})?\s*(?:;|$)/i.test(range))
 if (response.status < 400 || !response.headers.get('content-type')?.includes('application/json') || !browser) return response
 const frame = await themeFrame({ href: '/rer-theme.css', productName: 'Evidence', accentColor: '#16181d' })
 const title = response.status === 401 ? 'Sign in required' : response.status === 403 ? 'Access unavailable' : response.status === 404 ? 'Page not found' : 'Could not complete sign-in'
 const message = response.status === 401 ? 'Sign in to continue to your own tasks.' : response.status === 403 ? 'This request does not have permission to continue. Return to sign-in or ask the owner to check your access.' : response.status === 404 ? 'This sign-in page is unavailable.' : 'This request could not be completed. The link may have expired or access may have changed. Return to sign-in to continue.'
 const headers = new Headers(response.headers)
 for (const name of ['content-length', 'content-encoding', 'set-cookie', 'location']) headers.delete(name)
 headers.set('content-type', 'text/html; charset=utf-8')
 headers.set('referrer-policy', 'no-referrer')
 headers.set('content-security-policy', `default-src 'none'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'; ${frame.policy}`)
 return new Response(request.method === 'HEAD' ? null : `<!doctype html><html lang="en"${frame.htmlClass}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} · Evidence</title>${fontHead}${frame.head}</head><body><main>${frame.brand}<h1>${escape(title)}</h1><p role="alert">${escape(message)}</p><p><a href="/signin?returnTo=%2Fme">Return to sign-in</a></p></main></body></html>`, { status: response.status, headers })
}
