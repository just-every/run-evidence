// LIBRARY-001 catalogue check, run by Verify: every shipped program requirement
// maps to a control, every control has proof or a test, every referenced test is
// catalogued, and every catalogue entry carries remediation for each provider it
// runs against (with a Terraform snippet or a stated absence of a provider).
// Every shipped library revision is checked, and each revision's change set
// names only shipped controls and requirements.
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { build } = createRequire(require.resolve('wrangler/package.json'))('esbuild')
const bundled = await build({ stdin: { contents: "export * from './src/evidence/library/index.ts'; export { catalogue } from './src/evidence/tests/catalogue.ts'; export { riskLibrary } from './src/evidence/risk/library.ts'; export { templates } from './src/evidence/policy/templates.ts'; export { currentScopes, saqScope } from './src/evidence/program/documents/saq-scope.ts'; export { saqWording } from './src/evidence/program/documents/saq-wording.ts'", resolveDir: process.cwd(), loader: 'ts' }, bundle: true, write: false, format: 'esm', platform: 'node' })
const { frameworks, controlsFor, libraryControls, libraryRevisions, latestLibraryRevision, catalogue, riskLibrary, templates, currentScopes, saqScope, saqWording } = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'))
const failures = []
let requirements = 0
for (const framework of Object.values(frameworks)) for (const edition of framework.editions) for (const requirement of edition.requirements) {
 requirements++
 for (let revision = 1; revision <= latestLibraryRevision; revision++) if (!controlsFor(framework.id, edition.id, requirement.ref, revision).length) failures.push(`${framework.id} ${edition.id} ${requirement.ref} has no mapped control at library revision ${revision}`)
}
libraryRevisions.forEach((r, i) => {
 if (r.revision !== i + 2 || (!r.changes.length && !r.saqChanges?.length)) failures.push(`library revision ${r.revision} is out of sequence or empty`)
 for (const x of r.saqChanges ?? []) {
  const before = saqScope(x.type, r.revision - 1), after = saqScope(x.type, r.revision)
  if (!currentScopes[x.type] || !x.from || !x.to || !x.removed.length || before.revision === after.revision || x.removed.some(id => !before.ids.includes(id) || after.ids.includes(id))) failures.push(`library revision ${r.revision} has an invalid SAQ change`)
 }
 for (const x of r.changes) if (!libraryControls.some(c => c.id === x.control) || !frameworks[x.framework]?.editions[0].requirements.some(q => q.ref === x.ref)) failures.push(`library revision ${r.revision} changes unknown ${x.control} ${x.framework} ${x.ref}`)
})
for (const [type, scope] of Object.entries(currentScopes)) if (!scope.revision || !scope.source.startsWith('https://docs-prv.pcisecuritystandards.org/') || !scope.ids.length || new Set(scope.ids).size !== scope.ids.length || scope.ids.some(id => !saqWording[id])) failures.push(`SAQ ${type} lacks revision, provenance, unique ids or Evidence wording`)
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
// Every evidence class LIBRARY-001 lists for a connector family has, for each
// connector of that family, a shipped test or an explicit unsupported entry.
// Later families (CLOUD-002, APPS-001, VULN-001, ISSUES-001, MONITOR-001,
// HRIS-001, DEVICE-001) add their classes here before their connectors ship.
const families = {
 cloud: { connectors: ['aws', 'gcp', 'azure'], classes: ['IAM and MFA', 'Public storage', 'Encryption at rest', 'Encryption in transit', 'Logging and monitoring', 'Backup', 'Network configuration'] },
 identity: { connectors: ['okta', 'google', 'entra', 'jumpcloud'], classes: ['MFA', 'Privileged roles', 'Inactive users', 'Departed users'] },
 code: { connectors: ['github'], classes: ['Branch protection', 'Required review', 'Required checks', 'Membership and MFA', 'Repository privacy', 'Dependency alerts', 'Secret alerts'] },
}
const ownSources = ['policies', 'attestations', 'training']
let classes = 0
for (const [family, { connectors, classes: listed }] of Object.entries(families)) for (const connector of connectors) for (const evidenceClass of listed) {
 classes++
 if (!catalogue.some(entry => entry.providers.includes(connector) && entry.evidenceClass === evidenceClass)) failures.push(`${family} connector ${connector} has neither a test nor an unsupported entry for ${evidenceClass}`)
}
for (const connector of new Set(catalogue.flatMap(entry => entry.providers))) if (!ownSources.includes(connector) && !Object.values(families).some(f => f.connectors.includes(connector))) failures.push(`connector ${connector} belongs to no listed evidence-class family`)
// POLICY-001: every policy a library control calls for ships as a template, and each template is linked to a control.
for (const title of new Set(libraryControls.flatMap(c => c.policies))) if (!templates.some(t => t.title.toLowerCase() === title.toLowerCase())) failures.push(`policy "${title}" is called for but ships no template`)
for (const t of templates) if (!libraryControls.some(c => c.policies.includes(t.title))) failures.push(`template ${t.id} is linked to no control`)
if (riskLibrary.length < 100) failures.push(`risk library has ${riskLibrary.length} scenarios; at least 100 ship`)
for (const scenario of riskLibrary) for (const control of scenario.controls) if (!ids.has(control)) failures.push(`risk ${scenario.id} suggests unknown control ${control}`)
if (failures.length) { console.error(failures.join('\n')); process.exit(1) }
console.log(`Library check: ${requirements} requirements across ${Object.keys(frameworks).length} frameworks map to ${libraryControls.length} controls at every library revision (1-${latestLibraryRevision}); ${catalogue.length} catalogue tests cover ${classes} connector evidence classes; ${templates.length} policy templates; ${riskLibrary.length} risk scenarios.`)
