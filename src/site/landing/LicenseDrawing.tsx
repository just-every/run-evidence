import { Slab } from './Slab'
import { IconTile } from './Icon'
export function LicenseDrawing() {
  return <div className="license-drawing" role="img" aria-label="The MIT License, set in clear acrylic."><Slab><div className="drawing-card license-card"><IconTile name="document" /><div className="drawing-copy"><strong>MIT License</strong><span>Permission is hereby granted, free of charge</span></div></div></Slab></div>
}
