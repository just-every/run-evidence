// Desk page 05: the Evidence agent, then the auditor workspace.
import { Pair } from '../parts'
import { Icon, Status } from '../icons'

const requests: [string, string, string][] = [['PBC-014', 'User access list', 'Okta export'], ['PBC-021', 'Change sample', '25 GitHub PRs'], ['PBC-033', 'Background checks', '6 new hires'], ['PBC-040', 'Laptop encryption', 're-tested Oct 15']]

export function Agent() {
  return <>
    <Pair id="agent" eyebrow="The Evidence agent" title={<>Failures traced, fixes proven.</>}
      lede="The agent traces a failed control to its cause, asks for one narrow fix and tests the real system again. The original failure stays on record beside the proof.">
      <div className="card agent-card">
        <h3><Icon name="sparkle" className="spark" />Investigation · CC7.2 Monitoring</h3>
        <ul>
          <li><span><b>Observed</b> · Oct 14, 2:00 AM · CloudTrail off in us-west-2</span><Status kind="fail" label="Failed" /></li>
          <li><span><b>Cause</b> · region added in Terraform PR #482 without a trail</span></li>
          <li><span><b>Fix</b> · PR #487 merged by Sam Patel · Oct 14</span><span className="row-icon"><Icon name="branch" /></span></li>
          <li><span><b>Re-tested</b> · 4 of 4 regions logging · Oct 14, 11:40 AM</span><Status kind="pass" label="Passing" /></li>
        </ul>
        <p className="card-foot">Original failure kept · receipt E-2291 · Q4 audit period</p>
      </div>
    </Pair>
    <Pair id="auditor" flip eyebrow="Auditor workspace" title={<>Everything your auditor asks for.</>}
      lede="Your auditor gets a workspace for the audit period. Each request links to tested proof with its source and time.">
      <div className="card audit-card">
        <h3>Q4 audit · Oct 1 – Dec 31 · Harbor &amp; Lane CPAs</h3>
        <span className="meter" role="img" aria-label="118 of 121 provided"><i style={{ width: `${118 / 121 * 100}%` }} /></span>
        <p className="audit-count">118 of 121 provided</p>
        <ul>{requests.map(([id, what, proof]) => <li key={id}><Status kind="pass" label="Provided" /><span><b>{id}</b> · {what} · {proof}</span></li>)}</ul>
      </div>
      <p className="chip chip-plain"><Status kind="wait" label="Moved" /><span>PBC-052 · dated Sep 28 <span className="arrow">→</span> moved to the Q3 list</span></p>
    </Pair>
  </>
}
