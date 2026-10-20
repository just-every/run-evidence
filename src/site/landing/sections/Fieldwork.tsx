// page-s1 page-08: the auditor's request list at fieldwork (Nov 2, a Monday). At 390 the table becomes
// stacked cards under a header card (phone-08).
import { Band, Head } from '../parts'
import { Icon, Mark, Status, type MarkName } from '../icons'

type Request = { id: string; title: string; proof: string; source: { mark?: MarkName; name: string }; provided: string; late?: boolean; drift?: boolean }

const requests: Request[] = [
  { id: 'PBC-003', title: 'Employee list at period end', proof: 'Export of 42 employees, Sep 30', source: { mark: 'rippling', name: 'Rippling' }, provided: 'Nov 2' },
  { id: 'PBC-014', title: 'User access list', proof: '42 users with roles', source: { mark: 'okta', name: 'Okta' }, provided: 'Nov 2' },
  { id: 'PBC-021', title: 'Sample of 25 changes', proof: '25 PRs, each reviewed and checked', source: { mark: 'github', name: 'GitHub' }, provided: 'Nov 2' },
  { id: 'PBC-027', title: 'Laptop encryption', proof: '183 daily test results', source: { mark: 'jamf', name: 'Jamf' }, provided: 'Nov 2' },
  { id: 'PBC-033', title: 'Background checks, new hires', proof: '6 of 6 cleared', source: { name: 'Checkr' }, provided: 'Nov 2' },
  { id: 'PBC-041', title: 'CC7.2 drift, Jul 14', proof: 'Failure E-2291, fix and re-test', source: { mark: 'github', name: 'GitHub PR #487' }, provided: 'Nov 2', drift: true },
  { id: 'PBC-058', title: 'Board minutes', proof: 'Uploaded by Dana Lee', source: { mark: 'pdf', name: 'PDF' }, provided: 'Nov 4', late: true },
  { id: 'PBC-064', title: 'Penetration test', proof: 'Report dated Aug 20', source: { mark: 'pdf', name: 'PDF' }, provided: 'Nov 2' },
]

export function Fieldwork() {
  return <Band id="auditor" className="band-fieldwork">
    <Head id="auditor" className="head-wide" eyebrow="Nov 2&nbsp;· Fieldwork" title={<>121 requests, <br />answered from&nbsp;proof.</>}
      lede="Your auditor gets a workspace for your audit period. Each request links to tested proof with its source and time." />
    <div className="card pbc-card">
      <div className="pbc-head">
        <h3><b>Harbor &amp; Lane CPAs</b><span className="pbc-sep">&nbsp;· </span><span className="pbc-scope">SOC 2 Type II<span className="pbc-sep pbc-period-sep">&nbsp;· </span><span className="pbc-period">Apr 1&nbsp;– Sep 30, 2026</span></span></h3>
        <span className="meter" role="img" aria-label="121 of 121 provided"><i style={{ width: '100%' }} /></span>
        <p className="pbc-count">121 of 121 provided</p>
      </div>
      <table>
        <thead><tr><th scope="col">Request</th><th scope="col">Proof attached</th><th scope="col">Source</th><th scope="col">Provided</th><th scope="col"><span className="visually-hidden">Status</span></th></tr></thead>
        <tbody>{requests.map(request => <tr key={request.id} className={request.drift ? 'pbc-drift' : undefined}>
          <th scope="row"><b>{request.id}</b> {request.title}</th>
          <td className="pbc-proof">{request.proof}</td>
          <td className="pbc-source"><span className="source-tag">{request.source.mark ? <Mark name={request.source.mark} /> : <Icon name="shieldCheck" />}{request.source.name}</span></td>
          <td className="pbc-provided"><span className="pbc-phone-word">Provided </span>{request.late ? <Status kind="wait" label="Late" /> : null}{request.provided}</td>
          <td className="pbc-status"><Status kind="pass" label="Provided" /></td>
        </tr>)}</tbody>
      </table>
    </div>
  </Band>
}
