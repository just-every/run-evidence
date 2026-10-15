/** Small HTML primitives shared by the private desk and its supporting pages. */
export const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]!))

const paths = {
 home: '<path d="m3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9"/>',
 folder: '<path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v12H3V7Zm0 1h18"/>',
 person: '<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
 move: '<path d="m13 3 8 7-8 7v-5c-6 0-9 3-10 8 0-9 3-14 10-14V3Z"/>',
 document: '<path d="M14 3H5v18h14V8l-5-5Zm0 0v6h5"/>',
 database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 4 18 4 18 0V5M3 12c0 4 18 4 18 0"/>',
 people: '<circle cx="12" cy="7" r="3"/><path d="M6 21v-3a6 6 0 0 1 12 0v3H6ZM4 5a3 3 0 0 0 0 6M20 5a3 3 0 0 1 0 6M3 15a5 5 0 0 0-1 4M21 15a5 5 0 0 1 1 4"/>',
 change: '<path d="M3 7h17m-4-4 4 4-4 4M21 17H4m4-4-4 4 4 4"/>',
 chevron: '<path d="m9 5 7 7-7 7"/>',
 image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="2"/><path d="m3 17 6-6 4 4 3-3 5 5"/>',
} as const
export type IconName = keyof typeof paths
export const icon = (name: IconName) => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name]}</svg>`
export const iconTile = (name: IconName) => `<span class="icon-tile">${icon(name)}</span>`
export const slab = (body: string, className = '') => `<div class="slab${className ? ' '+escape(className) : ''}"><div class="card">${body}</div></div>`
export function stateChip(label: string) {
 const kind = ['covered', 'current', 'Open', 'Prepare only'].includes(label) ? 'covered' : ['due soon', 'Awaiting your review'].includes(label) ? 'due' : ['overdue', 'unavailable bytes'].includes(label) ? 'overdue' : 'missing'
 return `<span class="state state-${kind}"><span class="state-dot" aria-hidden="true"></span>${escape(label)}</span>`
}
