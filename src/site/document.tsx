import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { identity } from './run'

const SHARE_IMAGE = `${identity.runSite}/site/share.jpg`

/** One run-site page: favicons, share card, self-hosted fonts, the shared tokens and the page's own sheets. */
export function siteDocument(title: string, description: string, body: ReactElement, styles: string[], script = '') {
  return '<!doctype html>' + renderToStaticMarkup(<html lang="en">
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="theme-color" content="#f4f9fe" />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="Evidence" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={SHARE_IMAGE} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta name="twitter:card" content="summary_large_image" />
      <link rel="icon" href="/favicon.ico" sizes="32x32" />
      <link rel="icon" type="image/svg+xml" href="/brand/favicon-32.svg" />
      <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      <link rel="preload" href="/fonts/schibsted-grotesk/schibsted-grotesk-latin-wght-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      <link rel="preload" href="/fonts/onest/onest-latin-wght-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      {identity.fonts && <link rel="stylesheet" href={identity.fonts} />}
      <link rel="stylesheet" href={identity.theme} />
      {styles.map(href => <link key={href} rel="stylesheet" href={href} />)}
    </head>
    <body>{body}{script ? <script dangerouslySetInnerHTML={{ __html: script }} /> : null}</body>
  </html>)
}
