// LIBRARY-001 catalogue check, run by Verify: every shipped program requirement
// maps to a control, every control has proof or a test, every referenced test is
// catalogued, and every catalogue entry carries remediation for each provider it
// runs against (with a Terraform snippet or a stated absence of a provider).
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { build } = createRequire(require.resolve('wrangler/package.json'))('esbuild')
const bundled = await build({ stdin: { contents: "export * from './src/evidence/library/index.ts'; export { catalogue } from './src/evidence/tests/catalogue.ts'; export { riskLibrary } from './src/evidence/risk/library.ts'", resolveDir: process.cwd(), loader: 'ts' }, bundle: true, write: false, format: 'esm', platform: 'neutral' })
const { frameworks, controlsFor, libraryControls, catalogue, riskLibrary } = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'))
const failures = []
let requirements = 0
for (const framework of Object.values(frameworks)) for (const edition of framework.editions) for (const requirement of edition.requirements) {
 requirements++
 if (!controlsFor(framework.id, edition.id, requirement.ref).length) failures.push(`${framework.id} ${edition.id} ${requirement.ref} has no mapped control`)
}
const ids = new Set()
for (const control of libraryControls) {
 if (ids.has(control.id)) failures.push(`${control.id} is duplicated`); ids.add(control.id)
 if (!control.proof && !control.tests.length) failures.push(`${control.id} has neither a test nor an evidence requirement`)
 for (const [framework, refs] of Object.entries(control.maps)) for (const ref of refs) if (!frameworks[framework].editions[0].requirements.some(r => r.ref === ref)) failures.push(`${control.id} maps unknown ${framework} ${ref}`)
 for (const test of control.tests) if (!catalogue.some(entry => entry.id === test)) failures.push(`${control.id} names uncatalogued test ${test}`)
}
for (const entry of catalogue) {
 if ((!entry.unsupported && !entry.criteria) || !entry.resourceType || !entry.cadence || !entry.controls.length) failures.push(`${entry.id} lacks criteria, resource type, cadence or mapped controls`)
 for (const control of entry.controls) if (!ids.has(control)) failures.push(`${entry.id} maps unknown control ${control}`)
 for (const provider of entry.providers) {
  const steps = entry.remediation[provider]
  if (!steps?.console || !steps?.api) failures.push(`${entry.id} has no console and API remediation for ${provider}`)
  if (entry.configuration && !steps?.terraform && !steps?.noTerraform) failures.push(`${entry.id} has neither a Terraform snippet nor a stated absence for ${provider}`)
 }
}
for (const connector of new Set(catalogue.flatMap(entry => entry.providers))) {
 const classes = catalogue.filter(entry => entry.providers.includes(connector))
 for (const entry of classes) if (entry.unsupported && !entry.manualRequirement) failures.push(`${entry.id} is unsupported without a replacement evidence requirement`)
}
if (riskLibrary.length < 100) failures.push(`risk library has ${riskLibrary.length} scenarios; at least 100 ship`)
for (const scenario of riskLibrary) for (const control of scenario.controls) if (!ids.has(control)) failures.push(`risk ${scenario.id} suggests unknown control ${control}`)
if (failures.length) { console.error(failures.join('\n')); process.exit(1) }
console.log(`Library check: ${requirements} requirements across ${Object.keys(frameworks).length} frameworks map to ${libraryControls.length} controls; ${catalogue.length} catalogue tests; ${riskLibrary.length} risk scenarios.`)
