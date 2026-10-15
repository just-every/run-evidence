import { Chip, Slab } from './Slab'
import { IconTile } from './Icon'
export const controlName = 'Review who can access customer data'

export function HeroDrawing() {
  return <div className="hero-drawing" role="img" aria-label="Three Evidence cards set in clear acrylic: add a control, add proof, share a folder.">
    <Slab className="hero-slab step-one"><div className="drawing-step"><span aria-hidden="true">1</span><strong>Add a control</strong></div><div className="drawing-card hero-card"><IconTile name="list" /><div className="drawing-copy"><strong>{controlName}</strong><span>Access · quarterly</span></div></div></Slab>
    <Slab className="hero-slab step-two"><div className="drawing-step"><span aria-hidden="true">2</span><strong>Add proof</strong></div><div className="drawing-card hero-card"><IconTile name="image" /><div className="drawing-copy"><strong>access-review-q4.png</strong><span>SHA-256 fingerprint</span><code>9f2c…41ab</code></div><Chip>covered</Chip></div></Slab>
    <Slab className="hero-slab step-three"><div className="drawing-step"><span aria-hidden="true">3</span><strong>Share a folder</strong></div><div className="drawing-card hero-card"><IconTile name="folder" /><div className="drawing-copy"><strong>Customer security review</strong><span>Expires 1 Dec</span></div><div className="drawing-card-actions"><Chip>Open</Chip><span className="drawing-button">Copy link</span></div></div></Slab>
  </div>
}
