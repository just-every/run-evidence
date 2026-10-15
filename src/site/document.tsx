import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

export function siteDocument(title: string, description: string, body: ReactElement, styles: string[]) {
  return '<!doctype html>' + renderToStaticMarkup(<html lang="en"><head><meta charSet="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>{title}</title><meta name="description" content={description} /><link rel="icon" href="/brand/mark.svg" /><link rel="stylesheet" href="/fonts/fonts.css" /><link rel="stylesheet" href="/rer-theme.css" />{styles.map(href => <link key={href} rel="stylesheet" href={href} />)}</head><body>{body}</body></html>)
}
