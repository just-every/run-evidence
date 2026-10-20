import { dateOnly, type Adapter } from './client'
import { json, id, metadata, requireId } from './rest'
// https://docs.gitlab.com/api/issues/ and /notes/
const name = 'GitLab Issues'
const root = (d: {api_base:string;project:string}) => `${d.api_base}/projects/${id(d.project)}`
export const gitlab: Adapter = {
 ...metadata(name, 'https://gitlab.com/api/v4', 'Project ID or path', 'A project access token with api scope', 'Read and write issues and notes for the selected project'),
 webhook: 'GitLab issue and comment webhooks (X-Gitlab-Token), with ten-minute polling fallback',
 defaultPriorities: { critical: 'priority::critical', high: 'priority::high', medium: 'priority::medium', low: 'priority::low' },
 fieldNotes: 'Priority is a scoped priority label; labels, assignee and due date use native issue fields.',
 async verify(base, key, _account, project) { const p = await json(`${base}/projects/${id(project)}`, key, name); return { account: p.namespace?.full_path ?? p.path_with_namespace, projectName: p.name } },
 async create(d, key, draft) {
  const i = await json(`${root(d)}/issues`, key, name, 'POST', { title: draft.title, description: draft.description, due_date: draft.due, labels: [...draft.labels, draft.priority].join(','), ...(draft.assignee ? { assignee_ids: [Number(draft.assignee)] } : {}) })
  return { id: requireId(i.iid, name), key: '#' + i.iid, url: i.web_url }
 },
 async read(d, key, t) {
  const url = `${root(d)}/issues/${id(t.remote_id)}`, i = await json(url, key, name)
  const comments = []; for (let page=1;;page++) { const notes = await json(`${url}/notes?per_page=100&page=${page}`, key, name); comments.push(...notes.filter((n:any)=>!n.system).map((n:any)=>({id:String(n.id),author:n.author.name,body:n.body,at:n.created_at}))); if(notes.length<100)break }
  return { status: i.state, closed: i.state === 'closed', assignee: i.assignees?.map((a:any)=>a.name).join(', ') || null, due: dateOnly(i.due_date), comments }
 },
 async comment(d,key,t,body) { return requireId((await json(`${root(d)}/issues/${id(t.remote_id)}/notes`,key,name,'POST',{body})).id,name) },
 async setDue(d,key,t,due) { await json(`${root(d)}/issues/${id(t.remote_id)}`,key,name,'PUT',{due_date:due}) },
 async reopen(d,key,t) { await json(`${root(d)}/issues/${id(t.remote_id)}`,key,name,'PUT',{state_event:'reopen'}) },
}
