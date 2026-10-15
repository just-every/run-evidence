import { themeFrame } from '../../base/theme-frame'
import { escape } from '../view'
export { escape }
export const safeHeaders = { 'cache-control':'no-store', 'referrer-policy':'no-referrer', 'x-content-type-options':'nosniff', 'x-robots-tag':'noindex, nofollow' }
export const caveat = '<footer>A stored fingerprint proves the bytes did not change, not that a control operated or that the exhibit is true. Evidence does not certify your business or replace an auditor.</footer>'
export async function reviewFrame(title: string, body: string, owner=false) {
 const frame = await themeFrame({href:'/rer-theme.css',productName:'Evidence',accentColor:'#303a40'})
 // Native owner form POSTs need their Origin for the unchanged same-origin check.
 // Public review pages keep no-referrer so their bearer URLs stay private.
 return new Response(`<!doctype html><html lang="en"${frame.htmlClass}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} · Evidence</title>${frame.head}<link rel="stylesheet" href="/review.css">${owner?'<script src="/review.js" defer></script>':''}</head><body class="review-pages"><main>${owner?frame.brand+'<nav><a href="/app">Proof desk</a> <a href="/app/folders">Review folders</a> <a href="/app/archive">Yours</a> <a href="/app/import">Move in</a> <a href="/app/agent">Agent preparation</a></nav>':''}${body}${caveat}</main></body></html>`,{headers:{...safeHeaders,'referrer-policy':owner?'strict-origin':'no-referrer','content-type':'text/html; charset=utf-8','content-security-policy':`default-src 'none'; script-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'; ${frame.policy}`}})
}
