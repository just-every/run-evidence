import { Marked } from 'marked'
import readme from '../../../README.md?raw'
import gettingStarted from '../../../docs/GETTING-STARTED.md?raw'
import mainFlows from '../../../docs/MAIN-FLOWS.md?raw'
import moveIn from '../../../docs/MOVE-IN.md?raw'
import backupRestore from '../../../docs/BACKUP-RESTORE.md?raw'
import drataImport from '../../../docs/DRATA-IMPORT.md?raw'
import agentCommands from '../../../docs/AGENT-COMMANDS.md?raw'
import { repository } from '../run'

export interface DocsPage { slug: string; file: string; title: string; description: string; source: string }
export const docsPages: DocsPage[] = [
  { slug: 'getting-started', file: 'docs/GETTING-STARTED.md', title: 'Getting started', description: 'Run Evidence, confirm your owner account and keep your first proof.', source: gettingStarted },
  { slug: 'main-flows', file: 'docs/MAIN-FLOWS.md', title: 'Controls, proof and review folders', description: 'Write controls, keep proof, read gaps and share a folder.', source: mainFlows },
  { slug: 'move-in', file: 'docs/MOVE-IN.md', title: 'Move in from Drata', description: 'Check a ZIP, review the mapping, approve admission and undo an import.', source: moveIn },
  { slug: 'backup-restore', file: 'docs/BACKUP-RESTORE.md', title: 'Backup and restore', description: 'Export your complete archive and restore it into an empty installation.', source: backupRestore },
  { slug: 'agent-commands', file: 'docs/AGENT-COMMANDS.md', title: 'Agent folder preparation', description: 'Use prepare-only access and review exact folder proposals.', source: agentCommands },
  { slug: 'drata-import', file: 'docs/DRATA-IMPORT.md', title: 'Drata import reference', description: 'Supported package shape, limits, provenance and integration contract.', source: drataImport },
  { slug: 'readme', file: 'README.md', title: 'Repository guide', description: 'The repository README: run, use, deploy and develop Evidence.', source: readme },
]
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
export function renderMarkdown(page: DocsPage): string {
  const headingIds = new Map<string, number>()
  const markdown = new Marked({ gfm: true, breaks: false })
  markdown.use({ renderer: {
    html({ text }) { return escape(text) },
    link({ href, title, tokens }) { return `<a href="${escape(resolveLink(href, page.file))}"${title ? ` title="${escape(title)}"` : ''}>${this.parser.parseInline(tokens)}</a>` },
    image({ text }) { return escape(text) },
    heading({ tokens, depth }) {
      const title = tokens.map(token => 'text' in token ? token.text : token.raw).join('')
      const base = title.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-')
      const count = headingIds.get(base) ?? 0
      headingIds.set(base, count + 1)
      return `<h${depth} id="${escape(base + (count ? `-${count}` : ''))}">${this.parser.parseInline(tokens)}</h${depth}>`
    },
  } })
  return markdown.parse(page.source, { async: false })
}
