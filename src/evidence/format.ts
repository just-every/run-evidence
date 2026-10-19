// US display formats for stored UTC dates and instants. Storage, APIs and
// archives keep ISO; only pages read through these.
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const parts = (value: string) => { const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? value + 'T00:00:00Z' : value); return Number.isNaN(d.getTime()) ? null : d }
/** " · owner left 2026-10-16" (LIFECYCLE-002), or nothing while the owner is current */
export const ownerLeft = (departedAt: string | null | undefined) => departedAt ? ` · owner left ${departedAt.slice(0, 10)}` : ''
/** "Oct 16, 2026" */
export function usDate(value: string | null | undefined) {
 const d = value ? parts(value) : null
 return d ? `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}` : ''
}
/** "2:14 AM" (UTC) */
export function usTime(value: string | null | undefined) {
 const d = value ? parts(value) : null
 if (!d) return ''
 const h = d.getUTCHours(), m = String(d.getUTCMinutes()).padStart(2, '0')
 return `${h % 12 || 12}:${m} ${h < 12 ? 'AM' : 'PM'}`
}
/** "Oct 16, 2026, 2:14 AM" */
export const usDateTime = (value: string | null | undefined) => value ? `${usDate(value)}, ${usTime(value)}` : ''
/** "Oct 19, 10:45 PM" */
export function usDayTime(value: string) {
 const d = parts(value)
 return d ? `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${usTime(value)}` : ''
}
/** "Jan 1 to Dec 31, 2026", or with both years when they differ. */
export function usRange(from: string, to: string) {
 const a = parts(from), b = parts(to)
 if (!a || !b) return ''
 return a.getUTCFullYear() === b.getUTCFullYear() ? `${months[a.getUTCMonth()]} ${a.getUTCDate()} to ${usDate(to)}` : `${usDate(from)} to ${usDate(to)}`
}
/** "4 days ago", "3 hours ago" */
export function ago(value: string, now: Date) {
 const ms = now.getTime() - Date.parse(value), hours = Math.floor(ms / 3600000), days = Math.floor(hours / 24)
 return days >= 1 ? `${days} day${days === 1 ? '' : 's'} ago` : hours >= 1 ? `${hours} hour${hours === 1 ? '' : 's'} ago` : 'just now'
}
const attr = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
/** "Nov 15, 2026, 5:00 PM UTC" */
export const usInstant = (value: string | null | undefined) => value ? `${usDateTime(value)} UTC` : ''
/** A stored date or instant as US text in a <time> element that keeps the exact ISO value. */
export function when(value: string | null | undefined) {
 if (!value) return ''
 const date = /^\d{4}-\d{2}-\d{2}$/.test(value), text = date ? usDate(value) : /^\d{4}-\d{2}-\d{2}T/.test(value) ? usInstant(value) : ''
 return text ? `<time datetime="${attr(value)}"${date ? '' : ` title="${attr(value)}"`}>${text}</time>` : attr(value)
}
/** An inclusive stored date range, "Jan 1 to Dec 31, 2026", keeping both ISO dates. */
export function span(from: string | null | undefined, to: string | null | undefined) {
 if (!from || !to) return attr(from || to || '')
 return `<time datetime="${attr(from)}" title="${attr(from)} to ${attr(to)}">${usRange(from, to)}</time>`
}
/** Free text with any ISO dates or instants inside shown in US format. */
export const usText = (value: string | null | undefined) => attr(value ?? '').replace(/\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?Z)?/g, m => when(m))
