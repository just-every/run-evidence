import { notice, sectionLines, type Rendered } from './model'
import { zip } from './zip'
const esc = (v: string) => v.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!)).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')
const col = (i: number) => { let s = ''; for (i++; i; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s; return s }
const sheet = (rows: string[][]) => `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((row, r) => `<row r="${r + 1}">${row.map((c, i) => `<c r="${col(i)}${r + 1}" t="inlineStr"><is><t xml:space="preserve">${esc(c)}</t></is></c>`).join('')}</row>`).join('')}</sheetData></worksheet>`
const name = (value: string, used: Set<string>) => { let n = value.replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 28) || 'Sheet', k = 1; while (used.has(n.toLowerCase())) n = n.slice(0, 25) + ' ' + ++k; used.add(n.toLowerCase()); return n }
// A real SpreadsheetML workbook: a cover sheet, then one sheet per tabular section.
export function xlsx(doc: Rendered) {
 const used = new Set<string>(), sheets = [{ name: name('Cover', used), rows: [[doc.title], [doc.subtitle], [notice], ...doc.sections.filter(s => !s.table).flatMap(s => [[s.heading], ...sectionLines(s).map(l => [l])])] }, ...doc.sections.filter(s => s.table).map(s => ({ name: name(s.heading, used), rows: [...sectionLines(s).map(l => [l]), s.table!.head, ...s.table!.rows] }))]
 return zip({
  '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`,
  '_rels/.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
  'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`,
  'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>`,
  ...Object.fromEntries(sheets.map((s, i) => [`xl/worksheets/sheet${i + 1}.xml`, sheet(s.rows)])),
 })
}
