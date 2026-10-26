import { done, json, ownerRoutes, readInput, uuid, type Route } from '../door'
import { page, escape } from '../view'
import { slab } from '../ui'
import { options, table } from '../program/view'
import { currentKey } from '../connect/custody'
import { custodyStatus, rotate } from './rotation'
import { callsFor, dataClasses, declare, disable, disclosures, enable, flows, purposes, rotateKey } from './flows'
import { classify, grantRead, publish, recordState, revokeRead, unpublish } from './records'
const id = `(${uuid})`
const both = (path: string) => new RegExp(`^/(?:app|api)${path}$`)
const hidden = (name: string, value: string) => `<input type="hidden" name="${name}" value="${escape(value)}">`

async function flowsPage(c: Parameters<Route['run']>[0]) {
 const [declared, calls, events, custody] = await Promise.all([flows(c.env), callsFor(c.env), disclosures(c.env), custodyStatus(c.env)])
 const data = { flows: declared.map(f => ({ ...f, data_classes: JSON.parse(f.data_classes) as string[] })), calls, disclosures: events, custody, purposes, data_classes: dataClasses }
 if (c.isApi) return json(data)
 const rows = declared.map(f => [escape(f.provider + ' · ' + f.model), escape(f.purpose), escape((JSON.parse(f.data_classes) as string[]).join(', ')), escape(f.retention + ' · ' + f.region + ' · ' + f.account), escape(f.status), f.status === 'enabled' ? `<form method="post" action="/app/connections/flows/${f.id}/disable" class="inline-form"><button type="submit">Disable</button></form>` : `<form method="post" action="/app/connections/flows/${f.id}/enable" class="inline-form">${hidden('declaration_sha256', f.declaration_sha256)}<button type="submit">Review and enable</button></form>`])
 const form = `<form method="post" action="/app/connections/flows"><label>Provider<select name="provider" aria-label="Provider">${options(['anthropic', 'openai'])}</select></label><label>Model<input name="model" required></label><label>Purpose<select name="purpose" aria-label="Purpose">${options([...purposes])}</select></label><fieldset><legend>Exact data classes sent</legend>${dataClasses.map(d => `<label class="check"><input type="checkbox" name="data_classes[]" value="${escape(d)}"> ${escape(d)}</label>`).join('')}</fieldset><label>Retention the provider states<input name="retention" required></label><label>Region<input name="region" required></label><label>Provider account<input name="account" required></label><label>Provider workspace (when the key is not scoped to one)<input name="workspace"></label><label>API key<input name="api_key" type="password" autocomplete="off" required></label><button type="submit">Declare flow</button></form>`
 const body = slab(`<section aria-labelledby="flows-title"><h2 id="flows-title">Declared outbound flows</h2><p class="panel-intro">A model provider receives data only through a flow declared here: its purpose, the exact data classes, retention, region and account. Each flow stays off until you review its exact declaration. Secrets and exhibit files are never sent.</p>${table(['Provider and model', 'Purpose', 'Data classes', 'Retention, region, account', 'State', ''], rows, 'Declared flows') || '<p>No flows declared.</p>'}${form}</section>`)
  + slab(`<section aria-labelledby="custody-title"><h2 id="custody-title">Key custody</h2><p class="panel-intro">Credentials are sealed under key <code>${escape(custody.current)}</code>. Present keys: ${escape(custody.present.join(', '))}.${custody.unavailable.length ? ` <strong role="alert">Sealed under an unavailable key: ${escape(custody.unavailable.join(', '))}. Restore that key or reconnect those credentials.</strong>` : ''}</p><form method="post" action="/app/connections/custody/rotate"><button type="submit">Re-seal credentials under ${escape(currentKey(c.env))}</button></form></section>`)
  + slab(`<section aria-labelledby="calls-title"><h2 id="calls-title">Outbound calls and suspected disclosures</h2>${table(['When', 'Purpose', 'Bytes', 'Result', 'Detail'], calls.slice(0, 20).map(x => [escape(x.at), escape(x.purpose), escape(x.bytes), escape(x.outcome), escape(x.detail)]), 'Outbound calls') || '<p>No calls yet.</p>'}${table(['When', 'Kind', 'Subject', 'Actor', 'Detail'], events.slice(0, 20).map(x => [escape(x.at), escape(x.kind), escape(x.subject), escape(x.actor), escape(x.detail)]), 'Suspected disclosures') || '<p>No suspected disclosures.</p>'}</section>`)
 return page('Declared flows', body, 200, { owner: c.actor.name, active: 'connections' })
}

// SECURE-001 owner doors: declared flows, key custody and restricted records. All owner-only.
export function secureHandler(clock: () => Date) {
 const routes: Route[] = [
  { method: 'GET', pattern: both('/connections/flows'), run: flowsPage },
  { method: 'POST', pattern: both('/connections/flows'), run: async c => done(c, '/app/connections/flows', await declare(c.env, c.actor, await readInput(c.request), c.now), 201) },
  { method: 'POST', pattern: both(`/connections/flows/${id}/enable`), run: async (c, m) => done(c, '/app/connections/flows', await enable(c.env, c.actor, m[1], await readInput(c.request), c.now)) },
  { method: 'POST', pattern: both(`/connections/flows/${id}/disable`), run: async (c, m) => done(c, '/app/connections/flows', await disable(c.env, c.actor, m[1], c.now)) },
  { method: 'POST', pattern: both(`/connections/flows/${id}/key`), run: async (c, m) => done(c, '/app/connections/flows', await rotateKey(c.env, c.actor, m[1], await readInput(c.request), c.now)) },
  { method: 'POST', pattern: both('/connections/custody/rotate'), run: async c => done(c, '/app/connections/flows', await rotate(c.env, c.actor, c.now)) },
  { method: 'GET', pattern: both(`/receipts/${id}/restricted`), run: async (c, m) => json(await recordState(c.env, m[1])) },
  { method: 'POST', pattern: both(`/receipts/${id}/classification`), run: async (c, m) => done(c, '/app/receipts/' + m[1], await classify(c.env, c.actor, m[1], await readInput(c.request), c.now)) },
  { method: 'POST', pattern: both(`/receipts/${id}/grants`), run: async (c, m) => done(c, '/app/receipts/' + m[1], await grantRead(c.env, c.actor, m[1], await readInput(c.request), c.now), 201) },
  { method: 'POST', pattern: both(`/receipts/${id}/grants/${id}/revoke`), run: async (c, m) => done(c, '/app/receipts/' + m[1], await revokeRead(c.env, c.actor, m[1], m[2], c.now)) },
  { method: 'POST', pattern: both(`/receipts/${id}/publication`), run: async (c, m) => done(c, '/app/receipts/' + m[1], await publish(c.env, c.actor, m[1], await readInput(c.request), c.now), 201) },
  { method: 'POST', pattern: both(`/receipts/${id}/publication/revoke`), run: async (c, m) => done(c, '/app/receipts/' + m[1], await unpublish(c.env, c.actor, m[1], c.now)) },
 ]
 return ownerRoutes(routes, clock)
}
