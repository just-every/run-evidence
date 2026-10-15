import type { ReactNode } from 'react'
export function Section({ id, eyebrow, title, body, reverse, children }: { id: string; eyebrow: string; title: string; body: string; reverse?: boolean; children: ReactNode }) {
  return <section id={id} className={`landing-section${reverse ? ' section-reverse' : ''}`} aria-labelledby={`${id}-heading`}><div className="section-copy"><p className="section-eyebrow">{eyebrow}</p><h2 id={`${id}-heading`}>{title}</h2><p className="section-body">{body}</p></div><div className="section-drawing">{children}</div></section>
}
