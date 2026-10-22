import { readPageStream, retainFields } from '../connect/pages'
import { call, DirectoryFailure, type Directory, type DirectoryAccount } from './directory'
// JumpCloud system users through the v1 API with a read-only administrator's
// API key. JumpCloud's user API exposes device administrator (sudo) rights but
// not console administrators, and no last sign-in time.
const label = 'JumpCloud'
const headers = (key: string, org: string) => ({ 'x-api-key': key, accept: 'application/json', ...(org ? { 'x-org-id': org } : {}) })
export const jumpcloud: Directory = {
 name: 'JumpCloud', credential: 'A JumpCloud API key of a Read Only administrator', permissions: ['Read Only administrator (system users)'],
 exposes: { mfa: true, groups: true, admin: 'device administrators (sudo); console administrators are not exposed', signIn: false, population: 'employeeType Contractor; others are people' },
 fields: [{ key: 'org_id', label: 'Organization ID (multi-tenant administrators only)', required: false, pattern: /^[0-9a-f]{24}$/ }],
 async verify(config, key) { await call('https://console.jumpcloud.com/api/systemusers?limit=1', { headers: headers(key, config.org_id ?? '') }, label); return { account: config.org_id || 'JumpCloud organization' } },
 async read(config, key) {
  const accounts: DirectoryAccount[] = []
  const users=await readPageStream<Record<string,unknown>>('jumpcloud:systemusers','0',async cursor=>{
   const skip=Number(cursor)
   if(skip>=10000)throw new DirectoryFailure('unavailable','JumpCloud user coverage incomplete: more than 10,000 users')
   const page=(await call(`https://console.jumpcloud.com/api/systemusers?limit=100&skip=${skip}`,{headers:headers(key,config.org_id??'')},label)).body as {totalCount:number;results:Record<string,unknown>[]}
   if(!page.results.length&&skip<page.totalCount)throw new DirectoryFailure('unavailable','JumpCloud pagination incomplete: empty page before total count')
   return {items:retainFields(page.results,['_id','email','firstname','lastname','username','sudo','enabled','mfa','configured','state','activated','suspended','employeeType','totp_enabled','created']),next:skip+page.results.length<page.totalCount?String(skip+page.results.length):null}
  },100,m=>new DirectoryFailure('unavailable','JumpCloud '+m))
   for (const u of users) {
    const mfa = u.mfa as { configured?: boolean } | undefined, sudo = (u.sudo as { enabled?: boolean } | undefined)?.enabled === true
    accounts.push({ id: String(u._id), email: String(u.email ?? ''), name: `${u.firstname ?? ''} ${u.lastname ?? ''}`.trim() || String(u.username), status: u.suspended === true || u.state === 'SUSPENDED' ? 'suspended' : u.state === 'STAGED' || u.activated === false ? 'staged' : 'active', population: /contract/i.test(String(u.employeeType ?? '')) ? 'contractor' : 'person', admin: sudo, roles: sudo ? ['Device administrator (sudo)'] : [], groups: null, mfa: typeof mfa?.configured === 'boolean' ? mfa.configured || u.totp_enabled === true : null, lastSignIn: null, created: typeof u.created === 'string' ? u.created : null })
   }
  const gaps:string[]=accounts.length>2000?['group membership not read beyond 2,000 accounts']:[]
  // User groups (v2 API): names once, then each user's memberships.
  try {
   const groups=await readPageStream<{id:string;name:string}>('jumpcloud:usergroups','0',async cursor=>{const page=Number(cursor);const rows=(await call('https://console.jumpcloud.com/api/v2/usergroups?limit=100'+(page?'&skip='+page*100:''),{headers:headers(key,config.org_id??'')},label)).body as unknown as {id:string;name:string}[];return {items:retainFields(rows,['id','name']),next:rows.length<100?null:String(page+1)}},20,m=>new DirectoryFailure('unavailable','JumpCloud '+m))
   const names=new Map(groups.map(g=>[g.id,g.name]))
   for (const a of accounts.slice(0, 2000)) a.groups = (await readPageStream<{id:string;type:string}>(`nested:jumpcloud-member:${a.id}`,'',async()=>({items:retainFields((await call(`https://console.jumpcloud.com/api/v2/users/${encodeURIComponent(a.id)}/memberof`,{headers:headers(key,config.org_id??'')},label)).body as unknown as {id:string;type:string}[],['id','type']),next:null}),1,m=>new DirectoryFailure('unavailable','JumpCloud '+m))).filter(m => m.type === 'user_group').map(m => names.get(m.id) ?? m.id)
  } catch (error) { if (!(error instanceof DirectoryFailure) || error.kind !== 'denied') throw error; for (const a of accounts) a.groups = null; gaps.push('user groups not readable') }
  return { accounts, complete: !gaps.length, gaps }
 },
}
