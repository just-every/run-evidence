import { themeFrame } from '../../base/theme-frame'
import { page } from '../view'
import { escape } from '../ui'
export { escape } from '../ui'
export const safeHeaders = { 'cache-control':'no-store', 'referrer-policy':'no-referrer', 'x-content-type-options':'nosniff', 'x-robots-tag':'noindex, nofollow' }
export const caveat = '<footer class="app-caveat">A stored fingerprint proves the bytes did not change, not that a control operated or that the exhibit is true. Evidence does not certify your business or replace an auditor.</footer>'
export async function reviewFrame(title: string, body: string, owner = false, ownerName?: string) {
 // Owner form POSTs retain their Origin for the unchanged same-origin check.
 // Bearer-link pages send no referrer and never render owner navigation.
 if (owner) return page(title, body, 200, {
  active: title === 'Agent preparation' || title === 'Agent access granted' || title === 'Review folder proposal' ? 'agent' : 'folders',
  owner: ownerName, heading: false, className: 'review-pages', styles: ['/review.css'], scripts: ['/review.js'],
 })
 const frame = await themeFrame({href:'/rer-theme.css',productName:'Evidence',accentColor:'#16181d'})
 return new Response(`<!doctype html><html lang="en"${frame.htmlClass}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} · Evidence</title>${frame.head}<link rel="stylesheet" href="/desk.css"><link rel="stylesheet" href="/review.css"></head><body class="review-pages public-review"><header class="reviewer-header"><a class="app-brand" href="/"><span class="evidence-mark" aria-hidden="true"></span><span>Evidence</span></a></header><main class="public-review-main">${body}${caveat}</main></body></html>`, {headers:{...safeHeaders,'content-type':'text/html; charset=utf-8','content-security-policy':`default-src 'none'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'; ${frame.policy}`}})
}
