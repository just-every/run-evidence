import type { RunData } from '../base/run-site'
import project from '../../rer-project.json'

export const repository = project.sourceRepository
export { identity } from '../identity'
export const run: RunData = {
  name: 'Evidence', repository, clone: 'npx -y @runeditrun/rer dev just-every/run-evidence', folder: 'run-evidence',
  requirements: 'Needs Node 22 or later, Git and pnpm 10.12.4, on macOS, Linux or Windows with WSL2.',
  licence: 'MIT', docs: true, hosted: [],
}
