import { IconTile, type IconName } from './Icon'
const tiles: { title: string; body: string; icon: IconName }[] = [
  { title: 'Take it with you', body: 'Export the whole archive and restore it anywhere.', icon: 'upload' },
  { title: 'Access log', body: 'Every view and download of a folder is recorded.', icon: 'document' },
  { title: 'Agent preparation', body: 'An agent drafts the folder. You approve it.', icon: 'pencil' },
  { title: 'Move in from Drata', body: 'Bring your evidence ZIP and review the mapping first.', icon: 'arrow' },
  { title: 'Plain-words controls', body: 'Access, Data, Change, People and Vendors.', icon: 'list' },
  { title: 'Any cadence', body: 'Daily, weekly, monthly or quarterly proof.', icon: 'calendar' },
]
export function Included() {
  return <section id="included" className="landing-included" aria-labelledby="included-heading"><h2 id="included-heading">Also included</h2><div className="included-grid">{tiles.map(tile => <article className="slab included-tile" key={tile.title}><div className="card included-card"><IconTile name={tile.icon} /><div><h3>{tile.title}</h3><p>{tile.body}</p></div></div></article>)}</div></section>
}
