// page-s1 page-07: the pinned Exhibit D under the magnifier. The plate (public/site/exhibit-*) has a blank
// card face; its record is set here in type at the card's tilt, and the status card lies flat beside it.
// Below 1000 px the plate is cropped to the card and magnifier and the status card stacks below.
import { Art } from '../parts'
import { Icon, Status } from '../icons'

export function Interlude() {
  return <section className="interlude" aria-label="Exhibit D: CC7.2 Monitoring, 183 of 183 days tested. SOC 2 Type II, 100% ready.">
    <div className="interlude-stage">
      <Art name="exhibit" width={1536} height={626} phone={{ name: 'exhibit-phone', width: 760, height: 530 }} phoneMax={999} />
      <div className="exhibit-face">
        <p className="exhibit-title">Exhibit D</p>
        <p className="exhibit-record"><b>CC7.2 Monitoring</b><span>183 of 183 days tested</span><span>E-2291 fixed Jul 14 <Status kind="pass" label="Fixed" /></span></p>
      </div>
      <div className="interlude-card">
        <span className="tile tone-solid-green"><Icon name="shieldCheck" /></span>
        <p><b>SOC 2 Type II</b><span>100% ready</span></p>
        <span className="meter" role="img" aria-label="100% ready"><i style={{ width: '100%' }} /></span>
        <small>Sep 30&nbsp;· Window closed&nbsp;· Fieldwork Nov 2</small>
      </div>
    </div>
  </section>
}
