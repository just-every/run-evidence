import { done, json, ownerRoutes, readInput, uuid, type Route } from '../door'
import { apiTokens, issueApiToken, revokeApiToken } from '../api/tokens'
import { runCollection } from './collect'
import { connectGithub, connections, repositories, requireConnection, revokeConnection, rotateCredential, runs, selectRepositories } from './storage'
import { connectionPage, connectionsPage } from './view'
const id = `(${uuid})`
const both = (path: string) => new RegExp(`^/(?:app|api)${path}$`)
// Connection listings never include ciphertext; tokens appear once at issue.
const safe = <T extends { secret_ciphertext?: unknown; secret_iv?: unknown }>(row: T) => { const { secret_ciphertext: _c, secret_iv: _i, ...rest } = row; return rest }
export function connectHandler(clock: () => Date) {
 const routes: Route[] = [
  { method: 'GET', pattern: both('/connections'), run: async c => { const rows = await connections(c.env), tokens = await apiTokens(c.env); return c.isApi ? json({ connections: rows.map(safe), api_tokens: tokens }) : connectionsPage(rows, tokens, null, c.actor.name) } },
  { method: 'POST', pattern: both('/connections'), run: async c => { const created = await connectGithub(c.env, c.actor, await readInput(c.request), c.now); return done(c, '/app/connections/' + created.id + '#repos-title', created, 201) } },
  { method: 'GET', pattern: both(`/connections/${id}`), run: async (c, m) => { const row = await requireConnection(c.env, m[1]), repos = await repositories(c.env, row.id), history = await runs(c.env, row.id); return c.isApi ? json({ connection: safe(row), repositories: repos, runs: history }) : connectionPage(row, repos, history, c.actor.name) } },
  { method: 'POST', pattern: both(`/connections/${id}/repositories`), run: async (c, m) => { await selectRepositories(c.env, c.actor, m[1], await readInput(c.request), c.now); return done(c, '/app/connections/' + m[1], { saved: true }) } },
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
