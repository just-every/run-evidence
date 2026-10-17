import { Lockup } from './Lockup'
import { links } from './links'

export function SiteFooter() {
  return <footer className="site-footer">
    <div className="site-footer-row">
      <Lockup />
      <nav aria-label="Footer"><a href={links.docs}>Docs</a><a href={links.source}>Source</a><a href={links.licence}>MIT licensed</a></nav>
    </div>
  </footer>
}
