// page-s1 page-02: the buyer's first SOC 2 Type II on a true date scale, Mar 1 to Dec 31 2026
// (every day the same width). Below 1180 px it runs down a rail (phone-02).
import type { CSSProperties } from 'react'
import { Band, Head } from '../parts'
import { Icon } from '../icons'

const START = Date.UTC(2026, 2, 1)
const DAYS = 306
const day = (month: number, date: number) => (Date.UTC(2026, month - 1, date) - START) / 864e5
const at = (offset: number) => ({ '--at': offset / DAYS }) as CSSProperties

type Kind = 'open' | 'fail' | 'pass' | 'drift' | 'blue' | 'report'
type Milestone = { date: string; note: string; kind: Kind; at: number; side: 'up' | 'down'; align: 'start' | 'end' | 'center'; pair?: 'before' | 'after' }

// Mar 3 and Mar 4 are one day apart: their markers sit edge to edge, centred on the day line between them.
const scale: Milestone[] = [
  { date: 'Mar 3', note: 'A bank asks for a SOC 2 report', kind: 'open', at: day(3, 4), side: 'up', align: 'end', pair: 'before' },
  { date: 'Mar 4', note: 'rer setup\u00a0· first scan: 31 gaps', kind: 'fail', at: day(3, 4), side: 'down', align: 'start', pair: 'after' },
  { date: 'Mar 30', note: '0 gaps open', kind: 'pass', at: day(3, 30) + .5, side: 'up', align: 'start' },
  { date: 'Jul 14', note: '1 drift, fixed by 11:40\u00a0AM', kind: 'drift', at: day(7, 14) + .5, side: 'up', align: 'end' },
  { date: 'Sep 30\u00a0· window closes', note: '15,738 daily results kept', kind: 'pass', at: day(10, 1), side: 'up', align: 'end' },
  { date: 'Nov 2', note: 'Fieldwork\u00a0· Harbor & Lane CPAs', kind: 'blue', at: day(11, 2) + .5, side: 'down', align: 'center' },
  { date: 'Dec 9', note: 'Report issued\u00a0· no exceptions', kind: 'report', at: day(12, 9) + .5, side: 'up', align: 'center' },
]

const rail: { date: string; note: string; kind: Kind; window?: 'opens' | 'inside' | 'closes' }[] = [
  { date: 'Mar 3', note: 'A bank asks for a SOC 2 report', kind: 'open' },
  { date: 'Mar 4', note: 'rer setup\u00a0·\u00a0first scan: 31 gaps', kind: 'fail' },
  { date: 'Mar 30', note: '0 gaps open', kind: 'pass' },
  { date: 'Apr 1', note: 'Window opens\u00a0·\u00a0every control tested daily', kind: 'blue', window: 'opens' },
  { date: 'Jul 14', note: '1 drift, fixed by 11:40\u00a0AM', kind: 'drift', window: 'inside' },
  { date: 'Sep 30', note: 'Window closes\u00a0·\u00a015,738 daily results kept', kind: 'pass', window: 'closes' },
  { date: 'Nov 2', note: 'Fieldwork\u00a0·\u00a0Harbor & Lane CPAs', kind: 'blue' },
  { date: 'Dec 9', note: 'Report issued\u00a0·\u00a0no exceptions', kind: 'report' },
]

const months = ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const firsts = months.map((_, index) => day(index + 3, 1))

function Dot({ kind }: { kind: Kind }) {
  if (kind === 'open') return <span className="tl-dot tl-open" />
  if (kind === 'blue') return <span className="tl-dot tl-blue" />
  if (kind === 'fail') return <span className="tl-dot tl-fail"><Icon name="alert" /></span>
  if (kind === 'drift') return <span className="tl-dot tl-drift"><span className="tl-fixed"><Icon name="check" /></span></span>
  return <span className={`tl-dot tl-pass${kind === 'report' ? ' tl-report' : ''}`}><Icon name="check" /></span>
}

export function Timeline() {
  return <Band id="first-soc2" className="band-timeline">
    <Head id="first-soc2" className="head-wide" eyebrow={<>Your first SOC 2<span className="narrow-sep">&nbsp;· </span><span className="narrow-line">March to December</span></>} title={<>From first scan <br />to signed report.</>}
      lede="Your first SOC 2 Type II, from the day a customer asks for it." />
    <div className="card tl-card">
      <div className="tl-scale">
        <div className="tl-band" style={{ '--from': day(4, 1) / DAYS, '--to': day(10, 1) / DAYS } as CSSProperties}><span>Observation window&nbsp;· Apr 1&nbsp;– Sep 30&nbsp;· every control tested daily</span></div>
        <div className="tl-line" />
        {firsts.map((first, index) => <span key={months[index]} className="tl-month" style={{ '--at': first / DAYS, '--to': (firsts[index + 1] ?? DAYS) / DAYS } as CSSProperties}><i />{months[index]}</span>)}
        <span className="tl-end" />
        {scale.map(item => <div key={item.date} className={`tl-mark tl-${item.side} tl-al-${item.align}${item.pair ? ` tl-pair-${item.pair}` : ''}`} style={at(item.at)}>
          <Dot kind={item.kind} />
          <span className="tl-stem" />
          <p className="tl-label"><b>{item.date}</b><span>{item.note}</span></p>
        </div>)}
      </div>
      <ol className="tl-rail">
        {rail.map(item => <li key={item.date} className={item.window ? `tl-window tl-window-${item.window}` : undefined}>
          <Dot kind={item.kind} />
          <p><b>{item.date}</b><span>{item.note}</span></p>
          {item.window === 'opens' ? <p className="tl-window-label">Observation window<span className="split-sep">&nbsp;· </span><span className="split">Apr 1&nbsp;– Sep 30</span></p> : null}
        </li>)}
      </ol>
    </div>
  </Band>
}
