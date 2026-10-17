import { SiteFooter } from '../shell/SiteFooter'
import { SiteHeader } from '../shell/SiteHeader'
import { DocsMenu, DocsSidebar, TitlePin } from './DocsNav'
import { docsNeighbours, docsPages, docsSectionOf, renderMarkdown } from './pages'
import '../styles/site.css'
import '../styles/cards.css'
import '../styles/docs.css'

/** One guide: the section sidebar, the article rendered from Markdown at build time, "On this page", and previous and next. */
export function DocsArticle({ slug }: { slug: string }) {
  const page = docsPages.find(page => page.slug === slug)!
  const { html, toc } = renderMarkdown(page)
  const { previous, next } = docsNeighbours(slug)
  return <div className="site docs">
    <SiteHeader current="docs" />
    <div className="docs-shell">
      <DocsSidebar current={slug} />
      <main id="main" className="docs-main">
        <DocsMenu current={slug} />
        <article aria-labelledby="docs-title">
          <header className="docs-page-head"><p className="eyebrow">{docsSectionOf(slug)}</p><h1 id="docs-title">{page.title}</h1><TitlePin /><p className="docs-summary">{page.summary}</p></header>
          <div className="docs-prose" dangerouslySetInnerHTML={{ __html: html }} />
        </article>
        <nav className="docs-pager" aria-label="Previous and next">
          {previous ? <a className="card docs-pager-link" href={`/docs/${previous.slug}`} rel="prev"><span>Previous</span>{previous.title}</a> : <span />}
          {next ? <a className="card docs-pager-link next" href={`/docs/${next.slug}`} rel="next"><span>Next</span>{next.title}</a> : <span />}
        </nav>
      </main>
      {toc.length > 1 ? <nav className="docs-toc" aria-label="On this page"><p>On this page</p><ul>{toc.map(entry => <li key={entry.id}><a href={`#${entry.id}`}>{entry.text}</a></li>)}</ul></nav> : <span />}
    </div>
    <SiteFooter />
  </div>
}
