import type {Bindings} from '../../auth.server'
interface SourceAuthority {id:string;status:string;rotated_at:string|null;last_success_at:string|null}
// Current assurance must not survive withdrawn authority. Historical source
// facts and observations remain unchanged; this is a current-state fence.
export const sourceAuthorities=async(env:Bindings)=>(await env.DB.prepare('SELECT id,status,rotated_at,last_success_at FROM connections').all<SourceAuthority>()).results
export function sourceAuthorityGap(ref:string,authorities:SourceAuthority[]):string|null {
 const source=authorities.find(c=>ref===c.id||ref.endsWith(':'+c.id))
 if(!source)return null // Internal registers and explicitly reported sources are separate doors.
 if(source.status!=='active')return 'Source connection is '+source.status+'; a fresh authorized read is required'
 if(source.rotated_at&&(!source.last_success_at||source.last_success_at<source.rotated_at))return 'Source authority changed; no successful read under the renewed grant is recorded'
 return null
}
