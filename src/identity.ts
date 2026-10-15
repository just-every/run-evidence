import type { EditionIdentity } from './base/identity'
import branding from './branding.json'
export const identity: EditionIdentity = {
 product: 'Evidence', deployment: branding.name,
 purpose: '{deployment}’s controls, proof and review folders, in one private workspace.',
 tagline: 'Write controls, keep proof on schedule, see every gap and share an expiring folder. Free and open source, MIT licensed.',
 signInPath: '/signin', runSite: 'https://run-evidence.com', installedHome: 'lobby',
 theme: '/rer-theme.css', mark: '/brand/mark.svg', band: '/brand/band.svg', fonts: '/fonts/fonts.css', accentColor: branding.primaryColor,
}
