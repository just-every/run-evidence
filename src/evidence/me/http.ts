import { operatorAuth, runtimeBindings, type Bindings } from '../../auth.server'
import { Refusal } from '../upload'
import { readInput } from '../door'
import { headers, page, escape } from '../view'
import { slab, stateChip } from '../ui'
import { table } from '../program/view'
import { acknowledge } from '../attest/storage'
// The employee and contractor door (ATTEST-001): a signed-in person sees only
// their own assignments and acknowledges the exact published text. It is
// matched to People by sign-in email; it opens no owner page or record.
const json = (data: unknown, status = 200) => Response.json(data, { status, headers })
export function memberHandler(clock: () => Date) {
 return async (request: Request, original: Bindings): Promise<Response | null> => {
  const url = new URL(request.url)
  if (!/^\/(?:api\/)?me(?:\/|$)/.test(url.pathname)) return null
  const env = runtimeBindings(original), isApi = url.pathname.startsWith('/api/')
  if (url.origin !== env.AUTH_ORIGIN || (request.headers.has('host') && request.headers.get('host')?.toLowerCase() !== url.host.toLowerCase())) return json({ error: 'Invalid host.' }, 403)
  if (request.headers.get('sec-fetch-site') === 'cross-site' || (request.headers.has('origin') && request.headers.get('origin') !== env.AUTH_ORIGIN) || (!['GET', 'HEAD'].includes(request.method) && request.headers.get('origin') !== env.AUTH_ORIGIN)) return json({ error: 'Same-origin request required.' }, 403)
  const session = await operatorAuth(env).getSession(request)
  if (!session) return isApi ? json({ error: 'Sign-in required.' }, 401) : page('Sign in', '<p><a href="/signin?returnTo=%2Fme">Sign in to see your compliance tasks</a></p>', 401)
  const person = await env.DB.prepare('SELECT p.id,p.name,p.email,(SELECT departed_at FROM people_departures d WHERE d.person_id=p.id) AS departed_at FROM people p WHERE p.email=?').bind(session.operator.email.toLowerCase()).first<{ id: string; name: string; email: string; departed_at: string | null }>()
  if (!person || person.departed_at) return isApi ? json({ error: 'No compliance tasks for this account.' }, 403) : page('No tasks', '<p>Your sign-in is not linked to a person in Evidence, or your access has ended.</p>', 403)
  const now = clock()
  try {
   const ack = /^\/(?:api\/)?me\/assignments\/([a-f0-9-]{36})(\/acknowledge)?$/.exec(url.pathname)
   if (ack && ack[2] && request.method === 'POST') { await acknowledge(env, { id: session.operator.id, email: session.operator.email, displayName: session.operator.displayName }, person.id, ack[1], await readInput(request), now); return isApi ? json({ acknowledged: true }) : new Response(null, { status: 303, headers: { ...headers, location: '/me' } }) }
   if (!['GET', 'HEAD'].includes(request.method)) return json({ error: 'Method not allowed.' }, 405)
   const today = now.toISOString().slice(0, 10)
   const rows = (await env.DB.prepare("SELECT a.id,a.state,a.due_date,po.title,r.version,r.body,r.body_sha256,r.effective_date,k.acknowledged_at FROM policy_assignments a JOIN policies po ON po.id=a.policy_id JOIN policy_revisions r ON r.id=a.revision_id LEFT JOIN policy_acknowledgments k ON k.assignment_id=a.id WHERE a.person_id=? ORDER BY a.state='pending' DESC,a.due_date,po.title").bind(person.id).all<{ id: string; state: string; due_date: string; title: string; version: number; body: string; body_sha256: string; effective_date: string | null; acknowledged_at: string | null }>()).results
   if (ack) {
    const one = rows.find(r => r.id === ack[1]); if (!one) return json({ error: 'Not found.' }, 404)
    if (isApi) return json(one)
    return page(`${one.title}, version ${one.version}`, slab(`<section aria-labelledby="policy-text"><h2 id="policy-text">${escape(one.title)} · version ${one.version}</h2><p>Effective ${escape(one.effective_date ?? '')}. Text fingerprint <code>${one.body_sha256.slice(0, 16)}…</code></p><pre>${escape(one.body)}</pre>${one.state === 'pending' ? `<form method="post" action="/me/assignments/${one.id}/acknowledge"><input type="hidden" name="body_sha256" value="${one.body_sha256}"><button>I have read and accept version ${one.version}</button></form>` : `<p>${stateChip(one.state)} ${escape(one.acknowledged_at ?? '')}</p>`}<p><a href="/me">Back to my tasks</a></p></section>`), 200)
   }
   const view = rows.map(r => ({ id: r.id, title: r.title, version: r.version, due_date: r.due_date, status: r.state === 'pending' && r.due_date < today ? 'overdue' : r.state, acknowledged_at: r.acknowledged_at }))
   if (isApi) return json({ person: { name: person.name, email: person.email }, assignments: view })
   return page('My compliance tasks', slab(`<section aria-labelledby="mine-title"><h2 id="mine-title">Policies to acknowledge</h2><p class="panel-intro">Signed in as ${escape(session.operator.email)}. Read each policy and accept the version shown; your acceptance records the exact text and time.</p>${table(['Policy', 'Status', 'Due', 'Acknowledged'], view.map(v => [`<a href="/me/assignments/${v.id}">${escape(`${v.title} (version ${v.version})`)}</a>`, stateChip(v.status), escape(v.due_date), escape(v.acknowledged_at ?? '—')]), 'Policies')}</section>`), 200)
  } catch (error) {
   if (!(error instanceof Refusal)) { console.error('Member door failed', error instanceof Error ? error.message : ''); return json({ error: 'Storage unavailable.' }, 503) }
   return isApi ? json({ error: error.message }, error.status) : page('Could not record', `<p role="alert">${escape(error.message)}</p><p><a href="/me">Back</a></p>`, error.status)
  }
 }
}
