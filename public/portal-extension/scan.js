// Runs only after an explicit extension action. Never reads answer values,
// credentials, file bytes, hidden fields, or anything from another origin.
function scanPortalPage() {
 const fields=[],unsupported=[],seen=new Set(),groups=new Map()
 const cleanText=node=>{const copy=node.cloneNode(true);for(const child of copy.querySelectorAll('input,textarea,select,button,script,style'))child.remove();return copy.textContent.trim()}
 const label=el=>(el.labels?.length?[...el.labels].map(cleanText).join(' '):el.getAttribute('aria-label')||(el.getAttribute('aria-labelledby')||'').split(/\s+/).map(id=>document.getElementById(id)).filter(Boolean).map(cleanText).join(' ')||el.getAttribute('placeholder')||'').slice(0,1000)
 for(const el of document.querySelectorAll('input,textarea,select')) {
  if(el.matches('input[type=hidden],input[type=password],input[type=submit],input[type=button],input[type=reset],input[type=image]')||el.disabled||!el.getClientRects().length)continue
  const form=el.form,formId=form?(form.id||form.getAttribute('name')||'form-'+[...document.forms].indexOf(form)):'document'
  const key=el.id||el.name
  if(!key){unsupported.push('Unnamed '+el.tagName.toLowerCase()+' field');continue}
  const grouped=el.type==='radio'||el.type==='checkbox',groupKey=formId+':'+el.name
  if(grouped&&el.name){const group=groups.get(groupKey)||[];group.push(el);groups.set(groupKey,group);continue}
  add([el],formId+':'+key)
 }
 for(const [key,items]of groups)add(items,key)
 function add(items,id){
  const el=items[0],legend=(el.closest('fieldset')?.querySelector('legend')?cleanText(el.closest('fieldset').querySelector('legend')):''),section=(legend||document.querySelector('h1')?.textContent||'').trim().slice(0,300)
  if(seen.has(id)){unsupported.push('Ambiguous field '+id);return}seen.add(id)
  let type='text',options=[]
  if(el.tagName==='SELECT'){type=el.multiple?'multi-select':'choice';options=[...el.options].filter(o=>!o.disabled&&!o.parentElement?.disabled).map(o=>({value:o.value,label:o.label}))}
  else if(el.type==='radio'||el.type==='checkbox') {type=el.type==='radio'?'choice':items.length===1?['yes','no'].join('/'):'multi-select';options=type===['yes','no'].join('/')?[{value:'true',label:label(el)+' checked'},{value:'false',label:label(el)+' unchecked'}]:items.map(o=>({value:o.value,label:label(o)}))}
  else if(el.type==='file')type='file'
  else if(!['text','email','url','tel','search','textarea'].includes(el.type)){unsupported.push('Unsupported '+el.type+' field '+id);return}
  const question=items.length>1?legend||label(el):label(el)
  if(!question||new Set(options.map(o=>o.value)).size!==options.length){unsupported.push('Missing label or ambiguous options '+id);return}
  fields.push({id,label:question,type,section,options,required:items.some(o=>o.required),multiple:!!el.multiple,accept:el.type==='file'?el.accept:''})
 }
 if(document.querySelector('iframe,frame'))unsupported.push('Embedded frames require their own explicit top-level capture')
 if([...document.querySelectorAll('*')].some(el=>el.shadowRoot))unsupported.push('Shadow-root fields require a supported capture adapter')
 const url=new URL(location.href);url.search='';url.hash='';url.username='';url.password=''
 return {title:document.title||'Questionnaire',url:url.href,fields,unsupported}
}

// A second scan in the isolated content world catches changes made after the
// plan was fetched. Each assignment checks again before touching that field.
function applyPortalPlan(plan){
 const report=[]
 const scan=scanPortalPage()
 if(scan.unsupported.length||scan.url!==plan.page.url)return {error:'Page changed; re-capture and review.',results:[]}
 for(const item of plan.results){
  if(item.state!=='ready'){report.push({id:item.id,state:'refused',reason:item.reason});continue}
  const current=scanPortalPage(),field=current.fields.find(f=>f.id===item.id)
  if(current.unsupported.length||current.url!==plan.page.url||!field||JSON.stringify(field)!==JSON.stringify(item.field)){report.push({id:item.id,state:'refused',reason:'Field changed after approval scan.'});continue}
  const candidates=[...document.querySelectorAll('input,textarea,select')].filter(el=>{
   const form=el.form,formId=form?(form.id||form.getAttribute('name')||'form-'+[...document.forms].indexOf(form)):'document'
   const key=(el.type==='radio'||el.type==='checkbox')&&el.name?el.name:el.id||el.name
   return formId+':'+key===item.id&&!el.disabled&&el.getClientRects().length
  })
  const el=candidates[0]
  if(!el){report.push({id:item.id,state:'refused',reason:'Field unavailable or unsupported.'});continue}
  if(field.type==='file'){
   if(!item.document||typeof item.bytes!=='string'){report.push({id:item.id,state:'refused',reason:'Approved document bytes unavailable.'});continue}
   const bytes=Uint8Array.from(atob(item.bytes),c=>c.charCodeAt(0)),transfer=new DataTransfer();transfer.items.add(new File([bytes],item.document.filename,{type:item.document.media_type}));el.files=transfer.files
  }else if(field.type==='text'){
   Object.getOwnPropertyDescriptor(el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(el,item.value)
  }else if(el.tagName==='SELECT'){
   const values=field.type==='multi-select'?JSON.parse(item.value):[item.value]
   for(const option of el.options)option.selected=values.includes(option.value)
  }else if(field.type===['yes','no'].join('/'))el.checked=item.value==='true'
  else {const values=field.type==='multi-select'?JSON.parse(item.value):[item.value];for(const control of candidates)control.checked=values.includes(control.value)}
  // No click, submit, navigation or change event is emitted. Portals with
  // framework-only controlled fields may need a manual edit before continuing.
  report.push({id:item.id,state:'filled'})
 }
 return {results:report}
}
