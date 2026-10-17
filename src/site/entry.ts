import { createElement } from 'react'
import { contractPageHtml } from '../base/contract-page'
import { runPageHtml, siteNotFoundHtml, type SiteBuild, type SiteContext } from '../base/run-site'
import { identity, run } from './run'
import { siteDocument } from './document'
import { Landing } from './landing/Landing'
import { DocsIndex } from './docs/DocsIndex'
import { DocsArticle } from './docs/DocsArticle'
import { docsLead, docsPages } from './docs/pages'

// Code cards get their Copy button only when script runs; without it the command is still there to select.
const COPY = "document.querySelectorAll('.docs-copy').forEach(b=>{b.hidden=false;b.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(b.parentElement.querySelector('code').textContent);b.textContent='Copied';setTimeout(()=>{b.textContent='Copy'},1600)}catch{}})})"

/** Independent static run site; never imported by the installation's router. */
export function sitePages({ styles, contract }: SiteContext): SiteBuild {
  return {
    pages: [
      { path: '/', html: siteDocument('Evidence: ready for the audit, any day', identity.tagline, createElement(Landing), styles) },
      { path: '/run', html: runPageHtml(identity, run, contract) },
      ...(contract ? [{ path: '/contract', html: contractPageHtml(identity, run, contract) }] : []),
      { path: '/docs', html: siteDocument('Docs · Evidence', docsLead, createElement(DocsIndex), styles) },
      ...docsPages.map(page => ({ path: `/docs/${page.slug}`, html: siteDocument(`${page.title} · Evidence docs`, page.summary, createElement(DocsArticle, { slug: page.slug }), styles, COPY) })),
      { path: '/404', html: siteNotFoundHtml(identity, run, contract) },
    ],
    assets: ['rer-theme.css', 'fonts', 'brand', 'site', 'favicon.ico', 'apple-touch-icon.png'],
  }
}
