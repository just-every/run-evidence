// Desk page 07. The terminal shows the one-line start only (owner, 17 Oct 2026).
import { links } from '../../shell/links'
import { run } from '../../run'
import { Icon, type IconName } from '../icons'

const facts: [IconName, string][] = [['laptop', 'Your own computer or server'], ['database', 'Your evidence, your database'], ['upload', 'Export any time']]

export function Ownership() {
  return <section className="ownership" id="ownership" aria-labelledby="ownership-title">
    <div className="pair-copy">
      <p className="eyebrow">Ownership</p>
      <h2 id="ownership-title">Your proof stays yours.</h2>
      <p className="lede"><a href={links.run}>Run Evidence</a> on your own computer or server and keep every test result, policy and receipt. Export everything, any time.</p>
      <ul className="facts">{facts.map(([icon, text]) => <li key={text}><span className="tile tone-sky"><Icon name={icon} /></span>{text}</li>)}</ul>
    </div>
    <figure className="terminal" aria-label="Start Evidence">
      <div className="terminal-bar" aria-hidden="true"><i /><i /><i /></div>
      <pre><code><span className="prompt" aria-hidden="true">$ </span>{run.clone}{'\n'}<span className="comment"># clones, installs and starts Evidence on your computer</span></code></pre>
    </figure>
  </section>
}
