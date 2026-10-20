// page-s1 page-10: the switcher's note with the import counts, then the honest limit.
import { links } from '../../shell/links'
import { Icon, Status } from '../icons'

const counts = ['86 controls', '18 policies', '1,412 evidence files', '37 vendors']

export function Notes() {
  return <section className="band band-notes" id="moving-in" aria-label="Moving in, and what Evidence is not">
    <div className="wrap">
      <div className="card note-card note-import">
        <span className="note-icon"><Icon name="signIn" /></span>
        <div className="note-copy">
          <h3>Coming from Vanta, Drata&nbsp;or&nbsp;Secureframe?</h3>
          <p>Import controls, policies, evidence and vendors, and check every count before you switch.</p>
        </div>
        <ul className="note-counts" aria-label="Checked after import">{counts.map(count => <li key={count}><Status kind="pass" label="Checked" />{count}</li>)}</ul>
      </div>
      <div className="card note-card note-limit">
        <span className="note-icon"><Icon name="pen" /></span>
        <div className="note-copy">
          <h3>Your auditor still signs.</h3>
          <p>Evidence is not an auditor. A licensed CPA firm still tests your controls and signs your report.</p>
        </div>
        <a className="note-link" href={links.limits}>Read the limits <Icon name="arrow" /></a>
      </div>
    </div>
  </section>
}
