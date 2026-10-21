// A stored (uncompressed) ZIP writer for DOCX and XLSX packages.
const table = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
const crc32 = (bytes: Uint8Array) => { let c = 0xffffffff; for (const b of bytes) c = table[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
export function zip(files: Record<string, string>) {
 const encoder = new TextEncoder(), local: Uint8Array[] = [], central: Uint8Array[] = []
 let offset = 0
 for (const [name, text] of Object.entries(files)) {
  const data = encoder.encode(text), path = encoder.encode(name), crc = crc32(data)
  const head = new DataView(new ArrayBuffer(30)); head.setUint32(0, 0x04034b50, true); head.setUint16(4, 20, true); head.setUint16(6, 0x0800, true); head.setUint32(14, crc, true); head.setUint32(18, data.length, true); head.setUint32(22, data.length, true); head.setUint16(26, path.length, true)
  const entry = new DataView(new ArrayBuffer(46)); entry.setUint32(0, 0x02014b50, true); entry.setUint16(4, 20, true); entry.setUint16(6, 20, true); entry.setUint16(8, 0x0800, true); entry.setUint32(16, crc, true); entry.setUint32(20, data.length, true); entry.setUint32(24, data.length, true); entry.setUint16(28, path.length, true); entry.setUint32(42, offset, true)
  local.push(new Uint8Array(head.buffer), path, data); central.push(new Uint8Array(entry.buffer), path)
  offset += 30 + path.length + data.length
 }
 const size = central.reduce((n, c) => n + c.length, 0), end = new DataView(new ArrayBuffer(22)); end.setUint32(0, 0x06054b50, true); end.setUint16(8, Object.keys(files).length, true); end.setUint16(10, Object.keys(files).length, true); end.setUint32(12, size, true); end.setUint32(16, offset, true)
 const out = new Uint8Array(offset + size + 22); let at = 0
 for (const part of [...local, ...central, new Uint8Array(end.buffer)]) { out.set(part, at); at += part.length }
 return out
}
