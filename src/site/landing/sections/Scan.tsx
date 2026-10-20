// page-s1 page-03: the first scan on Mar 4, then each gap fixed and tested again by Mar 30.
import { Band, Head } from '../parts'
import { Icon, Mark, Status, type MarkName } from '../icons'

// Gaps per system on the first scan; they sum to the 31 of 86 controls to fix.
const gaps: [MarkName | 'policies', string, number, string][] = [
  ['aws', 'AWS', 9, 'CloudTrail off in 2 regions'],
  ['github', 'GitHub', 6, 'No branch protection on 3 repos'],
  ['okta', 'Okta', 4, 'MFA not enforced for 5 users'],
  ['jamf', 'Jamf', 3, '4 laptops unencrypted'],
  ['policies', 'Policies', 7, 'Not yet written'],
  ['rippling', 'Rippling', 2, '3 leavers still active in Okta'],
]

export function FirstScan() {
  return <Band id="first-scan" className="band-half band-scan">
    <Head id="first-scan" eyebrow="Mar 4&nbsp;· Day one" title="Every gap, found on day one."
      lede="Connect your cloud, code, identity, HR and device systems once. The first scan tests every SOC&nbsp;2&nbsp;control and names what fails." />
    <div className="scan-figure">
      <div className="card scan-card">
        <p className="scan-when">First scan&nbsp;· Mar 4, 10:12&nbsp;AM</p>
        <p className="scan-total"><b>86 controls</b>&nbsp;· <span className="pass">55 passing</span>&nbsp;· <span className="fail">31 to fix</span></p>
        <ul>{gaps.map(([mark, name, count, note]) => <li key={name}>
          <span className="scan-mark">{mark === 'policies' ? <Icon name="doc" /> : <Mark name={mark} />}</span>
          <b className="scan-name">{name}</b>
          <span className="scan-count" aria-label={`${count} to fix`}>{count}</span>
          <span className="scan-note">{note}</span>
        </li>)}</ul>
      </div>
      <p className="chip chip-plain scan-chip"><Status kind="pass" label="Connected" /><span><b>Connected in 11 minutes:</b> AWS, GitHub, Okta, Jamf, Rippling, Google Workspace</span></p>
    </div>
  </Band>
}

export function Fixing() {
  return <Band id="fixing" className="band-half band-fixing">
    <Head id="fixing" eyebrow="Mar 4&nbsp;– Mar 30&nbsp;· Fixing" title="Each fix gets tested again."
      lede="Each failing test becomes a task for the person who can fix it, in Slack or Jira. When the fix lands, Evidence runs the test again." />
    <div className="fix-figure">
      <div className="card cq slack-card">
        <p className="slack-channel"><Mark name="slack" />#security</p>
        <div className="slack-thread">
          <div className="slack-message">
            <span className="app-tile"><img src="/brand/mark.svg" alt="" width="24" height="24" /></span>
            <div>
              <b>Evidence</b>
              <p>GitHub&nbsp;· branch protection off on <span className="nowrap">3 of 14 repos&nbsp;· CC8.1</span></p>
              <p className="slack-owner"><span className="avatar tone-blue" aria-hidden="true">SP</span>Owner: Sam Patel&nbsp;· due Mar 12</p>
            </div>
          </div>
          <div className="slack-message slack-reply">
            <span className="app-tile"><img src="/brand/mark.svg" alt="" width="24" height="24" /></span>
            <div>
              <b>Evidence</b>
              <p className="slack-pass"><Status kind="pass" label="Passing" /><span>Re-tested Mar 11, 10:42&nbsp;AM<span className="cq-sep">&nbsp;· </span><span className="cq-split">14 of 14 protected</span></span></p>
            </div>
          </div>
        </div>
      </div>
      <div className="card gaps-card">
        <p className="gaps-label">Gaps</p>
        <p className="gaps-figure">31 <Icon name="arrow" /> 0</p>
        <span className="meter" role="img" aria-label="31 gaps closed"><i style={{ width: '100%' }} /></span>
        <p className="gaps-date">Mar 30</p>
      </div>
    </div>
  </Band>
}
