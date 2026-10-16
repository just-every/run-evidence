import type { Framework } from './types'
// AICPA 2017 Trust Services Criteria with the 2022 revised points of focus.
// Criterion ids with Evidence's own short summaries; the criteria text and
// points of focus are AICPA material the program owner reads from their copy.
const security: [string, string][] = [
 ['CC1.1','Commitment to integrity and ethical values'],['CC1.2','Board independence and oversight of internal control'],['CC1.3','Structures, reporting lines, authorities and responsibilities'],['CC1.4','Attract, develop and retain competent people'],['CC1.5','Accountability for internal control responsibilities'],
 ['CC2.1','Relevant, quality information supports internal control'],['CC2.2','Internal communication of objectives and responsibilities'],['CC2.3','Communication with external parties'],
 ['CC3.1','Objectives specified clearly enough to identify risks'],['CC3.2','Risks to objectives identified and analyzed'],['CC3.3','Potential for fraud considered'],['CC3.4','Significant changes identified and assessed'],
 ['CC4.1','Ongoing and separate evaluations of controls'],['CC4.2','Deficiencies evaluated and communicated'],
 ['CC5.1','Control activities selected to mitigate risks'],['CC5.2','General controls over technology selected'],['CC5.3','Control activities deployed through policies and procedures'],
 ['CC6.1','Logical access security over protected information assets'],['CC6.2','Registration and authorization before access is granted'],['CC6.3','Role-based access, changes and removal'],['CC6.4','Physical access restricted'],['CC6.5','Protections retired when assets are disposed of'],['CC6.6','Protection against threats from outside system boundaries'],['CC6.7','Transmission, movement and removal of information restricted'],['CC6.8','Unauthorized or malicious software prevented or detected'],
 ['CC7.1','Configuration changes and new vulnerabilities detected'],['CC7.2','System components monitored for anomalies'],['CC7.3','Security events evaluated'],['CC7.4','Security incidents responded to'],['CC7.5','Recovery from security incidents'],
 ['CC8.1','Changes authorized, tested, approved and implemented'],
 ['CC9.1','Risk mitigation for business disruption'],['CC9.2','Vendor and business partner risk managed'],
]
const optional: [string, string, string][] = [
 ['A1.1','Capacity managed to meet objectives','Availability'],['A1.2','Environmental protections, backup and recovery infrastructure','Availability'],['A1.3','Recovery plan testing','Availability'],
 ['C1.1','Confidential information identified and protected','Confidentiality'],['C1.2','Confidential information disposed of','Confidentiality'],
 ['PI1.1','Quality information about processing objectives','Processing integrity'],['PI1.2','System inputs complete and accurate','Processing integrity'],['PI1.3','Processing complete, accurate and timely','Processing integrity'],['PI1.4','Outputs complete, accurate and distributed as intended','Processing integrity'],['PI1.5','Inputs, items in processing and outputs stored completely','Processing integrity'],
 ['P1.1','Privacy notice provided','Privacy'],['P2.1','Choice and consent communicated','Privacy'],['P3.1','Personal information collected consistent with objectives','Privacy'],['P3.2','Explicit consent obtained where required','Privacy'],['P4.1','Use limited to stated objectives','Privacy'],['P4.2','Personal information retained only as needed','Privacy'],['P4.3','Personal information securely disposed of','Privacy'],['P5.1','Data subjects can access their information','Privacy'],['P5.2','Corrections and amendments handled','Privacy'],['P6.1','Disclosures to third parties only with consent','Privacy'],['P6.2','Record of authorized disclosures kept','Privacy'],['P6.3','Record of unauthorized disclosures kept','Privacy'],['P6.4','Commitments obtained from vendors with access','Privacy'],['P6.5','Vendors notify of unauthorized disclosures','Privacy'],['P6.6','Breach notification to affected data subjects','Privacy'],['P6.7','Accounting of disclosures provided on request','Privacy'],['P7.1','Personal information kept accurate and complete','Privacy'],['P8.1','Inquiries, complaints and disputes handled','Privacy'],
]
export const soc2: Framework = {
 id: 'soc2', name: 'SOC 2', licence: 'Criterion ids only. The Trust Services Criteria text and points of focus are AICPA material; read them from your licensed copy.',
 assessor: 'An independent US CPA firm issues the SOC 2 report.',
 editions: [{
  id: 'tsc-2017-pof-2022', label: '2017 Trust Services Criteria (revised points of focus, 2022)',
  requirements: [...security.map(([ref,title]) => ({ ref, title, section: 'Security (common criteria)' })), ...optional.map(([ref,title,section]) => ({ ref, title, section, optional: section }))],
 }],
 categories: ['Availability','Confidentiality','Processing integrity','Privacy'],
}
