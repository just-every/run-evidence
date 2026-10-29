// Test-owned native preparation: no SQL, substituted authority or provider.
export default async function ({ request, origin, cookie, phase }) {
 const post = async (path, body, form = false) => {
  const response = await request(new URL(path, origin).href, { method: 'POST', redirect: 'manual', headers: { origin, cookie, 'content-type': form ? 'application/x-www-form-urlencoded' : 'application/json' }, body: form ? new URLSearchParams(body) : JSON.stringify(body) })
  if (response.status !== (form ? 303 : 201)) throw new Error('Native fixture refused')
  return response
 }
 const now = new Date(), date = now.toISOString().slice(0, 10), expiry = new Date(now.getTime() + 86400000).toISOString()
 const credential = await (await post('/api/agent/tokens', { label: `Compliance agent ${phase}`, expires_at: expiry })).json()
 const clients = { local: { token: credential.token, clientId: credential.grant.id, agent: { id: credential.grant.id, name: credential.grant.label, specialist: 'Compliance operations lead' } } }
 if (phase === 'initial') return { clients }
 const created = await post('/app/controls', { name: `Production access review ${phase}`, group: 'Access', proof: 'Retain the named quarterly review', cadence: 'quarterly' }, true)
 const requirementId = created.headers.get('location').split('/').at(-1)
 await created.body?.cancel()
 const desk = await request(new URL('/api/desk', origin).href, { headers: { cookie } })
 if (!desk.ok) throw new Error('Native desk refused')
 const control = (await desk.json()).requirements.find(row => row.id === requirementId)
 if (!control) throw new Error('Created native control missing')
 return { clients, values: { folder: { reviewer_label: 'Morgan Lee — quarterly audit', period_from: date, period_to: date, expires_at: expiry, control_ids: [control.control_id] } } }
}
