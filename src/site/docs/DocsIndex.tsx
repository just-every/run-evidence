import { SiteFooter } from '../shell/SiteFooter'
import { SiteHeader } from '../shell/SiteHeader'
import { TitlePin } from './DocsNav'
import { docsLead, docsSections } from './pages'
import '../styles/site.css'
import '../styles/cards.css'
import '../styles/docs.css'

/** The docs home: each section as a row of white cards, each guide's title over its summary. */
export function DocsIndex() {
  return <div className="site docs">
    <SiteHeader current="docs" />
    <main id="main" className="docs-home">
      <header className="docs-home-head"><p className="eyebrow">Evidence</p><h1>Docs</h1><TitlePin /><p className="docs-summary">{docsLead}</p></header>
      {docsSections.map((section, index) => <section key={section.title} className="docs-home-section" aria-labelledby={`docs-section-${index}`}>
        <h2 id={`docs-section-${index}`}>{section.title}</h2>
        <ul className="docs-cards">{section.pages.map(page => <li key={page.slug}><a className="card docs-card" href={`/docs/${page.slug}`}><span className="docs-card-title">{page.title}</span><span className="docs-card-summary">{page.summary}</span><span className="docs-card-go" aria-hidden="true">→</span></a></li>)}</ul>
      </section>)}
      <p className="docs-caveat">A fingerprint proves unchanged bytes. It does not prove a control operated, and Evidence does not certify your business or replace an auditor.</p>
    </main>
    <SiteFooter />
  </div>
}
