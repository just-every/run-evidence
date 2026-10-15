import { createElement } from 'react'
import { runPageHtml, siteNotFoundHtml, type SiteBuild, type SiteContext } from '../base/run-site'
import { identity, run } from './run'
import { siteDocument } from './document'
import { Landing } from './landing/Landing'
import { Docs } from './docs/Docs'
import { docsPages } from './docs/pages'

/** Independent static run site; never imported by the installation's router. */
export function sitePages({ styles }: SiteContext): SiteBuild {
  return {
    pages: [
      { path: '/', html: siteDocument('Evidence: audit evidence, ready to share', 'Write controls, keep proof on schedule, see every gap and share an expiring folder. Free and open source, MIT licensed.', createElement(Landing), styles) },
      { path: '/run', html: runPageHtml(identity, run) },
      { path: '/docs', html: siteDocument('Docs · Evidence', 'Owner guides for running Evidence, keeping proof, sharing folders, moving in and restoring your archive.', createElement(Docs), styles) },
      ...docsPages.map(page => ({ path: `/docs/${page.slug}`, html: siteDocument(`${page.title} · Evidence docs`, page.description, createElement(Docs, { page }), styles) })),
      { path: '/404', html: siteNotFoundHtml(identity, run) },
    ],
    assets: ['rer-theme.css', 'fonts', 'brand'],
  }
}
