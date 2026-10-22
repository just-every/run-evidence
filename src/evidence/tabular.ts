import { unzip } from './import/zip'
import { Refusal } from './upload'
// Spreadsheet input for reviewed imports: RFC 4180 CSV or the first worksheet
// of an XLSX workbook. Cells come back as trimmed text keyed by header.
export interface Table { headers: string[]; rows: Record<string, string>[] }
export const MAX_ROWS = 2000
export function parseCsv(text: string): Table {
 const records: string[][] = []; let field = '', record: string[] = [], quoted = false
 for (let i = 0; i < text.length; i++) {
  const c = text[i]
  if (quoted) { if (c === '"' && text[i + 1] === '"') { field += '"'; i++ } else if (c === '"') quoted = false; else field += c; continue }
  if (c === '"' && field === '') quoted = true
  else if (c === ',') { record.push(field); field = '' }
  else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; record.push(field); records.push(record); record = []; field = '' }
  else field += c
 }
 if (quoted) throw new Refusal('The CSV has an unterminated quoted field.')
 if (field !== '' || record.length) { record.push(field); records.push(record) }
 return table(records.filter(r => r.some(cell => cell.trim() !== '')))
}
const xmlText = (value: string) => value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, '&')
const column = (ref: string) => [...ref.replace(/\d+$/, '')].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1
export function parseXlsx(bytes: Uint8Array, options: { sheet?: string; headerRow?: number; maxRows?: number } = {}): Table {
 const files = unzip(bytes), read = (path: string) => { const f = files.get(path); return f ? new TextDecoder().decode(f) : null }
 const workbook = read('xl/workbook.xml'), rels = read('xl/_rels/workbook.xml.rels')
 if (!workbook || !rels) throw new Refusal('This is not an XLSX workbook.')
 const sheets = [...workbook.matchAll(/<sheet\b([^>]*)\/?>/g)].map(m => ({ id: /\br:id="([^"]+)"/.exec(m[1])?.[1], name: xmlText(/\bname="([^"]+)"/.exec(m[1])?.[1] ?? '') }))
 const first = (options.sheet ? sheets.find(s => s.name === options.sheet) : sheets[0])?.id, target = first ? new RegExp(`<Relationship\\b[^>]*Id="${first}"[^>]*Target="([^"]+)"`).exec(rels)?.[1] ?? new RegExp(`<Relationship\\b[^>]*Target="([^"]+)"[^>]*Id="${first}"`).exec(rels)?.[1] : null
 const sheet = target ? read(target.startsWith('/') ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '')) : null
 if (!sheet) throw new Refusal('The workbook has no readable first worksheet.')
 const shared = [...(read('xl/sharedStrings.xml') ?? '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => xmlText([...m[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join('')))
 const records: string[][] = []
 for (const row of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
  const cells: string[] = []
  for (const cell of row[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
   const attrs = cell[1], inner = cell[2] ?? '', ref = /\br="([A-Z]+\d+)"/.exec(attrs)?.[1], type = /\bt="([^"]+)"/.exec(attrs)?.[1]
   const value = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1] ?? '', inline = [...inner.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join('')
   const text = type === 's' ? shared[Number(value)] ?? '' : type === 'inlineStr' ? xmlText(inline) : type === 'b' ? (value === '1' ? 'TRUE' : 'FALSE') : xmlText(value)
   cells[ref ? column(ref) : cells.length] = text
  }
  const number = Number(/\br="(\d+)"/.exec(row[0])?.[1] ?? records.length + 1)
  if (number >= (options.headerRow ?? 1)) records.push(Array.from(cells, c => c ?? ''))
 }
 return table(records.filter(r => r.some(cell => cell.trim() !== '')), options.maxRows)
}
function table(records: string[][], maxRows = MAX_ROWS): Table {
 if (!records.length) throw new Refusal('The file has no header row.')
 const headers = records[0].map(h => h.trim())
 if (headers.some(h => !h) || new Set(headers.map(h => h.toLowerCase())).size !== headers.length) throw new Refusal('Every column needs a unique header.')
 if (records.length - 1 > maxRows) throw new Refusal(`Import at most ${maxRows} rows at a time.`, 413)
 return { headers, rows: records.slice(1).map(r => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? '').trim()]))) }
}
export function parseTable(filename: string, bytes: Uint8Array): Table {
 if (/\.xlsx$/i.test(filename)) return parseXlsx(bytes)
 if (/\.csv$/i.test(filename)) { try { return parseCsv(new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^﻿/, '')) } catch (error) { if (error instanceof Refusal) throw error; throw new Refusal('The CSV must be UTF-8 text.') } }
 throw new Refusal('Upload a .csv or .xlsx file.')
}
