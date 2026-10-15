import { SiteFooter, SiteHeader } from '../shell/SiteChrome'
import { Hero } from './Hero'
import { Section } from './Section'
import { LicenseDrawing } from './LicenseDrawing'
import { GapsDrawing } from './GapsDrawing'
import { ReceiptsDrawing } from './ReceiptsDrawing'
import { FolderDrawing } from './FolderDrawing'
import { Included } from './Included'
import { Closing } from './Closing'
import './landing.css'
import './acrylic.css'
import './landing-responsive.css'

export function Landing() {
  return <div id="top" className="evidence-site"><SiteHeader landing /><main>
    <Hero />
    <Section id="free" eyebrow="FREE" title="100% free. Yours to keep." body="MIT licensed. Run it yourself; every file and receipt stays with you."><LicenseDrawing /></Section>
    <Section id="gaps" eyebrow="HONEST GAPS" title="See every gap, honestly." body="Pick any date. Each control shows covered, due soon, overdue or missing. No green score to hide behind." reverse><GapsDrawing /></Section>
    <Section id="receipts" eyebrow="RECEIPTS" title="Proof that never changes." body="Every file gets a SHA-256 fingerprint. Replacing proof keeps the old file and its receipt."><ReceiptsDrawing /></Section>
    <Section id="folders" eyebrow="REVIEW FOLDERS" title="One link for the reviewer." body="Choose controls, dates and an expiry. They open it without an account. Close it any time." reverse><FolderDrawing /></Section>
    <Included /><Closing />
  </main><SiteFooter /></div>
}
