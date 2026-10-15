import { escape, icon } from './ui'
export interface PageOptions {
 active?: 'desk' | 'folders' | 'archive' | 'import' | 'agent'
 owner?: string
 heading?: boolean
 className?: string
 styles?: string[]
 scripts?: string[]
}
const links = [
 ['desk', '/app', 'Proof desk', 'home'],
 ['folders', '/app/folders', 'Review folders', 'folder'],
 ['archive', '/app/archive', 'Yours', 'person'],
 ['import', '/app/import', 'Move in', 'move'],
 ['agent', '/app/agent', 'Agent preparation', 'document'],
] as const
export function appShell(title: string, body: string, options: PageOptions = {}) {
 const owner = options.owner?.trim()
 const account = owner ? `<span class="app-account" aria-label="${escape('Signed in as '+owner)}"><span class="account-name">${escape(owner)}</span><span class="account-initial" aria-hidden="true">${escape(Array.from(owner)[0].toLocaleUpperCase())}</span></span>` : ''
 return `<a class="skip-link" href="#main">Skip to content</a><header class="app-header"><a class="app-brand" href="/app"><span class="evidence-mark" aria-hidden="true"></span><span data-rer-name>Evidence</span></a>${account}</header><div class="app-layout"><nav class="app-nav" aria-label="Evidence">${links.map(([key,href,label,glyph])=>`<a href="${href}"${(options.active ?? 'desk')===key?' aria-current="page"':''}>${icon(glyph)}<span>${label}</span></a>`).join('')}</nav><main id="main" class="app-main${options.className?' '+escape(options.className):''}">${options.heading===false?'':`<h1>${escape(title)}</h1>`}${body}<footer class="app-caveat">A stored fingerprint proves the bytes did not change, not that a control operated or that the exhibit is true. Evidence does not certify your business or replace an auditor.</footer></main></div>`
}
