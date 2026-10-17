import type { ReactNode } from 'react'

/** One feature section: eyebrow, heading and lede beside its drawing (figure first when flipped). */
export function Pair({ id, eyebrow, title, lede, flip, children }: { id: string; eyebrow: string; title: ReactNode; lede: ReactNode; flip?: boolean; children: ReactNode }) {
  return <section className={`pair${flip ? ' pair-flip' : ''}`} id={id} aria-labelledby={`${id}-title`}>
    <div className="pair-copy">
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={`${id}-title`}>{title}</h2>
      <p className="lede">{lede}</p>
    </div>
    <div className="pair-figure">{children}</div>
  </section>
}

/** Responsive art: AVIF and WebP at 768, 1152 and 1536 wide, with an optional phone crop. */
export function Art({ name, alt = '', width, height, phone, sizes = '100vw', eager }: { name: string; alt?: string; width: number; height: number; phone?: { name: string; width: number; height: number }; sizes?: string; eager?: boolean }) {
  const set = (ext: string) => [768, 1152, 1536].map(w => `/site/${name}-${w}.${ext} ${w}w`).join(', ')
  const phoneSet = (ext: string) => phone ? [640, 960].map(w => `/site/${phone.name}-${w}.${ext} ${w}w`).join(', ') : ''
  return <picture>
    {phone ? <source media="(max-width: 760px)" type="image/avif" srcSet={phoneSet('avif')} sizes="100vw" /> : null}
    {phone ? <source media="(max-width: 760px)" type="image/webp" srcSet={phoneSet('webp')} sizes="100vw" /> : null}
    <source type="image/avif" srcSet={set('avif')} sizes={sizes} />
    <source type="image/webp" srcSet={set('webp')} sizes={sizes} />
    <img src={`/site/${name}-1536.webp`} width={width} height={height} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" fetchPriority={eager ? 'high' : undefined} />
  </picture>
}
