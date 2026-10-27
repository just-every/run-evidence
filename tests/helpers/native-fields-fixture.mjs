// WORK-001 request observation at the network edge. Wrap an existing provider
// fixture: this records real outbound requests; all responses come from that edge.
export function nativeFieldsFixture(outbound) {
 const calls=[]
 return {
  calls,
  async outbound(request) {
   const copy=request.clone(),raw=await copy.text()
   let body=null
   if(raw)body=JSON.parse(raw)
   const response=await outbound(request)
   if(response)calls.push({url:new URL(copy.url),method:copy.method,body,response:response.status>=200&&response.status<300?await response.clone().json().catch(()=>null):null})
   return response
  },
 }
}
