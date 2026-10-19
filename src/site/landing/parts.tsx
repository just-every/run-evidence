import type { ReactNode } from 'react'

/** A section's words: the dated eyebrow, the one-size heading and its lede. */
export function Head({ id, eyebrow, title, lede, className = '' }: { id: string; eyebrow: string; title: ReactNode; lede: ReactNode; className?: string }) {
  return <div className={`head ${className}`.trim()}>
    <p className="eyebrow">{eyebrow}</p>
    <h2 id={`${id}-title`}>{title}</h2>
    <p className="lede">{lede}</p>
  </div>
}

/** One band of the page: a full-width section holding the wrapped content. */
export function Band({ id, className, children }: { id: string; className: string; children: ReactNode }) {
  return <section className={`band ${className}`} id={id} aria-labelledby={`${id}-title`}><div className="wrap">{children}</div></section>
}

const WIDE = [768, 1152, 1536, 2304, 3072]

/** Responsive art: AVIF and WebP from 768 to 3072 wide (full-bleed up to 2560 at 1x and 1536 at 2x), with an optional phone crop. */
export function Art({ name, alt = '', width, height, phone, phoneMax = 760, sizes = '100vw', eager }: { name: string; alt?: string; width: number; height: number; phone?: { name: string; width: number; height: number }; phoneMax?: number; sizes?: string; eager?: boolean }) {
  const set = (ext: string) => WIDE.map(w => `/site/${name}-${w}.${ext} ${w}w`).join(', ')
  const phoneSet = (ext: string) => phone ? [640, 960].map(w => `/site/${phone.name}-${w}.${ext} ${w}w`).join(', ') : ''
  return <picture>
    {phone ? <source media={`(max-width: ${phoneMax}px)`} type="image/avif" srcSet={phoneSet('avif')} sizes="100vw" /> : null}
    {phone ? <source media={`(max-width: ${phoneMax}px)`} type="image/webp" srcSet={phoneSet('webp')} sizes="100vw" /> : null}
    <source type="image/avif" srcSet={set('avif')} sizes={sizes} />
    <source type="image/webp" srcSet={set('webp')} sizes={sizes} />
    <img src={`/site/${name}-1536.webp`} width={width} height={height} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" fetchPriority={eager ? 'high' : undefined} />
  </picture>
}
