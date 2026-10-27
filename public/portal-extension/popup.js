const status=document.querySelector('#status'),list=document.querySelector('#pages')
const show=async()=>{const {pages=[]}=await chrome.storage.session.get('pages');list.replaceChildren(...pages.map(p=>{const li=document.createElement('li');li.textContent=p.id+': '+p.fields.length+' fields';return li}))}
const run=action=>async event=>{event.preventDefault();try{await action(event)}catch(error){status.textContent=error.message}}
document.querySelector('#connect').addEventListener('submit',run(async event=>{
 const data=new FormData(event.target),url=new URL(data.get('installation'))
 if(url.username||url.password||url.pathname!=='/'||url.search||url.hash||url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)))throw Error('Use an HTTPS installation origin (HTTP loopback is allowed for local installations).')
 if(!await chrome.permissions.request({origins:[url.protocol+'//'+url.hostname+'/*']}))throw Error('Installation access was not granted.')
 await chrome.storage.session.clear()
 await chrome.storage.session.set({installation:url.origin,token:data.get('token'),program_id:data.get('program'),name:data.get('name'),pages:[]})
 event.target.querySelector('[name=token]').value='';status.textContent='Connected for capture only. Credentials stay in extension session storage.';await show()
}))
document.querySelector('#capture').addEventListener('click',run(async()=>{
 const data=await chrome.storage.session.get(['token','pages']);if(!data.token)throw Error('Connect first.')
 const id=document.querySelector('#page-id').value.trim();if(!id)throw Error('Name this page or step before capture.')
 const [tab]=await chrome.tabs.query({active:true,currentWindow:true})
 if(!tab?.id||!/^https?:/.test(tab.url||''))throw Error('Open the portal page in the active tab.')
 const [{result}]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:scanPortalPage})
 if(result.unsupported.length)throw Error(result.unsupported.join('; '))
 const pages=data.pages||[];if(pages.some(p=>p.id===id))throw Error('That page is already captured. Clear the session to start a new capture.')
 if(pages.length>=100)throw Error('At most 100 pages per capture.')
 if(pages.length&&new URL(pages[0].url).origin!==new URL(result.url).origin)throw Error('All pages must use the same portal origin.')
 pages.push({id,...result});await chrome.storage.session.set({pages});status.textContent='Page captured without reading answer values.';await show()
}))
document.querySelector('#import').addEventListener('click',run(async()=>{
 const data=await chrome.storage.session.get(['installation','token','program_id','name','pages','previous_id'])
 if(!data.token||!data.pages?.length)throw Error('Connect and capture pages first.')
 const response=await fetch(data.installation+'/v1/questionnaires/captures',{method:'POST',credentials:'omit',redirect:'error',headers:{authorization:'Bearer '+data.token,'content-type':'application/json'},body:JSON.stringify({name:data.name,program_id:data.program_id,pages:data.pages,previous_id:data.previous_id})}),result=await response.json()
 if(!response.ok)throw Error(result.error||'Capture import failed.')
 status.textContent='Imported. Open Questionnaires in your Evidence installation for citation and review. Record '+result.id
 document.querySelector('#questionnaire-id').value=result.id;await chrome.storage.session.set({pages:[],previous_id:result.id});await show()
}))
document.querySelector('#clear').addEventListener('click',run(async()=>{await chrome.storage.session.clear();status.textContent='Session and captures cleared.';await show()}))
show().catch(error=>{status.textContent=error.message})

document.querySelector('#fill').addEventListener('click',run(async()=>{
 const data=await chrome.storage.session.get(['installation','token']),qid=document.querySelector('#questionnaire-id').value.trim(),draft=document.querySelector('#draft-id').value.trim(),recipient=document.querySelector('#recipient').value.trim(),id=document.querySelector('#page-id').value.trim()
 if(!data.token||!qid||!draft||!recipient||!id)throw Error('Connect and name the captured questionnaire, exact approved draft, recipient and page.')
 const [tab]=await chrome.tabs.query({active:true,currentWindow:true})
 const [{result:page}]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:scanPortalPage})
 const response=await fetch(data.installation+'/v1/questionnaires/'+encodeURIComponent(qid)+'/fill-plan',{method:'POST',credentials:'omit',redirect:'error',headers:{authorization:'Bearer '+data.token,'content-type':'application/json'},body:JSON.stringify({draft_id:draft,recipient,page:{id,...page}})}),plan=await response.json()
 if(!response.ok)throw Error(plan.error||'Fill refused.')
 for(const field of plan.results.filter(r=>r.state==='ready'&&r.document)){
  const file=await fetch(data.installation+'/v1/questionnaires/'+encodeURIComponent(qid)+'/document',{method:'POST',credentials:'omit',redirect:'error',headers:{authorization:'Bearer '+data.token,'content-type':'application/json'},body:JSON.stringify({draft_id:draft,recipient,page:{id,...page},field_id:field.id})})
  if(!file.ok)throw Error('Approved document became unavailable. Re-scan and review before filling.')
  const bytes=new Uint8Array(await file.arrayBuffer());if(bytes.byteLength!==field.document.size)throw Error('Approved document size changed.')
  const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');if(digest!==field.document.sha256)throw Error('Approved document digest changed.')
  let encoded='';for(let i=0;i<bytes.length;i+=8192)encoded+=String.fromCharCode(...bytes.subarray(i,i+8192));field.bytes=btoa(encoded)
 }
 // Both scanner and applier live in this injection; the portal cannot replace
 // them or access extension credentials.
 await chrome.scripting.executeScript({target:{tabId:tab.id},files:['scan.js']})
 const [{result}]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:plan=>applyPortalPlan(plan),args:[plan]})
 if(!result.error){const reported=await fetch(data.installation+'/v1/questionnaires/'+encodeURIComponent(qid)+'/fill-reports',{method:'POST',credentials:'omit',redirect:'error',headers:{authorization:'Bearer '+data.token,'content-type':'application/json'},body:JSON.stringify({draft_id:plan.draft_id,snapshot_hash:plan.snapshot_hash,page_id:id,results:result.results})});if(!reported.ok)throw Error('Fields may have been filled, but history could not be retained. Inspect the page before retrying.')}
 status.textContent=result.error||result.results.map(r=>r.id+': '+r.state+(r.reason?' — '+r.reason:'')).join('; ')
}))
