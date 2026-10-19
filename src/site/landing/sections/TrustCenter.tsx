// page-s1 page-09: the bank's questionnaire answered from the trust center on Dec 9, then ISO 27001
// added on the same tests.
import { Band, Head } from '../parts'
import { Icon, Status } from '../icons'

const answers: [string, string, string][] = [
  ['Encrypt data at rest?', 'AES-256 on all 12 S3 buckets', 'Exhibit B'],
  ['MFA for all staff?', 'Enforced in Okta, 42 users', 'Exhibit A'],
  ['SOC 2 Type II report?', 'Issued Dec 9, no exceptions', 'Report'],
  ['Change review?', '25 of 25 sampled PRs reviewed', 'PBC-021'],
]

export function TrustCenter() {
  return <Band id="trust" className="band-half band-trust">
    <Head id="trust" eyebrow="Dec 9&nbsp;· Trust center" title="Every answer cites its proof."
      lede="Publish your report in a trust center. Evidence answers security questionnaires from verified proof, and every answer cites its source." />
    <div className="trust-figure">
      <p className="trust-chip"><Icon name="shieldHalf" /><span><b>Larkspur Trust Center</b>&nbsp;· SOC 2 Type II</span></p>
      <div className="card cq answers-card">
        <h3><b>Bank vendor security review</b><span className="cq-sep">&nbsp;· </span><span className="cq-split">212 questions</span></h3>
        <ul>{answers.map(([question, answer, cite]) => <li key={question}>
          <p><b>{question}</b><span className="answers-sep">&nbsp;· </span><span className="answers-text">{answer}</span></p>
          <span className="cite">{cite}</span>
          <Status kind="pass" label="Answered" />
        </li>)}</ul>
        <p className="answers-foot"><Status kind="wait" label="Waiting" /><span>209 answered from evidence<span className="cq-sep">&nbsp;· </span><span className="cq-split">3 sent to Dana Lee</span></span></p>
      </div>
    </div>
  </Band>
}

const mapped: [string, string | null, boolean][] = [
  ['A.5.15 Access control', 'CC6.1', true],
  ['A.8.24 Cryptography', 'CC6.7', true],
  ['A.5.24 Incident management planning', null, false],
]

export function NextFramework() {
  return <Band id="frameworks" className="band-half band-framework">
    <Head id="frameworks" eyebrow="Next year&nbsp;· ISO 27001" title={<>One more framework,<br /> same tests.</>}
      lede="SOC 2, ISO 27001 and HIPAA share controls, so one passing test counts everywhere it applies." />
    <div className="card cq iso-card">
      <h3><b>Add framework</b>&nbsp;· ISO 27001:2022</h3>
      <p className="iso-total">71 of 93 controls already tested</p>
      <span className="meter" role="img" aria-label="71 of 93 controls"><i style={{ width: `${71 / 93 * 100}%` }} /></span>
      <ul>{mapped.map(([control, from, done]) => <li key={control}>
        <p>{control}{from ? <span className="iso-from"><Icon name="arrowBack" />{from}</span> : <><span className="cq-sep">&nbsp;· </span><span className="iso-new cq-split">new&nbsp;· <span className="nowrap">owner Dana Lee</span></span></>}</p>
        {done ? <Status kind="pass" label="Already tested" /> : <Status kind="wait" label="To do" />}
      </li>)}</ul>
    </div>
  </Band>
}
