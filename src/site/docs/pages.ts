// The owner guides /docs builds from the repository's Markdown at build time. Each guide
// describes what the code does today; links to other repository files go to GitHub.
import { Marked } from 'marked'
import gettingStarted from '../../../docs/GETTING-STARTED.md?raw'
import mainFlows from '../../../docs/MAIN-FLOWS.md?raw'
import programs from '../../../docs/PROGRAMS.md?raw'
import moveIn from '../../../docs/MOVE-IN.md?raw'
import backupRestore from '../../../docs/BACKUP-RESTORE.md?raw'
import drataImport from '../../../docs/DRATA-IMPORT.md?raw'
import agentCommands from '../../../docs/AGENT-COMMANDS.md?raw'
import api from '../../../docs/API.md?raw'
import { repository } from '../run'

export interface DocsPage { slug: string; file: string; title: string; summary: string; source: string }
export interface DocsSection { title: string; pages: DocsPage[] }
export interface TocEntry { id: string; text: string }

export const docsLead = 'Owner guides for running Evidence on your own computer: controls and proof, framework programs, tests and remediation, review folders, moving in from Drata and keeping a complete archive.'
export const docsSections: DocsSection[] = [
  { title: 'Start', pages: [
    { slug: 'getting-started', file: 'docs/GETTING-STARTED.md', title: 'Getting started', summary: 'Start Evidence with one line, confirm your owner account and keep your first proof.', source: gettingStarted },
    { slug: 'backup-restore', file: 'docs/BACKUP-RESTORE.md', title: 'Backup and restore', summary: 'Export the complete archive and restore it into an empty installation.', source: backupRestore },
  ] },
  { title: 'Use Evidence', pages: [
    { slug: 'main-flows', file: 'docs/MAIN-FLOWS.md', title: 'Controls, proof and review folders', summary: 'Write controls, keep proof with receipts, read each period honestly and share an expiring folder.', source: mainFlows },
    { slug: 'programs', file: 'docs/PROGRAMS.md', title: 'Programs, tests and remediation', summary: 'SOC 2, ISO 27001, HIPAA and PCI DSS programs, continuous tests, remediation clocks and risks.', source: programs },
  ] },
  { title: 'Move in', pages: [
    { slug: 'move-in', file: 'docs/MOVE-IN.md', title: 'Move in from Drata', summary: 'Check a Drata evidence ZIP, review the mapping, approve admission and undo it.', source: moveIn },
    { slug: 'drata-import', file: 'docs/DRATA-IMPORT.md', title: 'Drata import reference', summary: 'The supported package shape, limits and the provenance each admitted file keeps.', source: drataImport },
  ] },
  { title: 'Reference', pages: [
    { slug: 'agent-commands', file: 'docs/AGENT-COMMANDS.md', title: 'Agent folder preparation', summary: 'Give an agent prepare-only access and approve its exact folder proposal.', source: agentCommands },
    { slug: 'api', file: 'docs/API.md', title: 'Public API', summary: 'Tokens, scopes and the v1 calls for resources, evidence, tests and risks.', source: api },
  ] },
]
export const docsPages: DocsPage[] = docsSections.flatMap(section => section.pages)
export const docsSectionOf = (slug: string) => docsSections.find(section => section.pages.some(page => page.slug === slug))!.title
export function docsNeighbours(slug: string) {
  const index = docsPages.findIndex(page => page.slug === slug)
  return { previous: docsPages[index - 1], next: docsPages[index + 1] }
}

function resolveLink(href: string, file: string) {
  if (/^(?:https?:|mailto:|#)/i.test(href)) return href
  if (/^[a-z][a-z\d+.-]*:/i.test(href) || href.startsWith('//')) throw new Error(`Unsupported docs link: ${href}`)
  if (href.startsWith('/')) throw new Error(`Docs must name installation routes as text, not site links: ${href}`)
  const [path, fragment] = href.split('#', 2)
  const parts = [...file.split('/').slice(0, -1), ...path.split('/')]
  const normalized: string[] = []
  for (const part of parts) { if (part === '..') normalized.pop(); else if (part !== '.') normalized.push(part) }
  const target = normalized.join('/')
  const page = docsPages.find(page => page.file === target)
  return page ? `/docs/${page.slug}${fragment ? `#${fragment}` : ''}` : `${repository}/blob/main/${target}${fragment ? `#${fragment}` : ''}`
}
const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!))

/** Prose typesetting outside tags and code: a number keeps the word after it ("90 days") and an arrow keeps its neighbours. */
const typeset = (html: string) => html.split(/(<pre[\s\S]*?<\/pre>|<code[\s\S]*?<\/code>|<[^>]+>)/).map((part, index) => index % 2 ? part
  : part.replace(/(\d) (?=[a-z%])/g, '$1\u00a0').replace(/ → /g, '\u00a0→\u00a0')).join('')

/** The page's Markdown as HTML (its own H1 dropped: the page head carries the title), with its H2s for "On this page". */
export function renderMarkdown(page: DocsPage): { html: string; toc: TocEntry[] } {
  const headingIds = new Map<string, number>()
  const toc: TocEntry[] = []
  const markdown = new Marked({ gfm: true, breaks: false })
  markdown.use({ renderer: {
    html({ text }) { return escape(text) },
    link({ href, title, tokens }) { return `<a href="${escape(resolveLink(href, page.file))}"${title ? ` title="${escape(title)}"` : ''}>${this.parser.parseInline(tokens)}</a>` },
    image({ text }) { return escape(text) },
    heading({ tokens, depth }) {
      if (depth === 1) return ''
      const title = tokens.map(token => 'text' in token ? token.text : token.raw).join('')
      const base = title.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-')
      const count = headingIds.get(base) ?? 0
      headingIds.set(base, count + 1)
      const id = base + (count ? `-${count}` : '')
      if (depth === 2) toc.push({ id, text: title.replace(/`/g, '') })
      return `<h${depth} id="${escape(id)}">${this.parser.parseInline(tokens)}</h${depth}>`
    },
    code({ text, lang }) {
      return `<div class="docs-code"><pre${lang ? ` data-lang="${escape(lang)}"` : ''}><code>${escape(text)}</code></pre><button class="docs-copy" type="button" hidden>Copy</button></div>`
    },
  } })
  const html = typeset(markdown.parse(page.source, { async: false }) as string).replace(/<table>/g, '<div class="docs-table"><table>').replace(/<\/table>/g, '</table></div>')
  return { html, toc }
}
