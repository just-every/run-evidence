import { Chip, Slab } from './Slab'
import { IconTile } from './Icon'
import { controlName } from './HeroDrawing'
export function FolderDrawing() {
  return <div className="folder-drawing" role="img" aria-label="The reviewer's folder, open without an account."><Slab><div className="drawing-card folder-card"><div className="folder-heading"><IconTile name="folder" /><div className="drawing-copy"><strong>Customer security review</strong><span>External review folder</span></div></div><div className="folder-period"><span>Period (UTC)</span><span>2026-10-01 → 2026-12-31</span></div><div className="folder-control"><strong>{controlName}</strong><Chip>covered</Chip></div><span className="drawing-button">Download file</span></div></Slab></div>
}
