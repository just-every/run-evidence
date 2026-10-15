import { day } from '../model'
import type { controls, folders } from './storage'
import type { Folder, ReviewEvent } from './types'
import { escape, reviewFrame } from './frame'
export { reviewerPage, reviewReceiptPage } from './reviewer-view'
// Form above folder rows and one-time link confirmation follows the selected
// 12ui folders conversion, with the edition's existing Base typography.
export async function foldersPage(rows:Awaited<ReturnType<typeof folders>>, available:Awaited<ReturnType<typeof controls>>, now:Date) {
 const names=new Map(available.map(control=>[control.id,control.name]))
 const current=rows.map(folder=>{
  const state=folder.closed_at?'Closed':Date.parse(folder.expires_at)<=now.getTime()?'Expired':'Open'
  return `<article class="folder-row"><div><h3>${escape(folder.reviewer_label)}</h3><p>Controls: ${escape(folder.control_ids.map(id=>names.get(id)||'Unavailable control').join(', '))}</p><p>Covered period (UTC): ${escape(folder.period_from)} → ${escape(folder.period_to)}</p><p>Expiry (UTC): ${escape(folder.expires_at)}</p><span class="folder-status">${state}</span></div><div class="folder-actions">${state==='Open'?`<form method="post" action="/app/folders/${encodeURIComponent(folder.id)}/close"><button>Close folder</button></form>`:''}<a href="/app/folders/${encodeURIComponent(folder.id)}/events">View log</a></div></article>`
 }).join('')
 const today=day(now)
 return reviewFrame('Review folders',`<section><h1>Create a review folder</h1><p>Give a reviewer access to a narrow, read-only folder. Choose controls, set a covered period and an expiry.</p><form method="post" action="/app/folders"><label>Reviewer label<input name="reviewer_label" maxlength="300" required placeholder="Customer security review"></label><fieldset><legend>Controls</legend>${available.map(control=>`<label><input type="checkbox" name="control_ids" value="${escape(control.id)}"><span>${escape(control.name)} · ${escape(control.group_name)}</span></label>`).join('')||'<p>Add a control on the proof desk first.</p>'}</fieldset><div class="folder-dates"><label>Covered from (UTC)<input name="period_from" type="date" value="${today}" required></label><label>Covered through (UTC)<input name="period_to" type="date" value="${today}" required></label><label>Expiry date and time (UTC)<input name="expires_at" type="datetime-local" step="1" required></label></div><p class="folder-hint">Only receipts whose entire covered interval falls within these inclusive dates are shared. Closing a folder ends access immediately and cannot be undone. Create a new folder to reissue access.</p><button${available.length?'':' disabled'}>Create folder</button></form></section><section class="folder-current"><h2>Current review folders</h2><p>Manage open, expired and closed folders. Review links are shown only once when created.</p>${current||'<p>No review folders yet.</p>'}<p><a href="/app/folders/events">View all access events</a></p></section>`,true)
}
export async function issuedPage(folder:Folder,url:string) {
 return reviewFrame('Folder created',`<h1>Folder created</h1><section class="folder-once"><h2>${escape(folder.reviewer_label)}</h2><p>Copy this link now. It is shown only once; it cannot be recovered after leaving this page.</p><p>Covered period: ${escape(folder.period_from)} through ${escape(folder.period_to)} (UTC). Expires ${escape(folder.expires_at)}.</p><label>Reviewer link<input id="reviewer-link" class="folder-link" type="text" readonly autocomplete="off" value="${escape(url)}"></label><div class="folder-actions"><button type="button" data-copy-review>Copy link</button><a href="${escape(url)}" rel="noreferrer">Open reviewer folder</a></div><p id="copy-status" role="status"></p></section><p><a href="/app/folders">Return to review folders</a></p>`,true)
}
export async function logsPage(rows:ReviewEvent[]) {
 return reviewFrame('Folder access log',`<h1>Folder access log</h1><p>Allowed views and downloads, and refused attempts. Unknown grants have no folder association. Links and tokens are never recorded.</p>${rows.map(event=>`<article class="review-log"><h2>${escape(event.action)} · ${escape(event.outcome)}</h2><p>${escape(event.occurred_at)}</p><p>Folder: ${escape(event.folder_id||'Unknown')}</p><p>Exhibit: ${escape(event.exhibit_id||'None')}</p></article>`).join('')||'<p>No access events yet.</p>'}`,true)
}
