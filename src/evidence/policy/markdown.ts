import { Marked } from 'marked'
import { escape } from '../view'

// Rendering never changes the revision bytes used for approval or acknowledgment.
// HTML is text, images remain their descriptions, and only web and mail links
// can be followed. No author-controlled element or image request is emitted.
const markdown = new Marked({ gfm: true, breaks: false })
markdown.use({ renderer: {
 html({ text }) { return escape(text) },
 image({ text }) { return escape(text) },
 link({ href, title, tokens }) {
  const label = this.parser.parseInline(tokens)
  if (/[\u0000-\u0020\u007f]/.test(href)) return label
  if (!URL.canParse(href, 'https://policy.invalid')) return label
  const url = new URL(href, 'https://policy.invalid')
  if (!['https:', 'http:', 'mailto:'].includes(url.protocol)) return label
  return `<a href="${escape(href)}"${title ? ` title="${escape(title)}"` : ''} rel="noreferrer">${label}</a>`
 },
 heading({ depth, tokens }) {
  const level = Math.max(2, depth)
  return `<h${level}>${this.parser.parseInline(tokens)}</h${level}>\n`
 },
} })

export function policyMarkdown(body: string): string {
 return `<article class="policy-reading">${(markdown.parse(body, { async: false }) as string).replace(/<table>/g, '<div class="table-scroll"><table>').replace(/<\/table>/g, '</table></div>')}</article>`
}
