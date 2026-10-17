import { links } from './links'

const Arrow = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3.5 12h16m-5.5-5.5 5.5 5.5-5.5 5.5" /></svg>

/** The primary pill to /run, then text links divided by hairlines. */
export function Actions({ demo = true, className = '' }: { demo?: boolean; className?: string }) {
  return <div className={`site-actions ${className}`.trim()}>
    <a className="site-pill" href={links.run}>Run Evidence <Arrow /></a>
    {demo ? <a className="site-link" href={links.demo}>Try the demo</a> : null}
    <a className="site-link" href={links.docs}>Read the docs</a>
  </div>
}
