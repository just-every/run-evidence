// Desk page 02: frameworks, then continuous tests.
import { Pair } from '../parts'
import { Icon, Status, type IconName } from '../icons'

const frameworks: [string, number, number][] = [['SOC 2 Type II', 81, 86], ['ISO 27001:2022', 82, 93], ['HIPAA Security Rule', 44, 45], ['PCI DSS 4.0.1', 39, 64]]
const pct = (done: number, total: number) => Math.round(done / total * 100)

type Source = { icon?: IconName; logo?: string; name: string }
const tests: [Source, string, boolean][] = [
  [{ icon: 'cloud', name: 'AWS' }, 'Root account has MFA', true],
  [{ icon: 'branch', name: 'GitHub' }, 'Branch protection on 14 repos', true],
  [{ icon: 'apps', name: 'Google Workspace' }, '2-step verification, 42 users', true],
  [{ logo: 'rippling', name: 'Rippling' }, 'Departed staff removed from Okta', true],
  [{ logo: 'jamf', name: 'Jamf' }, 'Disk encryption · 41 of 42 laptops', false],
]

export function Frameworks() {
  return <>
    <Pair id="frameworks" eyebrow="Frameworks" title={<>Every framework, one set of controls.</>}
      lede="SOC 2, ISO 27001, HIPAA and PCI DSS share controls, so one passing test counts everywhere it applies. Each control has an owner and a scope.">
      <div className="card frameworks-card">
        <h3>Frameworks</h3>
        <ul>{frameworks.map(([name, done, total]) => <li key={name}>
          <span className="fw-name">{name}</span>
          <span className="meter" role="img" aria-label={`${pct(done, total)}% ready`}><i style={{ width: `${pct(done, total)}%` }} /></span>
          <span className="fw-figure"><b>{pct(done, total)}%</b>{done} of {total} controls</span>
        </li>)}</ul>
      </div>
      <p className="chip chip-pass"><Status kind="pass" label="Done" /><span>CC6.2 owner left <span className="arrow">→</span> reassigned to Priya Shah</span></p>
    </Pair>
    <Pair id="tests" flip eyebrow="Continuous tests" title={<>Your whole stack, tested around the clock.</>}
      lede="Connect AWS, GitHub, Google Workspace, Okta, your HR system and your device manager once. Evidence runs every control test on a schedule.">
      <div className="card tests-card">
        <h3>Control tests · today 9:00 AM</h3>
        <ul>{tests.map(([source, test, pass]) => <li key={source.name}>
          <span className="source-mark">{source.logo ? <img src={`/site/brands/${source.logo}.svg`} alt="" width="28" height="28" /> : <Icon name={source.icon!} />}</span>
          <span className="test-name"><b>{source.name}</b> · {test}</span>
          <Status kind={pass ? 'pass' : 'fail'} label={pass ? 'Passing' : 'Failing'} />
        </li>)}</ul>
      </div>
      <p className="chip chip-fail"><Status kind="fail" label="Failing" /><span>MacBook Pro · J. Rivera · FileVault off <span className="arrow">→</span> task opened</span></p>
    </Pair>
  </>
}
