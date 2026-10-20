import { escape, icon, type IconName } from './ui'
import { usRange } from './format'
export interface ShellProgram { id: string; label: string; name: string; from: string; to: string }
export interface ShellFacts { programs: ShellProgram[]; selected: ShellProgram | null; failingTests: number }
// The request-scoped facts the top bar and rail show. The Worker entry registers
// the reader (shell-context.ts), so page renderers stay free of runtime imports.
let readFacts: () => Promise<ShellFacts | null> = async () => null
export const provideShellFacts = (reader: typeof readFacts) => { readFacts = reader }
export const shellFacts = () => readFacts()
export type NavKey = 'desk' | 'programs' | 'tests' | 'remediation' | 'vulnerabilities' | 'policies' | 'people' | 'vendors' | 'risks' | 'connections' | 'folders' | 'agent' | 'import' | 'archive' | 'audit'
export interface PageOptions {
 active?: NavKey
 owner?: string
 heading?: boolean
 className?: string
 styles?: string[]
 scripts?: string[]
}
// The daily program work, then custody: review folders, the agent, move-in and export.
const work: [NavKey, string, string, IconName][] = [
 ['desk', '/app', 'Proof desk', 'home'],
 ['programs', '/app/programs', 'Programs', 'shield'],
 ['tests', '/app/tests', 'Tests', 'pulse'],
 ['remediation', '/app/remediation', 'Remediation', 'alert'],
 ['vulnerabilities', '/app/vulnerabilities', 'Vulnerabilities', 'bug'],
 ['policies', '/app/policies', 'Policies', 'document'],
 ['people', '/app/people', 'People', 'people'],
 ['vendors', '/app/vendors', 'Vendors', 'building'],
 ['risks', '/app/risks', 'Risks', 'scale'],
 ['connections', '/app/connections', 'Connections', 'plug'],
]
const custody: [NavKey, string, string, IconName][] = [
 ['folders', '/app/folders', 'Review folders', 'folder'],
 ['agent', '/app/agent', 'Agent preparation', 'spark'],
 ['import', '/app/import', 'Move in', 'move'],
 ['archive', '/app/archive', 'Yours', 'archive'],
 ['audit', '/app/audit', 'Audit', 'shield'],
]
function navLinks(items: typeof work, active: NavKey, failing: number) {
 return items.map(([key, href, label, glyph]) => `<a href="${href}"${active === key ? ' aria-current="page"' : ''}>${icon(glyph)}<span>${label}</span>${key === 'tests' && failing ? `<span class="nav-count" aria-label="${failing} failing">${failing}</span>` : ''}</a>`).join('')
}
// The audit program in scope: a menu of every program and its audit period.
function programSwitch(facts: ShellFacts | null) {
 if (!facts) return ''
 const selected = facts.selected
 const menu = facts.programs.map(p => `<a href="/app/programs/${p.id}"${p.id === selected?.id ? ' aria-current="true"' : ''}><strong>${escape(p.name)}</strong><span>${escape(p.label)} · ${escape(usRange(p.from, p.to))}</span></a>`).join('')
 return `<div class="program-scope"><details class="program-switch"><summary aria-label="Audit program">${escape(selected?.label ?? 'No program yet')}</summary><div class="program-menu">${menu}<a class="program-new" href="/app/programs#create-program-title">Start a program</a></div></details>${selected ? `<span class="program-period">${escape(usRange(selected.from, selected.to))}</span>` : ''}</div>`
}
export function appShell(title: string, body: string, options: PageOptions = {}, facts: ShellFacts | null = null) {
 const owner = options.owner?.trim(), active = options.active ?? 'desk', failing = facts?.failingTests ?? 0
 const account = owner ? `<span class="app-account" aria-label="${escape('Signed in as ' + owner)}"><span class="account-name">${escape(owner)}</span><span class="account-initial" aria-hidden="true">${escape(Array.from(owner)[0].toLocaleUpperCase())}</span></span>` : ''
 return `<a class="skip-link" href="#main">Skip to content</a><div class="app-frame"><aside class="app-rail"><a class="app-brand" href="/app"><img class="evidence-mark" src="/brand/mark.svg" width="36" height="36" alt=""><span data-rer-name>Evidence</span></a><nav class="app-nav" aria-label="Evidence">${navLinks(work, active, failing)}<span class="nav-rule" role="presentation"></span>${navLinks(custody, active, failing)}</nav></aside><div class="app-body"><header class="app-topbar">${programSwitch(facts)}${account}</header><main id="main" class="app-main${options.className ? ' ' + escape(options.className) : ''}">${options.heading === false ? '' : `<h1>${escape(title)}</h1>`}${body}<footer class="app-caveat">A stored fingerprint proves the bytes did not change, not that a control operated or that the exhibit is true. Evidence does not certify your business or replace an auditor.</footer></main></div></div>`
}
