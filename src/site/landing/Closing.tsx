import { Actions } from './Actions'
import { Chip, Slab } from './Slab'
import { IconTile, type IconName } from './Icon'
import { controlName } from './HeroDrawing'
const rows: { label: string; state: string; icon: IconName }[] = [
  { label: controlName, state: 'covered', icon: 'list' },
  { label: 'access-review-q4.png', state: 'current', icon: 'image' },
  { label: 'Customer security review', state: 'Open', icon: 'folder' },
]
export function Closing() {
  return <section id="start" className="landing-closing" aria-labelledby="start-heading"><div className="closing-copy"><h2 id="start-heading">Ready when they ask.</h2></div><div className="closing-drawing" role="img" aria-label="Evidence cards set in clear acrylic.">{rows.map(row => <Slab key={row.label}><div className="drawing-card closing-card"><IconTile name={row.icon} /><strong>{row.label}</strong><Chip>{row.state}</Chip></div></Slab>)}</div><div className="closing-actions"><Actions /></div></section>
}
