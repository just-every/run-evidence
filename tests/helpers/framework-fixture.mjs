import { xlsx } from './xlsx.mjs'
export const frameworkColumns = { map_id:'Requirement',map_title:'Heading',map_description:'Detail',map_section:'Group',map_control_ids:'Controls' }
export function frameworkFixtureRows(control='') {
 const rows=Array.from({length:78},(_,i)=>[`ADD-${String(i+1).padStart(3,'0')}`,`Customer obligation ${i+1}`,`Customer security commitment ${i+1}`,'Security',i<20?'AC-02':i===77?control:''])
 return [['Requirement','Heading','Detail','Group','Controls'],...rows,['ADD-001','Duplicate requirement','Must be refused','Security','AC-02'],['ADD-080','Unknown mapping','Must be refused','Security','NO-SUCH-CONTROL']]
}
export const frameworkFixture = control => xlsx(frameworkFixtureRows(control))
export function revisedFrameworkFixture(control='') {
 const rows=frameworkFixtureRows(control).slice(0,78)
 rows[1][1]='Revised customer obligation 1';rows[2][2]='Revised customer security commitment 2';rows[3][3]='Revised security section'
 return xlsx(rows)
}
export function frameworkUpload(bytes,fields={},filename='customer-addendum.xlsx') {
 const form=new FormData()
 for(const [key,value] of Object.entries({name:'Customer security addendum',...frameworkColumns,...fields})) form.set(key,String(value))
 form.set('file',new File([bytes],filename,{type:filename.endsWith('.xlsx')?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'text/csv'}))
 return form
}
