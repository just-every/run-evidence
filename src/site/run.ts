import type { RunData } from '../base/run-site'
import project from '../../rer-project.json'

export const repository = project.sourceRepository
export { identity } from '../identity'
export const run: RunData = {
  name: 'Evidence', repository, clone: 'npx -y @runeditrun/rer dev just-every/run-evidence', folder: 'run-evidence',
  requirements: 'Runs on macOS, Linux or Windows with WSL2, with git. The installer brings Node when it is missing, and rer brings pnpm.',
  licence: 'MIT', docs: true, hosted: [],
}
