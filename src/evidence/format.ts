// US display formats for stored UTC dates and instants. Storage, APIs and
// archives keep ISO; only pages read through these.
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const parts = (value: string) => { const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? value + 'T00:00:00Z' : value); return Number.isNaN(d.getTime()) ? null : d }
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
