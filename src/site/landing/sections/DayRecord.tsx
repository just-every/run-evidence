// page-s1 page-05: the observation window as a day record, one tick per day (Apr 1 – Sep 30, 183 days),
// month ticks on the 1st. The one red tick is CC7.2 on Jul 14, day 105. At 390, CC7.2 alone, a row per month (phone-05).
import type { CSSProperties } from 'react'
import { Band, Head } from '../parts'
import { Mark, Status, type MarkName } from '../icons'

const DAYS = 183
const DRIFT = 104 // Jul 14, counted from Apr 1 = 0
const months: [string, number][] = [['Apr', 30], ['May', 31], ['Jun', 30], ['Jul', 31], ['Aug', 31], ['Sep', 30]]
const starts = months.map((_, index) => months.slice(0, index).reduce((sum, [, length]) => sum + length, 0))

const rows: [MarkName, string, string, string][] = [
  ['okta', 'okta', 'CC6.1', 'Logical access'],
  ['jamf', 'jamf', 'CC6.7', 'Laptop encryption'],
  ['github', 'GitHub', 'CC8.1', 'Change management'],
  ['aws', '', 'A1.2', 'Backups'],
  ['aws', '', 'CC7.2', 'Monitoring'],
]

function Ticks({ count, fail }: { count: number; fail?: number }) {
  return <span className="ticks">{Array.from({ length: count }, (_, index) => <i key={index} className={index === fail ? 'tick-fail' : undefined} />)}</span>
}

const Callout = () => <p className="record-callout"><Status kind="fail" label="Failed" /><span>Jul 14, 2:00&nbsp;AM&nbsp;· CloudTrail off in <span className="nowrap">us-west-2<span className="split-sep">&nbsp;→</span></span> <span className="split nowrap">fixed 11:40&nbsp;AM</span></span><Status kind="pass" label="Fixed" /></p>

export function DayRecord() {
  return <Band id="observation" className="band-record">
    <Head id="observation" className="head-wide" eyebrow={<>Apr 1&nbsp;– Sep 30<span className="narrow-sep">&nbsp;· </span><span className="narrow-line">Observation window</span></>} title="183 days, tested every day."
      lede="A Type II report covers months, not a moment. Evidence tests every control around the clock and keeps each day's result with its time and source." />
    <div className="card record-card">
      <div className="record-desk">
        <p className="record-months" aria-hidden="true"><span className="record-axis">{months.map(([name], index) => <span key={name} style={{ '--at': starts[index] / DAYS } as CSSProperties}>{name}</span>)}</span></p>
        <ul>{rows.map(([mark, word, control, title]) => <li key={control} className={control === 'CC7.2' ? 'record-drift' : undefined} style={{ '--at': (DRIFT + .5) / DAYS } as CSSProperties}>
          <span className={`record-source record-${mark}`}><Mark name={mark} />{word ? <span className="wordmark">{word}</span> : null}</span>
          <span className="record-control">{control} · {title}</span>
          <span className="record-days" role="img" aria-label={control === 'CC7.2' ? '182 of 183 days passing; Jul 14 failed and was fixed the same day' : '183 of 183 days passing'}>
            <Ticks count={DAYS} fail={control === 'CC7.2' ? DRIFT : undefined} />
          </span>
          {control === 'CC7.2' ? <Callout /> : null}
        </li>)}</ul>
        <p className="record-foot">86 controls&nbsp;· 15,738 daily results&nbsp;· 1 failure, fixed the same day&nbsp;· every result kept with its source</p>
      </div>
      <div className="record-phone">
        <h3>CC7.2&nbsp;· Monitoring</h3>
        <p className="record-sub">183 of 183 days tested&nbsp;· Apr 1&nbsp;– Sep 30</p>
        <ul>{months.map(([name, length]) => <li key={name} style={{ '--at': 13.5 / 31 } as CSSProperties}>
          <span className="record-month">{name}</span>
          <span className="record-days" role="img" aria-label={name === 'Jul' ? `Jul: ${length} days tested; the 14th failed and was fixed the same day` : `${name}: ${length} of ${length} days passing`}>
            <Ticks count={length} fail={name === 'Jul' ? 13 : undefined} />
          </span>
          {name === 'Jul' ? <Callout /> : null}
        </li>)}</ul>
        <p className="record-foot">CC6.1&nbsp;· CC6.7&nbsp;· CC8.1&nbsp;· A1.2<span className="narrow-sep">&nbsp;· </span><span className="narrow-split nowrap">every day passing <Status kind="pass" label="Passing" /></span></p>
      </div>
    </div>
  </Band>
}
