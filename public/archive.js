const form=document.querySelector('#archive-restore-form'),input=document.querySelector('#archive-file'),confirmButton=document.querySelector('#archive-confirm'),dryButton=document.querySelector('#archive-dry-run'),status=document.querySelector('#archive-status'),result=document.querySelector('#archive-result'),progress=document.querySelector('#archive-progress'),journalInput=document.querySelector('#archive-journal'),ack=document.querySelector('#archive-unverified')
let reviewedFile=null,busy=false,session=null,legacy=false
const storageKey='evidence-archive-upload'
const identity=file=>[file.name,file.size,file.lastModified].join(':')
const request=async(path,options={})=>{const r=await fetch(path,{credentials:'same-origin',...options}),data=await r.json();if(!r.ok)throw Error(data.error||'Archive request failed.');return data}
const post=(path,data,headers={})=>request(path,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(data)})
function changed(){reviewedFile=null;confirmButton.disabled=true;status.textContent='';result.hidden=true}
input.addEventListener('change',changed);journalInput.addEventListener('change',changed);ack.addEventListener('change',()=>{if(reviewedFile)confirmButton.disabled=false})
async function options(){let journal;const file=journalInput.files[0];if(file){if(file.size>2*1024*1024)throw Error('Choose a source journal smaller than 2 MiB.');journal=JSON.parse(await file.text())}return {journal,acceptUnverifiedHistory:ack.checked}}
async function upload(file){
 const bytes=new Uint8Array(await file.slice(0,1024).arrayBuffer());legacy=!new TextDecoder().decode(bytes).includes('"version":10')
 if(legacy)return
 let previous;try{previous=JSON.parse(localStorage.getItem(storageKey)||'null')}catch{}
 if(previous?.file===identity(file)){try{session=await request('/api/archive/uploads/'+previous.id)}catch{session=null}}
 if(!session||!['uploading','validated','failed'].includes(session.state)){session=await post('/api/archive/uploads',{});localStorage.setItem(storageKey,JSON.stringify({id:session.id,file:identity(file)}))}
 if(session.state!=='uploading')return
 const partBytes=session.part_bytes||1024*1024,total=Math.ceil(file.size/partBytes)
 progress.hidden=false
 for(let n=session.parts;n<total;n++){
  status.textContent=`Uploading archive: ${Math.floor(n/total*100)}%. You can resume this file after an interruption.`
  const data=await request(`/api/archive/uploads/${session.id}/chunks/${n}`,{method:'POST',headers:{'content-type':'application/octet-stream'},body:file.slice(n*partBytes,(n+1)*partBytes)})
  session.parts=data.parts;progress.value=Math.round((n+1)/total*100)
 }
}
function restoreSummary(data){
 const labels={controls:'Controls',requirements:'Evidence requirements',receipts:'Receipts',exhibits:'Exhibits',review_folders:'Review folders',review_events:'Access events',people:'People',programs:'Programs',policies:'Policies',vendors:'Vendors',risks:'Risks',tests:'Tests'}
 const facts=document.createElement('dl');facts.className='archive-facts'
 const add=(label,value)=>{const row=document.createElement('div'),term=document.createElement('dt'),detail=document.createElement('dd');term.textContent=label;detail.textContent=String(value);row.append(term,detail);facts.append(row)}
 for(const [key,label] of Object.entries(labels))if(Object.hasOwn(data.counts,key))add(label,data.counts[key].toLocaleString())
 add('Available original files',data.available.toLocaleString())
 add('Unavailable original files',(data.missing_count??data.missing.length).toLocaleString())
 add('Available bytes',data.bytes.toLocaleString())
 add('Erasure history',data.erasure_history==='verified'?'Verified against the source journal':'Unverified')
 if(!data.dry_run)add('Review folders closed',data.folders_closed.toLocaleString())
 result.replaceChildren(facts);result.hidden=false
}
async function submit(dryRun){
 const file=input.files[0];if(!file||busy||(!dryRun&&file!==reviewedFile))return
 busy=true;dryButton.disabled=true;confirmButton.disabled=true;input.disabled=true;journalInput.disabled=true;result.hidden=true
 try{
  const settings=await options();let data
  if(dryRun)await upload(file)
  status.textContent=dryRun?'Validating every row, original file, relationship and final digest.':'Restoring verified records and originals. Execution capabilities remain inactive.'
  if(legacy)data=await request('/api/archive/restore'+(dryRun?'?dry-run=1':''),{method:'POST',headers:{'content-type':'application/octet-stream',...(!dryRun?{'x-evidence-confirm':'restore'}:{}),...(settings.acceptUnverifiedHistory?{'x-evidence-erasure-history':'unverified acknowledged'}:{}),...(settings.journal?{'x-evidence-journal':JSON.stringify(settings.journal)}:{})},body:file})
  else data=await post(`/api/archive/uploads/${session.id}/${dryRun?'validate':'restore'}`,settings,dryRun?{}:{'x-evidence-confirm':'restore'})
  restoreSummary(data)
  if(dryRun){reviewedFile=file;status.textContent=`Dry run passed: ${data.counts.receipts} receipts, ${data.available} available originals and ${data.missing_count??data.missing.length} unavailable originals. Erasure history ${data.erasure_history}. ${data.requires_latest_journal?'Supply the latest journal or acknowledge unverified history before confirmation.':'Ready for confirmation.'}`;confirmButton.disabled=data.requires_latest_journal&&!ack.checked}
  else{reviewedFile=null;session=null;localStorage.removeItem(storageKey);status.textContent='Restore complete. Original history is retained. Review folders are closed; schedules, messages, collections, writes and shares are inactive until reauthorization.';await capabilities()}
 }catch(error){status.textContent=error.message||'Archive request failed. Choose the same file and run dry run to resume.'}
 finally{busy=false;dryButton.disabled=false;input.disabled=false;journalInput.disabled=false}
}
form.addEventListener('submit',event=>{event.preventDefault();submit(true)});confirmButton.addEventListener('click',()=>submit(false))
async function capabilities(){const data=await request('/api/archive/capabilities'),target=document.querySelector('#archive-capabilities');target.replaceChildren();for(const c of data.capabilities){const p=document.createElement('p');p.textContent=`${c.capability} · ${c.subject}: ${c.authorized_at?'reauthorized':'inactive after restore'}`;target.append(p)}}
document.querySelector('#archive-reauthorize-form').addEventListener('submit',async event=>{event.preventDefault();const target=document.querySelector('#archive-reauthorize-status');try{const data=await post('/api/archive/reauthorize',{capability:document.querySelector('#archive-capability').value,subject:document.querySelector('#archive-subject').value.trim()});target.textContent=`Reauthorized ${data.reauthorized} for ${data.subject}. Fresh connector credentials are still required.`;await capabilities()}catch(error){target.textContent=error.message}})
capabilities().catch(()=>{})
