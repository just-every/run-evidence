import { Chip, Slab } from './Slab'
import { IconTile } from './Icon'
export function ReceiptsDrawing() {
  return <div className="receipts-drawing" role="img" aria-label="Two receipts: the current one and the superseded one, both kept."><Slab><div className="drawing-rows">{[{ name: 'access-review-q4.png', fingerprint: '9f2c…41ab', current: true }, { name: 'access-review-q3.png', fingerprint: '3a7d…9c2f', current: false }].map(row => <div className="drawing-card receipt-row" key={row.name}><IconTile name="image" /><div className="drawing-copy"><strong>{row.name}</strong><span>SHA-256 fingerprint</span><code>{row.fingerprint}</code></div><Chip state={row.current ? 'covered' : 'missing'}>{row.current ? 'current' : 'superseded'}</Chip></div>)}</div><p className="drawing-footnote">Original facts and bytes are retained.</p></Slab></div>
}
