// A small reader for AWS XML responses (no DOM in Workers). Elements become
// objects keyed by tag; repeated tags become arrays; attributes are ignored.
export type XmlValue = string | XmlNode | XmlValue[]
export interface XmlNode { [tag: string]: XmlValue }
const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
const decode = (text: string) => text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) => e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : entities[e.toLowerCase()] ?? '')
export function parseXml(xml: string): XmlNode {
 const root: XmlNode = {}, stack: { tag: string; node: XmlNode; text: string }[] = [{ tag: '', node: root, text: '' }]
 const tags = /<!\[CDATA\[([\s\S]*?)\]\]>|<(\/?)([A-Za-z_][\w.:-]*)([^>]*?)(\/?)>|<\?[\s\S]*?\?>|<!--[\s\S]*?-->|([^<]+)/g
 let m: RegExpExecArray | null
 const add = (parent: XmlNode, tag: string, value: XmlValue) => { const prior = parent[tag]; parent[tag] = prior === undefined ? value : Array.isArray(prior) ? [...prior, value] : [prior, value] }
 while ((m = tags.exec(xml))) {
  const top = stack[stack.length - 1]
  if (m[1] !== undefined) top.text += m[1]
  else if (m[6] !== undefined) top.text += decode(m[6])
  else if (m[3] && !m[2]) { if (m[5]) add(top.node, m[3], ''); else stack.push({ tag: m[3], node: {}, text: '' }) }
  else if (m[3] && m[2]) {
   const done = stack.pop()
   if (!done || done.tag !== m[3] || !stack.length) throw new Error('Malformed XML')
   add(stack[stack.length - 1].node, done.tag, Object.keys(done.node).length ? done.node : done.text.trim())
  }
 }
 if (stack.length !== 1) throw new Error('Malformed XML')
 return root
}
// Path helpers: first value, all values as a list, and text.
export const list = (value: XmlValue | undefined): XmlValue[] => value === undefined || value === '' ? [] : Array.isArray(value) ? value : [value]
export function at(node: XmlValue | undefined, ...path: string[]): XmlValue | undefined {
 let current: XmlValue | undefined = node
 for (const key of path) { if (current === undefined) return undefined; const first: XmlValue = Array.isArray(current) ? current[0] : current; current = typeof first === 'object' && first && !Array.isArray(first) ? (first as XmlNode)[key] : undefined }
 return current
}
export const textAt = (node: XmlValue | undefined, ...path: string[]) => { const v = at(node, ...path); const first = Array.isArray(v) ? v[0] : v; return typeof first === 'string' ? first : null }
// AWS lists come as <member> or <item> children of a container element.
export const items = (node: XmlValue | undefined, ...path: string[]) => { const container = at(node, ...path); const c = Array.isArray(container) ? container[0] : container; return typeof c === 'object' && c ? list((c as XmlNode).member ?? (c as XmlNode).item) : [] }
