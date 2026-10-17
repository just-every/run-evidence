import type { EditionIdentity } from './base/identity'
import branding from './branding.json'
export const identity: EditionIdentity = {
 product: 'Evidence', deployment: branding.name,
 purpose: '{deployment}’s controls, proof and review folders, in one private workspace.',
 tagline: 'Evidence tests your controls around the clock, collects the proof, fixes what drifts, and hands your auditor everything they ask for. Free and open source, MIT licensed.',
 signInPath: '/signin', runSite: 'https://run-evidence.com', installedHome: 'lobby',
 theme: '/rer-theme.css', mark: '/brand/mark.svg', fonts: '/fonts/fonts.css', accentColor: branding.primaryColor,
}
