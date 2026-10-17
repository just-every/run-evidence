// Desk page 08: also included.
import { Icon, type IconName } from '../icons'

const details: [IconName, string, string, string][] = [
  ['shield', 'sky', 'Vendor risk', 'Vendors rated by risk, with reviews on time.'],
  ['register', 'sky', 'Risk register', 'Each risk tied to the controls that treat it.'],
  ['people', 'sky', 'Access reviews', 'Quarterly reviews sent to each system owner.'],
  ['userPlus', 'mint', 'Joiners and leavers', 'Accounts checked the day people start or leave.'],
  ['receipt', 'sky', 'Evidence receipts', 'Every proof kept unchanged, with its source and time.'],
  ['folder', 'mint', 'Reviewer folders', 'Shared proof that closes on the date you set.'],
]

export function Details() {
  return <section className="details" id="details" aria-labelledby="details-title">
    <p className="eyebrow">Also included</p>
    <h2 id="details-title">The quiet details.</h2>
    <ul>{details.map(([icon, tone, title, body]) => <li key={title}><span className={`disc tone-${tone}`}><Icon name={icon} /></span><h3>{title}</h3><p>{body}</p></li>)}</ul>
  </section>
}
