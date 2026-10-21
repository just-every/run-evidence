// WORK-001 native mappings asserted on requests emitted by public ticket-create
// HTTP journeys. Call after the public door succeeds, using nativeFieldsFixture.
import assert from 'node:assert/strict'
const same=(actual,expected,field)=>assert.deepEqual([...actual].sort(),[...expected].sort(),field)
const tagsFrom=(calls,base)=>calls.filter(c=>c.url.origin===new URL(base).origin)
export function assertNativeFieldsCreate({provider,calls,base,priority,labels=['evidence','compliance']}) {
 const providerCalls=tagsFrom(calls,base),created=providerCalls.findLast(c=>c.method==='POST'&&(
  provider==='vector'&&c.url.pathname==='/api/v1/issues'||
  provider==='jira'&&c.url.pathname==='/rest/api/3/issue'||
  provider==='linear'&&c.body?.query?.includes('issueCreate(')||
  provider==='github'&&/\/issues$/.test(c.url.pathname)||
  provider==='asana'&&c.url.pathname.endsWith('/tasks')||
  provider==='gitlab'&&/\/issues$/.test(c.url.pathname)||
  provider==='azure-boards'&&c.url.pathname.includes('/workitems/$')||
  provider==='shortcut'&&c.url.pathname.endsWith('/stories')||
  provider==='clickup'&&/\/list\/[^/]+\/task$/.test(c.url.pathname)||
  provider==='monday'&&c.body?.query?.includes('create_item(')||
  provider==='basecamp'&&c.url.pathname.endsWith('/todos.json')||
  provider==='freshservice'&&c.url.pathname.endsWith('/tickets')||
  provider==='youtrack'&&c.url.pathname.endsWith('/issues')
 ))
 assert.ok(created,'public ticket-create did not write '+provider)
 const b=created.body
 if(provider==='jira'){assert.equal(b.fields.priority.name,priority);same(b.fields.labels,labels,'Jira labels')}
 if(provider==='github')same(b.labels,[...labels,priority],'GitHub native labels including priority')
 if(provider==='gitlab')same(b.labels.split(','),[...labels,priority],'GitLab native labels including priority')
 if(provider==='azure-boards'){
  const fields=Object.fromEntries(b.map(op=>[op.path.slice('/fields/'.length),op.value]))
  assert.equal(fields['Microsoft.VSTS.Common.Priority'],Number(priority));same(fields['System.Tags'].split('; '),labels,'Azure native tags')
 }
 if(provider==='clickup'){assert.equal(b.priority,Number(priority));same(b.tags,labels,'ClickUp native tags')}
 if(provider==='freshservice'){assert.equal(b.priority,Number(priority));same(b.tags,labels,'Freshservice native tags')}
 if(provider==='basecamp'){
  assert.match(b.description,new RegExp('Priority: '+priority))
  for(const label of labels)assert.ok(b.description.includes(label),'Basecamp explicit text label '+label)
  assert.equal(Object.hasOwn(b,'priority'),false,'Basecamp has no priority write field')
  assert.equal(Object.hasOwn(b,'labels'),false,'Basecamp has no labels write field')
 }
 if(provider==='vector'){
  const meta=providerCalls.findLast(c=>c.url.pathname==='/api/v1/metadata').response
  same(b.labelIds,labels.map(name=>meta.labels.find(l=>l.name===name).id),'Vector native label IDs');assert.equal(b.priority,priority)
 }
 if(provider==='linear'){
  const available=providerCalls.filter(c=>c.body?.query?.includes('issueLabels(')).flatMap(c=>c.response.data.issueLabels.nodes)
  same(b.variables.input.labelIds,labels.map(name=>available.find(l=>l.name===name).id),'Linear native label IDs');assert.equal(b.variables.input.priority,Number(priority))
 }
 if(provider==='asana'){
  const project=providerCalls.findLast(c=>c.url.pathname.includes('/projects/')&&c.url.searchParams.get('opt_fields')?.includes('custom_field_settings')).response.data
  const field=project.custom_field_settings.find(s=>s.custom_field.name==='Priority').custom_field
  assert.equal(b.data.custom_fields[field.gid],field.enum_options.find(o=>o.name===priority).gid)
  const available=providerCalls.filter(c=>/\/workspaces\/[^/]+\/tags$/.test(c.url.pathname)).flatMap(c=>c.response.data)
  same(b.data.tags,labels.map(name=>available.find(l=>l.name===name).gid),'Asana native tag IDs')
 }
 if(provider==='shortcut'){
  const field=providerCalls.findLast(c=>c.url.pathname.endsWith('/custom-fields')).response.find(f=>f.canonical_name==='priority'||f.name==='Priority')
  assert.deepEqual(b.custom_fields,[{field_id:field.id,value_id:field.values.find(v=>v.value===priority).id}]);same(b.labels.map(l=>l.name),labels,'Shortcut native labels')
 }
 if(provider==='monday'){
  const board=providerCalls.findLast(c=>c.body?.query?.includes('boards(')).response.data.boards[0]
  const columns=JSON.parse(b.variables.values),tagColumn=board.columns.find(c=>c.type==='tags'),priorityColumn=board.columns.find(c=>c.title==='Priority')
  const tags=providerCalls.filter(c=>c.body?.query?.includes('create_or_get_tag('))
  same(columns[tagColumn.id].tag_ids,labels.map(name=>Number(tags.findLast(t=>t.body.variables.name===name).response.data.create_or_get_tag.id)),'monday native tag IDs')
  assert.equal(columns[priorityColumn.id].label,priority)
 }
 if(provider==='youtrack'){
  const available=providerCalls.filter(c=>c.url.pathname.endsWith('/tags')).flatMap(c=>c.response)
  same(b.tags.map(t=>t.id),labels.map(name=>available.find(t=>t.name===name).id),'YouTrack native tag IDs')
  assert.equal(b.customFields.find(f=>f.name==='Priority').value.name,priority)
 }
}
