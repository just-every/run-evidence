import { call, dateOnly, TrackerFailure, type Adapter } from './client'
import { namedIds, requireId } from './rest'
// https://developers.asana.com/reference/createtask
// Resolve workspace tags and the project's Priority enum before creating a task.
const label = 'Asana'
const headers = (token: string) => ({ authorization: 'Bearer ' + token, accept: 'application/json', 'content-type': 'application/json' })
const data = <T>(reply: { body: Record<string, unknown> }) => {if(!reply.body||!Object.hasOwn(reply.body,'data')||reply.body.data==null)throw new TrackerFailure('unavailable',502,'Asana returned no data.');return reply.body.data as T}
export const asana: Adapter = {
 name: 'Asana', credential: 'An Asana personal access token (My settings → Apps → Developer apps)', permissions: 'Read the chosen project, its Priority custom field and workspace tags; create and update tasks and comments',
 projectLabel: 'Project GID', baseLabel: 'Asana API', defaultBase: 'https://app.asana.com/api/1.0',
 supportsDue: true, commentText: true, webhook: 'owner-registered Asana webhook (X-Hook-Signature), with ten-minute polling fallback',
 defaultPriorities: { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' },
 fieldNotes: 'Native tags resolve configured label names in the project workspace. Add a Priority enum custom field with the mapped option names. Missing or ambiguous native mappings are refused before task creation.',
 async verify(base, token, _account, project) {
  if (!/^\d{1,30}$/.test(project)) throw new TrackerFailure('invalid', 400, 'Give the Asana project GID (the number in the project URL).')
  const me = data<{ name: string; email?: string }>(await call(`${base}/users/me`, { headers: headers(token), label }))
  const found = data<{ name: string }>(await call(`${base}/projects/${project}?opt_fields=name`, { headers: headers(token), label }))
  return { account: me.email ?? me.name, projectName: found.name }
 },
 async create(d, token, draft) {
  type Project={workspace:{gid:string};custom_field_settings:{custom_field:{gid:string;name:string;resource_subtype:string;enum_options?:{gid:string;name:string;enabled:boolean}[]}}[]}
  const project=data<Project>(await call(`${d.api_base}/projects/${encodeURIComponent(d.project)}?opt_fields=workspace.gid,custom_field_settings.custom_field.gid,custom_field_settings.custom_field.name,custom_field_settings.custom_field.resource_subtype,custom_field_settings.custom_field.enum_options.gid,custom_field_settings.custom_field.enum_options.name,custom_field_settings.custom_field.enum_options.enabled`,{headers:headers(token),label}))
  if(!Array.isArray(project.custom_field_settings)||project.custom_field_settings.some(s=>!s?.custom_field||typeof s.custom_field.name!=='string'))throw new TrackerFailure('unavailable',502,'Asana project custom-field metadata is unavailable.')
  const fields=project.custom_field_settings.map(s=>s.custom_field).filter(f=>f.name.toLowerCase()==='priority'&&f.resource_subtype==='enum')
  if(fields.length!==1)throw new TrackerFailure('invalid',400,'Asana project needs exactly one Priority enum custom field.')
  const priority=fields[0]
  if(!Array.isArray(priority.enum_options)||priority.enum_options.some(o=>!o||typeof o.gid!=='string'||typeof o.name!=='string'||typeof o.enabled!=='boolean'))throw new TrackerFailure('unavailable',502,'Asana Priority option metadata is unavailable.')
  const options=priority.enum_options.filter(o=>o.name===draft.priority&&o.enabled)
  if(options.length!==1)throw new TrackerFailure('invalid',400,'Asana Priority must match exactly one enabled native option: '+draft.priority)
  const tags:{id:string;name:string}[]=[]
  if(draft.labels.length) {
   let offset:string|null=null
   for(;;) {
    const reply=(await call(`${d.api_base}/workspaces/${encodeURIComponent(requireId(project.workspace?.gid,label))}/tags?limit=100&opt_fields=gid,name${offset?'&offset='+encodeURIComponent(offset):''}`,{headers:headers(token),label})).body as unknown as {data:{gid:string;name:string}[];next_page:{offset:string}|null}
    if(!Array.isArray(reply?.data)||reply.data.some(t=>!t||typeof t.gid!=='string'||typeof t.name!=='string'))throw new TrackerFailure('unavailable',502,'Asana native tag metadata is unavailable.')
    tags.push(...reply.data.map(t=>({id:t.gid,name:t.name})))
    if(!reply.next_page)break
    const next=reply.next_page.offset
    if(!next||next===offset)throw new TrackerFailure('unavailable',502,'Asana tag pagination made no progress.')
    offset=next
   }
  }
  const body = { data: { name: draft.title, notes: draft.description, tags:namedIds(tags,draft.labels,label),custom_fields:{[requireId(priority.gid,label)]:requireId(options[0].gid,label)}, projects: [d.project], ...(draft.due ? { due_on: draft.due } : {}), ...(draft.assignee ? { assignee: draft.assignee } : {}) } }
  const created = data<{ gid: string; permalink_url?: string }>(await call(`${d.api_base}/tasks?opt_fields=gid,permalink_url`, { method: 'POST', headers: headers(token), body: JSON.stringify(body), label }))
  return { id: created.gid, key: created.gid, url: created.permalink_url ?? `https://app.asana.com/0/${d.project}/${created.gid}` }
 },
 async read(d, token, t) {
  const task = data<{ completed?: boolean; assignee?: { name?: string } | null; due_on?: string | null }>(await call(`${d.api_base}/tasks/${encodeURIComponent(t.remote_id)}?opt_fields=completed,assignee.name,due_on`, { headers: headers(token), label }))
  const stories = data<{ gid: string; resource_subtype?: string; text?: string; created_at: string; created_by?: { name?: string } | null }[]>(await call(`${d.api_base}/tasks/${encodeURIComponent(t.remote_id)}/stories?opt_fields=resource_subtype,text,created_at,created_by.name`, { headers: headers(token), label }))
  return { status: task.completed ? 'completed' : 'incomplete', closed: task.completed === true, assignee: task.assignee?.name ?? null, due: dateOnly(task.due_on), comments: stories.filter(s => s.resource_subtype === 'comment_added').map(s => ({ id: s.gid, author: s.created_by?.name ?? 'Asana user', body: String(s.text ?? ''), at: s.created_at })) }
 },
 async comment(d, token, t, body) { return data<{ gid: string }>(await call(`${d.api_base}/tasks/${encodeURIComponent(t.remote_id)}/stories`, { method: 'POST', headers: headers(token), body: JSON.stringify({ data: { text: body } }), label })).gid },
 async reopen(d, token, t) { await call(`${d.api_base}/tasks/${encodeURIComponent(t.remote_id)}`, { method: 'PUT', headers: headers(token), body: JSON.stringify({ data: { completed: false } }), label }) },
 async setDue(d, token, t, due) { await call(`${d.api_base}/tasks/${encodeURIComponent(t.remote_id)}`, { method: 'PUT', headers: headers(token), body: JSON.stringify({ data: { due_on: due } }), label }) },
}
