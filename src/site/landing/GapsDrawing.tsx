import { Chip, Slab } from './Slab'
import { IconTile, type IconName } from './Icon'
import { controlName } from './HeroDrawing'
const rows: { name: string; state: 'covered' | 'due' | 'overdue' | 'missing'; label: string; icon: IconName }[] = [
  { name: controlName, state: 'covered', label: 'covered', icon: 'list' },
  { name: 'Back up the production database', state: 'due', label: 'due soon', icon: 'database' },
  { name: 'Security awareness training', state: 'overdue', label: 'overdue', icon: 'people' },
  { name: 'Vendor risk review', state: 'missing', label: 'missing', icon: 'folder' },
]
export function GapsDrawing() {
  return <div className="gaps-drawing" role="img" aria-label="Four controls, each with its own state."><Slab><div className="drawing-rows">{rows.map(row => <div className="drawing-card gap-row" key={row.name}><IconTile name={row.icon} /><strong>{row.name}</strong><Chip state={row.state}>{row.label}</Chip></div>)}</div></Slab></div>
}
