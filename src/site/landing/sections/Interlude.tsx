// Desk page 04: the pinned exhibit under the magnifier. The painted status card and the
// "Exhibit D" label were taken off the plate and are set here in type.
import { Art } from '../parts'
import { Icon } from '../icons'

export function Interlude() {
  return <section className="interlude" aria-label="SOC 2 Type II, 100% ready">
    <div className="interlude-stage">
      <Art name="interlude" width={1536} height={626} phone={{ name: 'interlude-phone', width: 1000, height: 626 }} />
      <span className="interlude-label" aria-hidden="true">Exhibit D</span>
      <div className="interlude-card">
        <span className="tile tone-solid-green"><Icon name="shieldHalf" /></span>
        <p><b>SOC 2 Type II</b><span>100% ready</span></p>
        <span className="meter" role="img" aria-label="100% ready"><i style={{ width: '100%' }} /></span>
        <small>Q4 audit period · Oct 1 – Dec 31</small>
      </div>
    </div>
  </section>
}
