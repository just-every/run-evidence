import { Refusal } from './upload'
// Provider calls go only to public HTTPS hosts named by the owner: no
// credentials, query or fragment in the base, no IP literals or local names.
export function publicBase(value: unknown, fallback: string, label = 'The API base') {
 if (typeof value !== 'string' || !value.trim()) return fallback
 let url: URL
 try { url = new URL(value.trim()) } catch { throw new Refusal(`${label} must be an https URL.`) }
 if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Refusal(`${label} must be a plain https URL.`)
 if (/^\[|^\d+\.\d+\.\d+\.\d+$/.test(url.hostname) || !url.hostname.includes('.') || /\.(local|internal|localhost|lan|home)$/i.test(url.hostname)) throw new Refusal(`${label} must be a public host name.`)
 return url.origin + url.pathname.replace(/\/+$/, '')
}
