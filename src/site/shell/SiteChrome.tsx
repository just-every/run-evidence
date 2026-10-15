import { repository } from '../run'

export function Brand({ home = '/' }: { home?: string }) {
  return <a className="site-brand" href={home}><img src="/brand/mark.svg" width="32" height="32" alt="" /><span>Evidence</span></a>
}
export function SiteHeader({ landing = false }: { landing?: boolean }) {
  return <header className="site-header"><Brand home={landing ? '#top' : '/'} /><nav aria-label="Site"><a href="/docs">Docs</a><a href={repository}>Source</a></nav></header>
}
export function SiteFooter() {
  return <footer className="site-footer"><Brand /><nav aria-label="Footer"><a href="/docs">Docs</a><a href={repository}>Source</a><span>MIT licensed</span></nav></footer>
}
