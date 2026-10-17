// Desk page 06: the trust center, then moving in.
import { Pair } from '../parts'
import { Status } from '../icons'

const answers: [string, string, string | null][] = [
  ['Encrypt data at rest?', 'Yes, AES-256 on all 12 S3 buckets', 'Exhibit B'],
  ['MFA for all staff?', 'Yes, enforced in Okta for 42 users', 'Exhibit A'],
  ['SOC 2 Type II report?', 'Yes, in the trust center under NDA', 'Report'],
  ['Last pen test date', 'no proof on file → asked Dana Lee', null],
]
const imported: [string, string][] = [['Controls', '86'], ['Policies', '18'], ['Evidence files', '1,412'], ['Vendors', '37']]

export function Trust() {
  return <>
    <Pair id="trust" eyebrow="Trust center" title={<>Security questionnaires, answered.</>}
      lede="Publish a trust center for your customers. Evidence answers security questionnaires from verified proof, and every answer cites its source.">
      <div className="card questionnaire-card">
        <h3>Northwind Health · Security questionnaire · 184 questions</h3>
        <table>
          <tbody>{answers.map(([question, answer, cite]) => <tr key={question}>
            <th scope="row">{question}</th>
            <td className={cite ? undefined : 'muted'}>{answer}</td>
            <td>{cite ? <span className="cite">{cite}</span> : null}</td>
            <td>{cite ? <Status kind="pass" label="Answered" /> : <Status kind="wait" label="Waiting" />}</td>
          </tr>)}</tbody>
        </table>
        <p className="card-foot">181 of 184 answered from evidence.</p>
      </div>
    </Pair>
    <Pair id="moving-in" flip eyebrow="Moving in" title={<>Bring your program with you.</>}
      lede="Import controls, policies, evidence and vendors from Vanta, Drata or Secureframe, and check every count before you switch.">
      <div className="card import-card">
        <h3>Import from Drata</h3>
        <ul>{imported.map(([what, count]) => <li key={what}><span>{what}</span><b>{count}</b><Status kind="pass" label="Checked" /></li>)}</ul>
        <p className="card-foot"><span className="undo">Undo import</span></p>
      </div>
      <p className="chip chip-plain"><Status kind="pass" label="Mapped" /><span>4 custom controls <span className="arrow">→</span> mapped to SOC 2 CC6 and CC8.</span></p>
    </Pair>
  </>
}
