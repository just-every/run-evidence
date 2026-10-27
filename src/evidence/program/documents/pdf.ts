import { notice, sectionLines, type Rendered } from './model'
// A small PDF writer: Helvetica text, wrapped paragraphs and tables, Letter
// pages with a footer. Streams are uncompressed so the text stays inspectable.
const widths = '278 278 355 556 556 889 667 191 333 333 389 584 278 333 278 278 556 556 556 556 556 556 556 556 556 556 278 278 584 584 584 556 1015 667 667 722 722 667 611 778 722 278 500 667 556 833 722 778 667 778 722 667 611 722 667 944 667 667 611 278 278 278 469 556 333 556 556 500 556 556 278 556 556 222 222 500 222 833 556 556 556 556 333 500 278 556 500 722 500 500 500 334 260 334 584'.split(' ').map(Number)
const latin = (text: string) => text.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/→/g, '->').replace(/…/g, '...').replace(/[  ]/g, ' ').replace(/[\r\n\t]/g, ' ').replace(/[^\x20-\x7e¡-ÿ]/g, '?')
const width = (text: string, size: number, bold: boolean) => [...text].reduce((n, ch) => n + ((ch.charCodeAt(0) >= 32 && ch.charCodeAt(0) <= 126 ? widths[ch.charCodeAt(0) - 32] : 556) * size) / 1000, 0) * (bold ? 1.07 : 1)
function wrap(text: string, max: number, size: number, bold = false) {
 const out: string[] = []; let line = ''
 for (const word of latin(text).split(' ').filter(Boolean)) {
  let w = word
  while (width(w, size, bold) > max) { let cut = w.length; while (cut > 1 && width(w.slice(0, cut), size, bold) > max) cut--; if (line) { out.push(line); line = '' } out.push(w.slice(0, cut)); w = w.slice(cut) }
  const next = line ? line + ' ' + w : w
  if (width(next, size, bold) <= max) line = next; else { out.push(line); line = w }
 }
 if (line) out.push(line)
 return out.length ? out : ['']
}
const W = 612, H = 792, M = 54, TOP = H - 54, BOTTOM = 62
export function pdf(doc: Rendered) {
 const pages: string[][] = [[]]; let y = TOP
 const emit = (cmd: string) => pages.at(-1)!.push(cmd)
 const ensure = (h: number, redraw?: () => void) => { if (y - h < BOTTOM) { pages.push([]); y = TOP; redraw?.() } }
 const text = (s: string, x: number, size: number, bold = false) => emit(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x.toFixed(1)} ${y.toFixed(1)} Td (${latin(s).replace(/[\\()]/g, c => '\\' + c)}) Tj ET`)
 const paragraph = (s: string, size = 10, bold = false, gap = 4) => { for (const line of wrap(s, W - 2 * M, size, bold)) { ensure(size + 3); y -= size + 2; text(line, M, size, bold) } y -= gap }
 paragraph(doc.title, 20, true, 6); paragraph(doc.subtitle, 11, false, 6); paragraph(notice, 8.5, false, 10)
 for (const s of doc.sections) {
  ensure(40); paragraph(s.heading, 13, true, 4)
  for (const l of sectionLines(s)) paragraph(l)
  if (s.table) {
   const { head, rows } = s.table, size = 8, usable = W - 2 * M, longest = (i: number) => Math.max(...[head[i], ...rows.map(r => r[i] ?? '')].flatMap(c => latin(c).split(' ').map(w => w.length))), weight = head.map((_, i) => Math.max(longest(i) + 5, Math.min(40, Math.max(head[i].length, ...rows.map(r => Math.min(40, (r[i] ?? '').length)))))), total = weight.reduce((a, b) => a + b, 0), cols = weight.map(w => (w / total) * usable)
   const row = (cells: string[], bold: boolean) => {
    const lines = cells.map((c, i) => wrap(c ?? '', cols[i] - 6, size, bold)), height = Math.max(...lines.map(l => l.length)) * (size + 2) + 4
    ensure(height, () => row(head, true))
    const top = y; let x = M
    emit(`${x} ${(top - height).toFixed(1)} ${usable.toFixed(1)} ${height.toFixed(1)} re S`)
    lines.forEach((ls, i) => { ls.forEach((line, k) => { y = top - 2 - (k + 1) * (size + 2) + 2; text(line, x + 3, size, bold) }); if (i) emit(`${x.toFixed(1)} ${(top - height).toFixed(1)} m ${x.toFixed(1)} ${top.toFixed(1)} l S`); x += cols[i] })
    y = top - height
   }
   row(head, true); for (const r of rows) row(r, false); y -= 8
  }
 }
 const objects: string[] = []
 const add = (body: string) => { objects.push(body); return objects.length }
 add('<< /Type /Catalog /Pages 2 0 R >>'); add('PLACEHOLDER'); add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'); add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')
 const kids: number[] = []
 pages.forEach((cmds, i) => {
  const footer = `BT /F1 8 Tf ${M} 36 Td (${latin(`${doc.title} - Page ${i + 1} of ${pages.length} - prepared by Evidence; not an attestation`).replace(/[\\()]/g, c => '\\' + c)}) Tj ET`
  const stream = ['0.5 w', ...cmds, footer].join('\n'), content = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`)
  kids.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${content} 0 R >>`))
 })
 objects[1] = `<< /Type /Pages /Kids [${kids.map(k => k + ' 0 R').join(' ')}] /Count ${kids.length} >>`
 let out = '%PDF-1.4\n'; const offsets: number[] = []
 objects.forEach((body, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${body}\nendobj\n` })
 const xref = out.length
 out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
 return Uint8Array.from(out, ch => ch.charCodeAt(0) & 0xff)
}
