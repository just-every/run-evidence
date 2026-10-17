import { Lockup } from './Lockup'
import { links } from './links'

export function SiteHeader({ current }: { current?: 'docs' }) {
  return <header className="site-header">
    <a className="skip-link" href="#main">Skip to content</a>
    <div className="site-header-row">
      <Lockup />
      <nav aria-label="Site"><a href={links.docs} aria-current={current === 'docs' ? 'page' : undefined}>Docs</a><a href={links.contract}>Contract</a><a href={links.source}>Source</a></nav>
    </div>
  </header>
}
