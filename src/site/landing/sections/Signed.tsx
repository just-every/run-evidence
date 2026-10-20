// page-s1 page-04: the policy everyone signed, with the one reminder and the new hire. At 390 the
// roster folds to six faces and "+36", and the policies to four chips and "+14 more" (phone-04).
import { Band, Head } from '../parts'
import { Icon, Status } from '../icons'

// 42 people, in the order the roster lists them; JL is the newest hire, RV needed a reminder.
const people = [
  'JL', 'DL', 'SP', 'AK', 'MR', 'PS', 'TO',
  'CB', 'EH', 'NG', 'BW', 'MS', 'KT', 'AR',
  'DC', 'LH', 'JM', 'RS', 'TN', 'EK', 'GP',
  'SW', 'AB', 'MC', 'HL', 'NP', 'JW', 'CR',
  'DM', 'RV', 'KB', 'LT', 'AS', 'BH', 'MJ',
  'EP', 'RG', 'SK', 'TW', 'CM', 'AL', 'JH',
]
// Each face's tint, in roster order: six of each, never the same tint beside, above or diagonal to its neighbour.
const tints = 'vgbvamgbsarbvaarmgsrmmvbavgbrgsrmassmvbsrg'
const tones: Record<string, string> = { b: 'blue', m: 'mint', a: 'amber', v: 'violet', s: 'sky', r: 'rose', g: 'green' }
const faces = ['DL', 'SP', 'AK', 'MR', 'PS', 'TO']
const policies = ['Access Control', 'Incident Response', 'Change Management', 'Vendor Management', 'Business Continuity', 'Data Retention', 'Acceptable Use', 'Encryption']
const phonePolicies = new Set(['Access Control', 'Incident Response', 'Change Management', 'Encryption'])
const tone = (initials: string) => tones[tints[people.indexOf(initials)]]

export function Signed() {
  return <Band id="policies" className="band-signed">
    <Head id="policies" className="head-wide" eyebrow={<>Mar 16&nbsp;– Mar 25<span className="narrow-sep">&nbsp;· </span><span className="narrow-line">Policies and people</span></>} title="Signed by everyone."
      lede="Start from templates, approve each policy once, then every person signs and finishes training. New hires get the same list on day one." />
    <div className="card roster-card">
      <header className="roster-head">
        <h3>Information Security Policy&nbsp;·&nbsp;v1</h3>
        <p>Approved Mar 16 by Dana Lee, CEO</p>
      </header>
      <div className="roster-body">
        <ul className="roster-grid" aria-label="42 of 42 people signed">{people.map(initials => <li key={initials} className={`face tone-${tone(initials)}${initials === 'JL' ? ' face-new' : ''}${initials === 'RV' ? ' face-reminded' : ''}`}>
          {initials}
          {initials === 'RV' ? <span className="face-bell"><Icon name="bell" /></span> : null}
          <Status kind="pass" label="Signed" />
        </li>)}</ul>
        <div className="roster-phone">
          <p className="roster-total">42 of 42 signed <Status kind="pass" label="Done" /></p>
          <ul className="roster-faces" aria-label="Six of the 42 who signed, and 36 more">{faces.map(initials => <li key={initials} className={`face tone-${tone(initials)}`}>{initials}</li>)}<li className="face face-more">+36</li></ul>
          <p className="roster-total">42 of 42 trained <Status kind="pass" label="Done" /></p>
        </div>
        <div className="roster-policies">
          <ul>{policies.map(name => <li key={name} className={phonePolicies.has(name) ? undefined : 'roster-desk-only'}><Icon name="doc" />{name}</li>)}<li className="roster-more"><Icon name="doc" />+14 more</li></ul>
          <p className="roster-count">18 policies</p>
        </div>
      </div>
      <footer className="roster-foot">
        <p className="roster-totals"><span><Status kind="pass" label="Done" />42 of 42 signed</span><span><Status kind="pass" label="Done" />42 of 42 trained</span></p>
        <ul className="roster-notes">
          <li className="roster-reminded"><span className="roster-icon"><Icon name="bell" /></span><Status kind="pass" label="Signed" /><p><b>RV&nbsp;· Riya Varma</b><span>reminded Mar 19&nbsp;· signed Mar 20</span></p></li>
          <li className="roster-joined"><span className="roster-icon"><Icon name="user" /></span><Status kind="pass" label="Signed and trained" /><p><b>JL&nbsp;· Jenna Lopez</b><span>joined Mar 25&nbsp;· signed and trained day one</span></p></li>
        </ul>
      </footer>
    </div>
  </Band>
}
