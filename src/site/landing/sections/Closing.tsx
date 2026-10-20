// Desk page 09: the closing over the auditor's desk (a clean plate; the copy is type).
import { Actions } from '../../shell/Actions'
import { Art } from '../parts'

export function Closing() {
  return <section className="closing" aria-labelledby="closing-title">
      <div className="closing-stage">
        <Art name="closing" width={1536} height={914} phone={{ name: 'closing-phone', width: 1536, height: 584 }} />
        <div className="closing-copy">
          <h2 id="closing-title">Walk into every audit <span className="accent">calm.</span></h2>
          <p>Open source compliance for SOC 2, ISO&nbsp;27001 and HIPAA.</p>
          <Actions demo={false} />
          <p className="closing-note">Free and open source, MIT licensed.</p>
        </div>
      </div>
  </section>
}
