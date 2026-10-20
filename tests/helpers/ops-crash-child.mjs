import { runtime } from './runtime.mjs'
import { githubFixture } from './github-fixture.mjs'
process.once('message',async({state,edge})=>{
 const fixture=githubFixture();fixture.github.clock=state.settings.HARNESS_NOW
 const network=async request=>{
  if((edge==='collection'&&new URL(request.url).host==='api.github.com')||(edge==='notification'&&request.url==='https://api.resend.com/emails')) {
   process.send({interrupted:edge})
   // Network-edge provider has received the request; its acceptance cannot be
   // inferred by the installation that is about to lose its entire process.
   return new Promise(()=>{})
  }
  return fixture.outbound(request)
 }
 const app=await runtime({...state,outbound:network,mailOutbound:network})
 await app.tick()
 process.send({unexpectedCompletion:true})
 await app.close()
})
