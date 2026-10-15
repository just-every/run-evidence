const form=document.querySelector('#archive-restore-form'),input=document.querySelector('#archive-file'),confirmButton=document.querySelector('#archive-confirm'),dryButton=document.querySelector('#archive-dry-run'),status=document.querySelector('#archive-status'),result=document.querySelector('#archive-result')
let reviewedFile=null,busy=false
input.addEventListener('change',()=>{reviewedFile=null;confirmButton.disabled=true;status.textContent='';result.hidden=true})
async function submit(dryRun){
 const file=input.files[0]
 if(!file || busy || (!dryRun && file!==reviewedFile))return
 busy=true;dryButton.disabled=true;confirmButton.disabled=true;input.disabled=true
 status.textContent=dryRun?'Checking the complete archive. No records are being restored.':'Rechecking the complete archive, then restoring verified records and files.';result.hidden=true
 try{
  const response=await fetch('/api/archive/restore'+(dryRun?'?dry-run=1':''),{method:'POST',headers:{'content-type':'application/octet-stream',...(!dryRun?{'x-evidence-confirm':'restore'}:{})},body:file,credentials:'same-origin'})
  const data=await response.json()
  if(!response.ok)throw Error(data.error || 'The archive could not be restored.')
  result.textContent=JSON.stringify(data,null,2);result.hidden=false
  if(dryRun){reviewedFile=file;status.textContent=`Dry run passed: ${data.counts.receipts} receipts, ${data.available} available files and ${data.missing.length} unavailable files. Confirm restore to admit them. Review folders will be closed.`;confirmButton.disabled=false}
  else{reviewedFile=null;status.textContent='Restore complete. Original receipts and view logs are retained; review folders are closed. Open the proof desk to inspect your evidence.'}
 }catch(error){reviewedFile=null;status.textContent=error.message || 'Archive request failed.'}
 finally{busy=false;dryButton.disabled=false;input.disabled=false}
}
form.addEventListener('submit',event=>{event.preventDefault();submit(true)})
confirmButton.addEventListener('click',()=>submit(false))
