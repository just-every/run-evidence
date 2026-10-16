import { operatorAuth, runtimeBindings, type Bindings } from '../../auth.server'
import { Refusal } from '../upload'
import { readInput } from '../door'
import { headers, page, escape } from '../view'
import { slab, stateChip } from '../ui'
import { table } from '../program/view'
import { acknowledge } from '../attest/storage'
import { decide as decideAccess } from '../access/storage'
import { attempt } from '../training/storage'
import { course } from '../training/courses'
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
   const training = /^\/(?:api\/)?me\/training\/([a-z-]{3,40})(\/attempts)?$/.exec(url.pathname)
   if (training && training[2] && request.method === 'POST') { const result = await attempt(env, { id: person.id, email: session.operator.email }, training[1], await readInput(request), now); return isApi ? json(result, 201) : page(result.passed ? 'Passed' : 'Not passed yet', `<p role="status">You scored ${result.score}% (${result.correct} of ${result.total}). ${result.passed ? 'Your completion is recorded.' : 'Review the lessons and try again; every attempt is kept.'}</p><p><a href="/me">Back to my tasks</a></p>`) }
   if (training && request.method === 'GET') {
    const c = course(training[1]); if (!c || !await env.DB.prepare("SELECT 1 FROM training_assignments WHERE person_id=? AND course_id=?").bind(person.id, c.id).first()) return json({ error: 'Not found.' }, 404)
    if (isApi) return json({ id: c.id, title: c.title, revision: c.revision, lessons: c.lessons, quiz: c.quiz.map(q => ({ q: q.q, options: q.options })) })
    return page(c.title, slab(`<section aria-labelledby="course-title"><h2 id="course-title">${escape(c.title)}</h2>${c.lessons.map(l => `<h3>${escape(l.title)}</h3><p>${escape(l.text)}</p>`).join('')}<h3>Assessment</h3><form method="post" action="/me/training/${c.id}/attempts">${c.quiz.map((q, i) => `<fieldset><legend>${escape(`${i + 1}. ${q.q}`)}</legend>${q.options.map((o, j) => `<label class="check"><input type="radio" name="answers[${i}]" value="${j}" required> ${escape(o)}</label>`).join('')}</fieldset>`).join('')}<button>Submit answers</button></form></section>`))
   }
   const access = /^\/(?:api\/)?me\/access\/([a-f0-9-]{36})$/.exec(url.pathname)
   if (access && request.method === 'POST') { await decideAccess(env, { id: person.id, name: person.name, email: person.email }, access[1], await readInput(request), now); return isApi ? json({ decided: true }) : new Response(null, { status: 303, headers: { ...headers, location: '/me#access-title' } }) }
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
   // Access-review items this person decides as resource owner or delegate, in open campaigns.
   const reviews = (await env.DB.prepare("SELECT i.id,i.display_name,i.source_label,i.provenance,i.attributes_json,r.name AS review,r.due_date,(SELECT d.decision FROM access_decisions d WHERE d.item_id=i.id ORDER BY d.at DESC,d.rowid DESC LIMIT 1) AS decision FROM access_review_items i JOIN access_reviews r ON r.id=i.review_id LEFT JOIN access_delegations g ON g.item_id=i.id WHERE r.completed_at IS NULL AND COALESCE(g.to_person_id,i.reviewer_person_id)=? ORDER BY r.due_date,i.display_name").bind(person.id).all<{ id: string; display_name: string; source_label: string; provenance: string; attributes_json: string; review: string; due_date: string; decision: string | null }>()).results.map(i => ({ ...i, attributes: JSON.parse(i.attributes_json), attributes_json: undefined, own: String(JSON.parse(i.attributes_json).email ?? '').toLowerCase() === person.email.toLowerCase() }))
   const learning = (await env.DB.prepare("SELECT a.id,a.course_id,a.due_date,a.state,a.completed_at FROM training_assignments a WHERE a.person_id=? AND a.state!='departed' ORDER BY a.state='assigned' DESC,a.due_date").bind(person.id).all<{ id: string; course_id: string; due_date: string; state: string; completed_at: string | null }>()).results.map(t => ({ ...t, title: course(t.course_id)?.title ?? t.course_id, status: t.state === 'assigned' && t.due_date < today ? 'overdue' : t.state }))
   if (isApi) return json({ person: { name: person.name, email: person.email }, assignments: view, access: reviews, training: learning })
   const accessSlab = reviews.length ? slab(`<section aria-labelledby="access-title"><h2 id="access-title">Access to review</h2>${table(['Account', 'Source', 'Access', 'Due', 'Decision'], reviews.map(i => [escape(i.display_name), escape(i.source_label) + (i.provenance === 'manually-asserted' ? ' (manual list)' : ''), escape([i.attributes.roles ?? i.attributes.role, i.attributes.admin ? 'admin' : '', i.attributes.population].filter(Boolean).join(' · ') || '—'), escape(i.due_date), i.own ? 'Your own access: the review owner delegates it.' : i.decision ? stateChip(i.decision) : `<form method="post" action="/me/access/${i.id}"><select name="decision" aria-label="Decision for ${escape(i.display_name)}"><option value="retain">Retain</option><option value="revoke">Revoke</option><option value="change">Change</option></select><input name="reason" required maxlength="1000" aria-label="Reason for ${escape(i.display_name)}" placeholder="Reason"><button class="button-secondary">Decide</button></form>`]), 'Access to review')}</section>`) : ''
   const trainingSlab = learning.length ? slab(`<section aria-labelledby="training-title"><h2 id="training-title">Training</h2>${table(['Course', 'Status', 'Due'], learning.map(t => [t.state === 'assigned' ? `<a href="/me/training/${t.course_id}">${escape(t.title)}</a>` : escape(t.title), stateChip(t.status), escape(t.due_date)]), 'Training')}</section>`) : ''
   return page('My compliance tasks', accessSlab + trainingSlab + slab(`<section aria-labelledby="mine-title"><h2 id="mine-title">Policies to acknowledge</h2><p class="panel-intro">Signed in as ${escape(session.operator.email)}. Read each policy and accept the version shown; your acceptance records the exact text and time.</p>${table(['Policy', 'Status', 'Due', 'Acknowledged'], view.map(v => [`<a href="/me/assignments/${v.id}">${escape(`${v.title} (version ${v.version})`)}</a>`, stateChip(v.status), escape(v.due_date), escape(v.acknowledged_at ?? '—')]), 'Policies')}</section>`), 200)
  } catch (error) {
   if (!(error instanceof Refusal)) { console.error('Member door failed', error instanceof Error ? error.message : ''); return json({ error: 'Storage unavailable.' }, 503) }
   return isApi ? json({ error: error.message }, error.status) : page('Could not record', `<p role="alert">${escape(error.message)}</p><p><a href="/me">Back</a></p>`, error.status)
  }
 }
}
