import type { LibraryCadence, LibraryControl } from '../types'
// Library controls the extended programs add at revision 1: privacy, AI governance and controlled unclassified information. Like every
// library control, each names its proof; the extended programs map to them and to the core controls they share.
type Row = [id: string, title: string, group: LibraryControl['group'], proof: string, cadence: LibraryCadence]
const rows: Row[] = [
 ['PRV-01', 'The privacy notice is published, current and states rights and recipients', 'Data', 'Published privacy notice with revision history', 'annual'],
 ['PRV-02', 'Consumer and data subject requests are verified, answered on time and recorded', 'Data', 'Request log with receipt, verification, response dates and outcomes', 'quarterly'],
 ['PRV-03', 'Opt-outs of sale, sharing and targeted advertising are honored, including universal opt-out signals', 'Data', 'Opt-out signal test results and suppression records', 'quarterly'],
 ['PRV-04', 'Consent for sensitive and children\'s data is obtained, recorded and withdrawable', 'Data', 'Consent records and age-gate configuration', 'quarterly'],
 ['PRV-05', 'Data protection impact and risk assessments are completed for high-risk processing', 'Governance', 'Completed data protection assessments with decisions', 'annual'],
 ['PRV-06', 'Records of processing activities are kept current', 'Governance', 'Register of processing activities with purposes, recipients and retention', 'annual'],
 ['PRV-07', 'Data minimization, purpose and retention limits are enforced', 'Data', 'Purpose and retention schedule with deletion evidence', 'annual'],
 ['PRV-08', 'Processor and subprocessor contracts carry privacy terms', 'Vendors', 'Executed data processing agreements', 'annual'],
 ['PRV-09', 'Appeals of denied privacy requests are handled', 'Data', 'Appeal log with decisions and responses', 'quarterly'],
 ['PRV-10', 'Cross-border transfers have a lawful transfer mechanism', 'Data', 'Transfer register naming the mechanism for each destination', 'annual'],
 ['PRV-11', 'A privacy lead or data protection officer is named and independent', 'Governance', 'Appointment record and reporting line', 'annual'],
 ['PRV-12', 'Automated decisions and profiling are inventoried and assessed, and opt-outs are honored', 'Governance', 'Automated decision inventory with assessments and opt-out evidence', 'annual'],
 ['PRV-13', 'Exercising privacy rights does not change price or service', 'Governance', 'Pricing and service parity review', 'annual'],
 ['AI-01', 'AI systems are inventoried with an owner and a risk ranking', 'Governance', 'AI system inventory with owners, purposes and risk rank', 'quarterly'],
 ['AI-02', 'An AI policy and acceptable-use rules are approved and communicated', 'Governance', 'Approved AI policy and acknowledgments', 'annual'],
 ['AI-03', 'AI system impact assessments are completed and reviewed', 'Governance', 'Completed impact assessments covering individuals, groups and society', 'annual'],
 ['AI-04', 'AI risks are assessed, treated and monitored', 'Governance', 'AI risk register with treatments and residual risk', 'quarterly'],
 ['AI-05', 'AI data provenance, quality and preparation are governed', 'Data', 'Data provenance, quality and preparation records', 'annual'],
 ['AI-06', 'AI systems are validated before release and monitored in operation', 'Operations', 'Evaluation, validation and production monitoring reports', 'quarterly'],
 ['AI-07', 'Humans oversee AI systems and can intervene', 'Governance', 'Oversight roles, procedures and intervention records', 'annual'],
 ['AI-08', 'Third-party AI services and models are assessed', 'Vendors', 'Third-party AI assessments and contract terms', 'annual'],
 ['AI-09', 'AI incidents and concerns are reported and handled', 'Operations', 'AI incident and concern log with outcomes', 'quarterly'],
 ['AI-10', 'AI transparency information reaches users and affected people', 'Governance', 'User documentation and disclosures about AI use', 'annual'],
 ['CUI-01', 'Controlled unclassified information is identified, marked and limited to authorized users', 'Data', 'CUI inventory with markings and authorized-user list', 'quarterly'],
 ['CUI-02', 'CUI flows and external system connections are authorized and controlled', 'Data', 'CUI data-flow diagram and external system authorizations', 'annual'],
]
export const extendedControls: LibraryControl[] = rows.map(([id, title, group, proof, cadence]) => ({ id, title, group, proof, cadence, tests: [], policies: [], maps: {} }))
