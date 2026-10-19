// The run site's homepage, built from the owner-approved page-s1 structure (17 Oct 2026): the hero, then
// the buyer's first SOC 2 Type II from March to December, the interlude, fieldwork, the trust center and the close.
import { Hero } from './Hero'
import { Timeline } from './sections/Timeline'
import { FirstScan, Fixing } from './sections/Scan'
import { Signed } from './sections/Signed'
import { DayRecord } from './sections/DayRecord'
import { Drift } from './sections/Drift'
import { Interlude } from './sections/Interlude'
import { Fieldwork } from './sections/Fieldwork'
import { TrustCenter, NextFramework } from './sections/TrustCenter'
import { Notes } from './sections/Notes'
import { Closing } from './sections/Closing'
import { SiteFooter } from '../shell/SiteFooter'
import '../styles/site.css'
import '../styles/hero.css'
import '../styles/sections.css'
import '../styles/cards.css'
import '../styles/timeline.css'
import '../styles/scan.css'
import '../styles/roster.css'
import '../styles/record.css'
import '../styles/drift.css'
import '../styles/interlude.css'
import '../styles/fieldwork.css'
import '../styles/trust.css'
import '../styles/notes.css'

export function Landing() {
  return <div className="site landing">
    <main id="main">
      <Hero />
      <Timeline />
      <FirstScan />
      <Fixing />
      <Signed />
      <DayRecord />
      <Drift />
      <Interlude />
      <Fieldwork />
      <TrustCenter />
      <NextFramework />
      <Notes />
      <Closing />
    </main>
    <SiteFooter />
  </div>
}
