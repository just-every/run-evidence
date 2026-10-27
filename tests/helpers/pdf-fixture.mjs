// Synthetic, valid PDF 1.4 with independent page objects and text streams.
// No provider/model is faked: production PDF.js reads these exact bytes.
export function pdfFixture(pages) {
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'],kids=[]
 const add=s=>{objects.push(s);return objects.length}
 for(const lines of pages){const stream=lines.map((s,i)=>`BT /F1 10 Tf 40 ${750-i*18} Td (${s.replace(/[\\()]/g,c=>'\\'+c)}) Tj ET`).join('\n'),content=add(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);kids.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${content} 0 R >>`))}
 objects[1]=`<< /Type /Pages /Kids [${kids.map(n=>n+' 0 R').join(' ')}] /Count ${kids.length} >>`
 let out='%PDF-1.4\n';const offsets=[0]
 for(const [i,o] of objects.entries()){offsets.push(Buffer.byteLength(out));out+=`${i+1} 0 obj\n${o}\nendobj\n`}
 const xref=Buffer.byteLength(out);out+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;return Buffer.from(out)
}
export const socReport=(opinion='unqualified')=>pdfFixture([
 ['SOC 2 Type II','Period: 2026-01-01 to 2026-03-31','Service auditor: Harbour Assurance LLP','Opinion: '+opinion,'Issued: 2026-08-01'],
 ['Tested-control exception: Two user access reviews were performed late.','CUEC 1: Review all supplier account access every quarter.','CUEC 2: Encrypt customer exports before transmission.','Subservice organization: North Cloud Inc, carve-out treatment.'],
])
