import { eventHistory, grantEvents } from './events'
import { collectionReport, collectionReportPage } from './report'
import { done, json, ownerRoutes, readInput, uuid, type Route } from '../door'
import { apiTokens, issueApiToken, revokeApiToken } from '../api/tokens'
import { saveCollectionSchedule } from './schedule'
import { runCollection } from './collect'
import { connectGithub, connections, repositories, requireConnection, revokeConnection, rotateCredential, runs, selectRepositories } from './storage'
import { connectionPage, connectionsPage } from './view'
import { connectAws } from '../cloud/connect'
import { connectDirectory, isDirectory } from '../identity/collect'
import { isScopedCloud, scopedClouds } from '../cloud/clouds'
import { connectScoped } from '../cloud/scoped'
import { connectKnowBe4 } from '../training/knowbe4'
const id = `(${uuid})`
const both = (path: string) => new RegExp(`^/(?:app|api)${path}$`)
// Connection listings never include ciphertext; tokens appear once at issue.
const safe = <T extends { secret_ciphertext?: unknown; secret_iv?: unknown; collector_token_hash?: unknown }>(row: T) => { const { secret_ciphertext: _c, secret_iv: _i, collector_token_hash: _h, ...rest } = row; return rest }
export function connectHandler(clock: () => Date) {
 const routes: Route[] = [
  { method: 'GET', pattern: both('/connections'), run: async c => { const rows = await connections(c.env), tokens = await apiTokens(c.env); return c.isApi ? json({ connections: rows.map(safe), api_tokens: tokens }) : connectionsPage(rows, tokens, null, c.actor.name) } },
  { method: 'POST', pattern: both('/connections'), run: async c => {
   const input = await readInput(c.request)
   if (typeof input.provider === 'string' && isDirectory(input.provider)) { const created = await connectDirectory(c.env, c.actor, input, c.now); return done(c, '/app/connections/' + created.id + '#runs-title', created, 201) }
   if (typeof input.provider === 'string' && isScopedCloud(input.provider)) { const created = await connectScoped(c.env, c.actor, input.provider, scopedClouds[input.provider], input, c.now); return done(c, '/app/connections/' + created.id + '#runs-title', created, 201) }
   if (input.provider === 'knowbe4') { const created = await connectKnowBe4(c.env, c.actor, input, c.now); return done(c, '/app/connections/' + created.id + '#runs-title', created, 201) }
   if (input.provider === 'aws') { const created = await connectAws(c.env, c.actor, input, c.now); return done(c, '/app/connections/' + created.id + '#runs-title', created, 201) }
   const created = await connectGithub(c.env, c.actor, input, c.now); return done(c, '/app/connections/' + created.id + '#repos-title', created, 201)
  } },
  { method: 'GET', pattern: both(`/connections/${id}`), run: async (c, m) => { const row = await requireConnection(c.env, m[1]), repos = await repositories(c.env, row.id), history = await runs(c.env, row.id); return c.isApi ? json({ connection: safe(row), repositories: repos, runs: history, source_events:await eventHistory(c.env,row.id) }) : connectionPage(row, repos, history, c.actor.name, await apiTokens(c.env), await eventHistory(c.env,row.id)) } },
  { method: 'GET', pattern: both(`/connections/${id}/report`), run: async (c, m) => { const report = await collectionReport(c.env, m[1], c.url.searchParams.get('from') ?? '', c.url.searchParams.get('to') ?? '', c.now); return c.isApi ? json(report) : collectionReportPage(report, c.actor.name) } },
  { method: 'POST', pattern: both(`/connections/${id}/repositories`), run: async (c, m) => { await selectRepositories(c.env, c.actor, m[1], await readInput(c.request), c.now); return done(c, '/app/connections/' + m[1], { saved: true }) } },
  { method: 'POST', pattern: both(`/connections/${id}/events/permissions`), run: async (c,m)=>done(c,'/app/connections/'+m[1]+'#source-events',await grantEvents(c.env,c.actor,m[1],await readInput(c.request),c.now)) },
  { method: 'POST', pattern: both(`/connections/${id}/schedule`), run: async (c, m) => done(c, '/app/connections/' + m[1] + '#schedule-title', await saveCollectionSchedule(c.env, c.actor, m[1], await readInput(c.request), c.now), 200) },
  { method: 'POST', pattern: both(`/connections/${id}/collect`), run: async (c, m) => done(c, '/app/connections/' + m[1] + '#runs-title', await runCollection(c.env, await requireConnection(c.env, m[1]), 'manual', c.now), 201) },
  { method: 'POST', pattern: both(`/connections/${id}/rotate`), run: async (c, m) => { await rotateCredential(c.env, c.actor, m[1], await readInput(c.request), c.now); return done(c, '/app/connections/' + m[1], { rotated: true }) } },
  { method: 'POST', pattern: both(`/connections/${id}/revoke`), run: async (c, m) => { await revokeConnection(c.env, c.actor, m[1], c.now); return done(c, '/app/connections/' + m[1], { revoked: true }) } },
  { method: 'POST', pattern: both('/api-tokens'), run: async c => {
   const issued = await issueApiToken(c.env, c.actor, await readInput(c.request), c.now)
   return c.isApi ? json(issued, 201) : connectionsPage(await connections(c.env), await apiTokens(c.env), { token: issued.token, name: issued.grant.name }, c.actor.name)
  } },
  { method: 'POST', pattern: both(`/api-tokens/${id}/revoke`), run: async (c, m) => { await revokeApiToken(c.env, c.actor, m[1], c.now); return done(c, '/app/connections#api-title', { revoked: true }) } },
 ]
 return ownerRoutes(routes, clock)
}
