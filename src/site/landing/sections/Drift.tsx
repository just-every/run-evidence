// page-s1 page-06: the Evidence agent's Jul 14 investigation, PR #482 to #487, failure E-2291 kept.
import { Band, Head } from '../parts'
import { Icon, Mark, Status } from '../icons'

export function Drift() {
  return <Band id="agent" className="band-half band-drift">
    <Head id="agent" eyebrow="Jul 14&nbsp;· The Evidence agent" title={<>Drift at 2:00&nbsp;AM,<br /> <span className="accent">proof by noon.</span></>}
      lede="The agent traces a failed test to its cause, asks for one narrow fix and tests the real system again. The original failure stays on the record." />
    <div className="drift-figure">
      <div className="card drift-card">
        <h3><Icon name="sparkles" className="sparkles" /><span>Investigation<span className="drift-sep">&nbsp;· </span><span className="drift-topic">CC7.2&nbsp;Monitoring</span></span></h3>
        <ol>
          <li><Status kind="fail" label="Failed" /><p><span className="time">2:00&nbsp;AM&nbsp;· </span><b>Observed</b></p><p>CloudTrail off in <span className="nowrap">us-west-2</span></p></li>
          <li><span className="step-mark"><Mark name="github" /></span><p><span className="time">2:06&nbsp;AM&nbsp;· </span><b>Traced</b></p><p>region added in Terraform PR #482 without a trail</p></li>
          <li><span className="step-mark avatar tone-blue" aria-hidden="true">SP</span><p><span className="time">2:09&nbsp;AM&nbsp;· </span><b>Fix requested</b></p><p>Sam Patel&nbsp;· add a trail to <span className="nowrap">us-west-2</span> only</p></li>
          <li className="drift-single"><span className="step-mark"><Mark name="github" /></span><p><span className="time">9:31&nbsp;AM&nbsp;· </span><b>PR #487 merged</b></p></li>
          <li className="drift-done"><Status kind="pass" label="Passing" /><p><span className="time">11:40&nbsp;AM&nbsp;· </span><b>Re-tested</b></p><p>4 of 4 regions logging</p></li>
        </ol>
        <p className="drift-foot">Failure E-2291 kept&nbsp;· linked to its fix and re-test</p>
      </div>
      <p className="drift-diff"><code>PR #487&nbsp;· terraform/cloudtrail.tf<span className="split-sep">&nbsp;· </span><span className="split"><ins>+6</ins> <del>−0</del></span></code></p>
    </div>
  </Band>
}
