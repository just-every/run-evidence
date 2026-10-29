import { errorCode } from '../src/modules/agent-door/conformance/protocol.mjs'
// Part of agent-surface.json's disposable production journey, not an auth fake.
export default async function ({ request, origin, cookie, tool }) {
 const check = (value, reason) => { if (!value) throw new Error(reason) }
 const owner = (path, body) => request(new URL(path, origin).href, { ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }), headers: { origin, cookie, 'content-type': 'application/json' }, redirect: 'manual' })
 const list = async () => (await (await owner('/api/agent')).json()).proposals
 const desk = await tool('evidence.desk.get', {})
 check(!desk.result?.isError && Array.isArray(desk.result?.structuredContent?.controls), 'Scoped Business metadata read failed')
 const control = desk.result.structuredContent.controls[0]
 check(control, 'Native preparation control missing')
 const now = new Date(), date = now.toISOString().slice(0, 10)
 const args = { reviewer_label: 'Morgan Lee quarterly audit', period_from: date, period_to: date, expires_at: new Date(now.getTime() + 86400000).toISOString(), control_ids: [control.id], idempotency_key: crypto.randomUUID() }
 const beforeBusiness = await list(), refused = await tool('evidence.folders.prepare', args)
 check(errorCode(refused) === 'native_credential_required' && JSON.stringify(await list()) === JSON.stringify(beforeBusiness), 'Business credential selected a native preparation grant')
 const missing = await tool('evidence.unsupported.execute', {})
 check(errorCode(missing) === 'tool_not_found', 'Unknown tool lacked its typed refusal')
 console.log('Evidence specialist journey: Business read, native-grant boundary and typed unknown-tool refusal passed.')
 const issued = await owner('/api/agent/tokens', { label: 'Morgan Compliance Agent', expires_at: args.expires_at })
 check(issued.status === 201, 'Native preparation credential was not granted')
 const credential = await issued.json()
 const prepare = (value, key = args.idempotency_key) => request(new URL('/api/agent/prepare-folder', origin).href, { method: 'POST', headers: { authorization: 'Bearer ' + credential.token, 'content-type': 'application/json', 'idempotency-key': key }, body: JSON.stringify(value) })
 const first = await prepare(args)
 check(first.status === 201, 'Native credential could not prepare')
 console.log('Evidence specialist journey: native preparation passed.')
 const original = await first.json(), count = (await list()).length
 const replay = await prepare(args)
 check(replay.status === 201 && (await replay.json()).proposal.id === original.proposal.id && (await list()).length === count, 'Native replay made another proposal')
 const conflict = await prepare({ ...args, reviewer_label: 'Different recipient label' })
 check(conflict.status === 409 && (await conflict.json()).code === 'idempotency_conflict' && (await list()).length === count, 'Changed replay arguments made an effect')
 const pause = await owner('/agents/api/pause', { paused: true })
 check(pause.ok, 'Native Pause failed')
 const paused = await prepare(args, crypto.randomUUID())
 check(paused.status === 409 && (await paused.json()).code === 'agents_paused' && (await list()).length === count, 'Native HTTP preparation bypassed Pause')
 check((await owner('/agents/api/pause', { paused: false })).ok, 'Native resume failed')
 const audit = await (await owner('/api/audit?action=agent.proposal-prepared')).json()
 check(audit.entries.some(row => row.subject === 'proposal:' + original.proposal.id && row.actor_name.startsWith('Morgan Compliance Agent for ')), 'Native activity lost agent/sponsor attribution')
 check((await owner('/api/agent/tokens/' + credential.grant.id + '/revoke', {})).ok, 'Native revocation failed')
 check((await prepare(args)).status === 401 && (await list()).length === count, 'Revoked credential returned a retained effect')
 console.log('Evidence specialist journey: scoped Business read; native-grant refusal; typed unknown tool; real local preparation, replay/conflict, Pause, attribution and revocation passed.')
}
