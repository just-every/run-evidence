// Source clocks retain their original precision/offset. Compare instants up to
// nanoseconds rather than rounding two distinct events to one millisecond.
export function sourceInstant(value:unknown):bigint|null{
 if(typeof value!=='string')return null
 const m=/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(?:\.(\d{1,9}))?(Z|[+-]\d\d:\d\d)$/.exec(value)
 if(!m||+m[4]>23||+m[5]>59||+m[6]>59)return null
 const day=new Date(value.slice(0,10)+'T00:00:00Z');if(!Number.isFinite(day.getTime())||day.toISOString().slice(0,10)!==value.slice(0,10))return null
 const milliseconds=Date.parse(value.replace(/\.\d+(?=Z|[+-]\d\d:\d\d$)/,''))
 return Number.isFinite(milliseconds)?BigInt(milliseconds)*1000000n+BigInt((m[7]??'').padEnd(9,'0')):null
}
export const sourceAtOrAfter=(later:string,earlier:string)=>{const l=sourceInstant(later),e=sourceInstant(earlier);return l!==null&&e!==null&&l>=e}
