// Desk page 01. The painting (public/site/hero-*) is a clean plate of the approved hero: the
// board, its strings, the plant and the light. Every card, pin, tile and line of copy that was
// painted on it is rebuilt here at the desk's position, in desk pixels of the 1536-wide image.
import type { CSSProperties, ReactNode } from 'react'
import { SiteHeader } from '../shell/SiteHeader'
import { Actions } from '../shell/Actions'
import { Art } from './parts'
import { Icon, Status, type IconName } from './icons'

type Place = { x: number; y: number; w: number; h: number; r?: number }
const place = ({ x, y, w, h, r = 0 }: Place) => ({ '--x': x, '--y': y, '--w': w, '--h': h, '--r': `${r}deg` }) as CSSProperties

function Exhibit({ id, at, tone, icon, children }: { id: string; at: Place; tone: string; icon: IconName; children: ReactNode }) {
  return <div className={`pin-card board-${id}`} style={place(at)}><span className={`tile tone-${tone}`}><Icon name={icon} /></span><div>{children}</div></div>
}

const pins: [string, number, number][] = [
  ['blue', 172, 166], ['blue', 398, 208], ['violet', 769, 183], ['violet', 536, 229], ['green', 440, 312], ['blue', 297, 349], ['teal', 568, 333],
  ['amber', 202, 485], ['orange', 343, 573], ['red', 648, 520], ['red', 447, 540], ['blue', 797, 702],
  ['grey', 127, 717], ['grey', 245, 708], ['grey', 340, 716], ['grey', 434, 711], ['grey', 545, 716],
]

function Board() {
  return <div className="board" aria-label="An evidence board: controls joined to the exhibits that prove them">
    <Exhibit id="cc61" at={{ x: 124, y: 162, w: 273, h: 114, r: 1.2 }} tone="blue" icon="lock"><strong>CC6.1</strong><span>Logical access</span></Exhibit>
    <Exhibit id="cc72" at={{ x: 538, y: 177, w: 252, h: 110, r: 0.9 }} tone="violet" icon="bars"><strong>CC7.2</strong><span>Monitoring</span></Exhibit>
    <div className="pin-card board-exA" style={place({ x: 304, y: 303, w: 260, h: 176, r: 0.6 })}>
      <div className="board-head"><span className="tile tone-green"><Icon name="people" /></span><div><strong>Exhibit A</strong><span>MFA enforced for all 42&nbsp;users</span></div></div>
      <div className="board-foot"><span className="source"><Icon name="key" />Okta</span><span className="when">Checked 9:00 AM</span><Status kind="pass" label="Passing" /></div>
    </div>
    <div className="pin-card board-soc2" style={place({ x: 629, y: 327, w: 248, h: 113, r: 0.9 })}>
      <div className="board-head"><span className="tile tone-solid-green"><Icon name="shieldHalf" /></span><div><strong>SOC 2 Type II</strong><span className="ready">94% ready</span></div></div>
      <span className="meter" role="img" aria-label="94% ready"><i style={{ width: '94%' }} /></span>
    </div>
    <div className="pin-card board-exB" style={place({ x: 91, y: 486, w: 249, h: 169, r: -3.3 })}>
      <div className="board-head"><span className="tile tone-mint"><Icon name="bucket" /></span><div><strong>Exhibit B</strong><span>S3 buckets encrypted</span></div></div>
      <div className="board-foot"><span className="source">AWS</span><span className="when">12 of 12</span><Status kind="pass" label="Passing" /></div>
    </div>
    <div className="pin-card board-exC" style={place({ x: 449, y: 512, w: 238, h: 163, r: 3.6 })}>
      <div className="board-head"><span className="tile tone-red"><Icon name="laptop" /></span><div><strong>Exhibit C</strong><span>Laptop disk encryption</span></div></div>
      <div className="board-foot"><span className="when">1 failing → fixed, <span className="nowrap">re-tested</span></span><Status kind="pass" label="Passing again" /></div>
    </div>
    <div className="pin-card board-list" style={place({ x: 722, y: 487, w: 164, h: 192, r: -1.4 })}>
      <Icon name="doc" className="list-doc" />
      <ul>{['Policies', 'Access reviews', 'Vendor risk', 'Trust center'].map(item => <li key={item}>{item}<Icon name="check" /></li>)}</ul>
    </div>
    <div className="pin-card board-note" style={place({ x: 743, y: 701, w: 129, h: 168, r: 9 })}><p>Every claim has its proof.</p></div>
    {[['Okta', 136, 760, 90, 94, -2], ['AWS', 242, 754, 80, 102, 1], ['GitHub', 349, 755, 90, 92, 0], ['Google', 448, 751, 84, 91, -1], ['Jamf', 555, 753, 92, 88, 0]].map(([name, cx, cy, w, h, r]) =>
      <span key={name} className={`board-tile tile-${String(name).toLowerCase()}`} style={place({ x: Number(cx) - Number(w) / 2, y: Number(cy) - Number(h) / 2, w: Number(w), h: Number(h), r: Number(r) })}>{name === 'Jamf' ? <img src="/site/brands/jamf.svg" alt="Jamf" width="43" height="42" /> : name}</span>)}
    {pins.map(([tone, x, y], index) => <i key={index} className={`pin pin-${tone}`} style={{ '--x': x, '--y': y } as CSSProperties} />)}
  </div>
}

const strip: [IconName, string, string][] = [
  ['cloud', 'AWS', 'Cloud infrastructure'], ['branch', 'GitHub', 'Development'], ['apps', 'Google Workspace', 'Productivity'],
  ['key', 'Okta', 'Identity'], ['people', 'HR systems', 'People'], ['laptop', 'Device systems', 'Endpoints'],
]

export function Hero() {
  return <section className="hero" aria-labelledby="hero-title">
    <div className="hero-stage">
      <div className="hero-art"><Art name="hero" width={1536} height={1024} eager phone={{ name: 'board-phone', width: 866, height: 788 }} /></div>
      <SiteHeader />
      <div className="hero-copy">
        <h1 id="hero-title">Ready for the audit, <span className="accent">any&nbsp;day.</span></h1>
        <p className="hero-sub">Evidence tests your controls around the clock, collects the proof, fixes what drifts, and hands your auditor everything they ask for.</p>
        <p className="hero-alt">100% free, open source alternative to <strong>Vanta</strong>, <strong>Drata</strong> and <strong>Secureframe</strong></p>
        <Actions />
      </div>
      <Board />
      <ul className="hero-strip" aria-label="Connects to">{strip.map(([icon, name, kind]) => <li key={name}><Icon name={icon} /><span><b>{name}</b>{kind}</span></li>)}</ul>
    </div>
  </section>
}
