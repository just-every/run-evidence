// Desk page 03: remediation, then policies and people.
import { Pair } from '../parts'
import { Icon, Status } from '../icons'

const people: [string, string, string, boolean][] = [['AK', 'Amy Kim', 'signed Oct 2 · training done', true], ['MR', 'Marcus Reed', 'signed Oct 3 · training done', true], ['JL', 'Jenna Lopez', 'started Oct 13 · reminder sent', false]]

export function Remediation() {
  return <>
    <Pair id="remediation" eyebrow="Remediation" title={<>Every failure gets an owner.</>}
      lede="A failing test opens a task in Jira or Slack with an owner and a due date. Once it is fixed, Evidence tests it again on its own.">
      <div className="card timeline-card">
        <h3><span className="tile tone-red"><Icon name="laptop" /></span>CC6.8 · Laptop disk encryption</h3>
        <ol>
          <li><Status kind="fail" label="Failed" /><div><b>Failed</b> · Oct 14, 9:00 AM<span>1 laptop unencrypted</span></div></li>
          <li><span className="avatar tone-blue" aria-hidden="true">JR</span><div><b>Task SEC-212</b><span>Jordan Rivera · due Oct 16</span></div></li>
          <li><Status kind="pass" label="Fixed" /><div><b>Fixed</b> · FileVault turned on<span>Oct 15</span></div></li>
          <li className="done"><Status kind="pass" label="Re-tested" /><div><b>Re-tested</b> · 42 of 42 encrypted<span>Oct 15, 9:12 AM</span></div></li>
        </ol>
      </div>
    </Pair>
    <Pair id="policies" flip eyebrow="Policies and people" title={<>Policies signed, people trained.</>}
      lede="Start from templates, approve each policy once and collect a signature from everyone. Training, onboarding, offboarding and access reviews run from the same list.">
      <div className="card policy-card">
        <h3><span className="tile tone-blue"><Icon name="doc" /></span><span>Information Security Policy · v3<small>Approved Sep 30 by Dana Lee, CEO.</small></span></h3>
        <ul>{people.map(([initials, name, note, done], index) => <li key={name}>
          <span className={`avatar tone-${['blue', 'violet', 'amber'][index]}`} aria-hidden="true">{initials}</span>
          <span className="person"><b>{name}</b>{note}</span>
          {done ? <Status kind="pass" label="Signed" /> : <Status kind="wait" label="Waiting" />}
        </li>)}</ul>
        <p className="card-foot">41 of 42 signed.</p>
      </div>
    </Pair>
  </>
}
