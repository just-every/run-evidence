// Opt-in provider diagnostics for the live journey. Never retain request context.
export async function archiveDiagnostics(cf,worker,clean){
 const path='/workers/scripts/'+worker+'/tails',record=await cf(path,{method:'POST',body:{filters:[]}})
 const socket=new WebSocket(record.url,'trace-v1')
 socket.addEventListener('message',async event=>{
  const text=typeof event.data==='string'?event.data:await event.data.text(),trace=JSON.parse(text)
  for(const line of trace.logs??[]){
   if(line.message?.[0]==='Archive operation failed')console.log('Hosted archive diagnostic: '+clean(line.message.join(' ')))
  }
 })
 try{
  await new Promise((resolve,reject)=>{
   const timeout=setTimeout(()=>reject(Error('Provider diagnostic stream did not open')),20000)
   socket.addEventListener('open',()=>{clearTimeout(timeout);socket.send(JSON.stringify({debug:false}));resolve()},{once:true})
   socket.addEventListener('error',()=>{clearTimeout(timeout);reject(Error('Provider diagnostic stream failed'))},{once:true})
  })
 }catch(error){socket.close();await cf(path+'/'+record.id,{method:'DELETE'});throw error}
 return async()=>{await new Promise(resolve=>setTimeout(resolve,2000));socket.close();await cf(path+'/'+record.id,{method:'DELETE'})}
}
