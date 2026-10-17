// The run site's homepage, built from the approved desk pages 01–09 in order.
import { Hero } from './Hero'
import { Frameworks } from './sections/Frameworks'
import { Remediation } from './sections/Remediation'
import { Interlude } from './sections/Interlude'
import { Agent } from './sections/Agent'
import { Trust } from './sections/Trust'
import { Ownership } from './sections/Ownership'
import { Details } from './sections/Details'
import { Closing } from './sections/Closing'
import { SiteFooter } from '../shell/SiteFooter'
import '../styles/site.css'
import '../styles/hero.css'
import '../styles/sections.css'
import '../styles/cards.css'

export function Landing() {
  return <div className="site landing">
    <main id="main">
      <Hero />
      <div className="page-band"><Frameworks /></div>
      <div className="page-band"><Remediation /></div>
      <Interlude />
      <div className="page-band"><Agent /></div>
      <div className="page-band"><Trust /></div>
      <Ownership />
      <Details />
      <Closing />
    </main>
    <SiteFooter />
  </div>
}
