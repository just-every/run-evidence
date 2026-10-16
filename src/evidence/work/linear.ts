import { call, dateOnly, TrackerFailure, type Adapter } from './client'
// Linear's GraphQL API with a personal API key (sent as the Authorization
// header, without a scheme). GraphQL errors are classified here: authentication, not found and invalid input stay distinct.
const label = 'Linear'
async function gql<T>(base: string, key: string, query: string, variables: Record<string, unknown>) {
 type Reply = { data?: T; errors?: { message?: string; extensions?: { type?: string; code?: string } }[] }
 let reply: Reply
 // Linear answers GraphQL errors, authentication included, with HTTP 200 or 400.
 try { reply = (await call(`${base}/graphql`, { method: 'POST', headers: { authorization: key, 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ query, variables }), label })).body as Reply }
 catch (error) { if (error instanceof TrackerFailure && error.kind === 'invalid' && Array.isArray((error.body as Reply | null)?.errors)) reply = error.body as Reply; else throw error }
 const error = reply.errors?.[0]
 if (error) {
  const kind = `${error.extensions?.type ?? ''} ${error.extensions?.code ?? ''} ${error.message ?? ''}`.toLowerCase()
  if (/authenticat|unauthori|forbidden/.test(kind)) throw new TrackerFailure('unauthorized', 401, 'Linear refused the API key; reconnect with a new one.')
  if (/not found|entity_not_found/.test(kind)) throw new TrackerFailure('not found', 404, 'Linear has no such issue.')
  if (/ratelimit|rate limit/.test(kind)) throw new TrackerFailure('throttled', 429, 'Linear is rate limiting this key.')
  throw new TrackerFailure('invalid', 400, 'Linear refused the request: ' + String(error.message ?? 'invalid input').slice(0, 300))
 }
 return reply.data as T
}
const issueFields = 'id identifier url dueDate state { name type } assignee { name } comments(first: 100) { nodes { id body createdAt user { name } } }'
type LinearIssue = { id: string; identifier: string; url: string; dueDate: string | null; state: { name: string; type: string }; assignee: { name: string } | null; comments: { nodes: { id: string; body: string; createdAt: string; user: { name: string } | null }[] } }
export const linear: Adapter = {
 name: 'Linear', credential: 'A Linear personal API key (Settings → Security & access → Personal API keys)', permissions: 'Read and Create issues and comments for the chosen team',
 projectLabel: 'Team ID', baseLabel: 'Linear API', defaultBase: 'https://api.linear.app',
 supportsDue: true, commentText: true, webhook: 'Linear webhook (Linear-Signature), Issues and Comments',
 defaultPriorities: { critical: '1', high: '2', medium: '3', low: '4' },
 async verify(base, key, _account, project) {
  const data = await gql<{ viewer: { name: string; organization: { name: string } }; team: { id: string; name: string } | null }>(base, key, 'query($team: String!) { viewer { name organization { name } } team(id: $team) { id name } }', { team: project })
  if (!data.team) throw new TrackerFailure('invalid', 400, 'That team is not visible to this Linear key.')
  return { account: `${data.viewer.organization.name} (${data.viewer.name})`, projectName: data.team.name }
 },
 async create(d, key, draft) {
  const input: Record<string, unknown> = { teamId: d.project, title: draft.title, description: draft.description, priority: Number(draft.priority) || 0 }
  if (draft.due) input.dueDate = draft.due
  if (draft.assignee) input.assigneeId = draft.assignee
  const data = await gql<{ issueCreate: { success: boolean; issue: { id: string; identifier: string; url: string } | null } }>(d.api_base, key, 'mutation($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id identifier url } } }', { input })
  if (!data.issueCreate.success || !data.issueCreate.issue) throw new TrackerFailure('invalid', 400, 'Linear did not create the issue.')
  return { id: data.issueCreate.issue.id, key: data.issueCreate.issue.identifier, url: data.issueCreate.issue.url }
 },
 async read(d, key, t) {
  const data = await gql<{ issue: LinearIssue | null }>(d.api_base, key, `query($id: String!) { issue(id: $id) { ${issueFields} } }`, { id: t.remote_id })
  if (!data.issue) throw new TrackerFailure('not found', 404, 'Linear has no such issue.')
  const i = data.issue
  return { status: `${i.state.name} (${i.state.type})`, closed: i.state.type === 'completed' || i.state.type === 'canceled', assignee: i.assignee?.name ?? null, due: dateOnly(i.dueDate), comments: i.comments.nodes.map(c => ({ id: c.id, author: c.user?.name ?? 'Linear', body: c.body, at: c.createdAt })) }
 },
 async comment(d, key, t, body) {
  const data = await gql<{ commentCreate: { success: boolean; comment: { id: string } | null } }>(d.api_base, key, 'mutation($input: CommentCreateInput!) { commentCreate(input: $input) { success comment { id } } }', { input: { issueId: t.remote_id, body } })
  if (!data.commentCreate.comment) throw new TrackerFailure('invalid', 400, 'Linear did not add the comment.')
  return data.commentCreate.comment.id
 },
 async setDue(d, key, t, due) { await gql(d.api_base, key, 'mutation($id: String!, $input: IssueUpdateInput!) { issueUpdate(id: $id, input: $input) { success } }', { id: t.remote_id, input: { dueDate: due } }) },
}
