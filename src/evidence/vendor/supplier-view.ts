import { escape, reviewFrame } from '../review/frame'
import { usDate } from '../format'
import type { Question } from './caiq'
export interface OpenRequest { id: string; kind: string; label: string; questions_json: string | null; due_date: string | null; submitted_at: string | null; received: number }
const note = '<p class="page-intro">This private link shows only the requests below and stops working at its expiry. What you send is kept as supplier-provided, unverified information until your customer reviews it.</p>'
export async function supplierPage(vendor: string, expires: string, token: string, requests: OpenRequest[]) {
 const rows = requests.map(r => {
  const done = r.kind === 'questionnaire' ? !!r.submitted_at : r.received > 0
  const action = r.kind === 'questionnaire' ? (r.submitted_at ? '<p>Submitted. Thank you.</p>' : `<p><a class="button-secondary" href="/supplier/${token}/requests/${r.id}">Answer the questionnaire</a></p>`)
   : `<form method="post" action="/supplier/${token}/requests/${r.id}/documents" enctype="multipart/form-data"><label>File (up to 10 MiB)<input type="file" name="file" required></label><label>Effective or report date<input type="date" name="effective_on"></label><label>Expires on<input type="date" name="expires_on"></label><button class="button-secondary">${r.received ? 'Send a newer version' : 'Send this document'}</button></form>`
  return `<section class="panel" aria-labelledby="r-${r.id}"><h2 id="r-${r.id}">${escape(r.label)}</h2><p>${done ? 'Received. ' : ''}${r.due_date ? 'Requested by ' + escape(usDate(r.due_date)) + '.' : ''}</p>${action}</section>`
 }).join('')
 return reviewFrame(`Security information for ${vendor}`, `<h1>Security information for ${escape(vendor)}</h1>${note}<p>Link expires ${escape(expires.slice(0, 10))} (UTC).</p>${rows || '<p>Nothing is open on this link.</p>'}`)
}
export async function questionnairePage(vendor: string, token: string, req: OpenRequest, questions: Question[], answers: Map<string, { answer: string; comment: string }>) {
 const domains = [...new Set(questions.map(q => q.domain))]
 const body = domains.map(d => `<fieldset><legend>${escape(d)}</legend>${questions.filter(q => q.domain === d).map(q => { const a = answers.get(q.id); return `<div class="question"><p><strong>${escape(q.id)}</strong> ${escape(q.text)}</p><div role="radiogroup" aria-label="Answer to ${escape(q.id)}">${(['yes', 'no', 'na'] as const).map(v => `<label><input type="radio" name="answer.${escape(q.id)}" value="${v}"${a?.answer === v ? ' checked' : ''}> ${v === 'na' ? 'Not applicable' : v === 'yes' ? 'Yes' : 'No'}</label>`).join(' ')}</div><label>Comment<input name="comment.${escape(q.id)}" maxlength="2000" value="${escape(a?.comment ?? '')}"></label></div>` }).join('')}</fieldset>`).join('')
 const form = req.submitted_at ? '<p>This questionnaire was submitted and can no longer be changed.</p>' : `<form method="post" action="/supplier/${token}/requests/${req.id}/answers">${body}<label>Your name<input name="respondent_name" maxlength="200" autocomplete="name"></label><label>Your email<input type="email" name="respondent_email" maxlength="254" autocomplete="email"></label><label><input type="checkbox" name="submit" value="yes"> Submit these answers as final (every question must be answered)</label><button>Save answers</button></form>`
 return reviewFrame(`${req.label} for ${vendor}`, `<h1>${escape(req.label)}</h1><p class="page-intro">For ${escape(vendor)}. Your answers are recorded per question as supplier-provided statements; they are not verified until your customer reviews evidence.</p><p><a href="/supplier/${token}">Back to the requests</a></p>${form}`)
}
