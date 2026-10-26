// Opt-in provider diagnostics for the live journey. Never retain request context.
export async function archiveDiagnostics(cf,worker,clean){
 const path='/workers/scripts/'+worker+'/tails',record=await cf(path,{method:'POST',body:{filters:[]}})
 const socket=new WebSocket(record.url,'trace-v1')
 socket.addEventListener('message',async event=>{
  const text=typeof event.data==='string'?event.data:await event.data.text(),trace=JSON.parse(text)
  console.log(JSON.stringify({providerTrace:true,outcome:trace.outcome,logCount:trace.logs?.length??0,exceptionCount:trace.exceptions?.length??0}))
  for(const line of trace.logs??[]){
   const parts=Array.isArray(line.message)?line.message:[line.message],message=parts.filter(x=>typeof x==='string').join(' ')
   if(message.startsWith('Archive operation failed'))console.log('Hosted archive diagnostic: '+clean(message))
  }
  for(const error of trace.exceptions??[])if(typeof error.message==='string'&&/^(D1_ERROR|SQLITE_)/.test(error.message))console.log('Hosted D1 exception: '+clean(error.message))
 })
 try{
  await new Promise((resolve,reject)=>{
   const timeout=setTimeout(()=>reject(Error('Provider diagnostic stream did not open')),20000)
   socket.addEventListener('open',()=>{clearTimeout(timeout);socket.send(JSON.stringify({debug:false}));resolve()},{once:true})
   socket.addEventListener('error',()=>{clearTimeout(timeout);reject(Error('Provider diagnostic stream failed'))},{once:true})
  })
 }catch(error){socket.close();await cf(path+'/'+record.id,{method:'DELETE'});throw error}
 // Let the provider attach its subscription before the first request.
 await new Promise(resolve=>setTimeout(resolve,5000))
 return async()=>{await new Promise(resolve=>setTimeout(resolve,5000));socket.close();await cf(path+'/'+record.id,{method:'DELETE'})}
}
