import { Actions } from './Actions'
import { HeroDrawing } from './HeroDrawing'
export function Hero() {
  return <section className="landing-hero" aria-labelledby="hero-heading"><div className="hero-copy"><h1 id="hero-heading">Audit evidence,<br />ready to share.</h1><p className="hero-subhead">Write your controls, keep proof on schedule, see every gap, and share a folder that expires.</p><p className="hero-alternative">100% free, open source alternative to <strong>Vanta</strong>, <strong>Drata</strong> and <strong>Secureframe</strong></p><Actions /></div><HeroDrawing /></section>
}
