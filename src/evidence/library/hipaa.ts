import type { Framework } from './types'
// 45 CFR Part 164 Subpart C (Security Rule) standards and implementation
// specifications, and Subpart D (Breach Notification). US federal regulation text
// is public domain; (R) required and (A) addressable as the rule designates them.
const security: [string, string][] = [
 ['164.308(a)(1)(i)','Security management process'],['164.308(a)(1)(ii)(A)','Risk analysis (R)'],['164.308(a)(1)(ii)(B)','Risk management (R)'],['164.308(a)(1)(ii)(C)','Sanction policy (R)'],['164.308(a)(1)(ii)(D)','Information system activity review (R)'],
 ['164.308(a)(2)','Assigned security responsibility (R)'],
 ['164.308(a)(3)(i)','Workforce security'],['164.308(a)(3)(ii)(A)','Authorization and/or supervision (A)'],['164.308(a)(3)(ii)(B)','Workforce clearance procedure (A)'],['164.308(a)(3)(ii)(C)','Termination procedures (A)'],
 ['164.308(a)(4)(i)','Information access management'],['164.308(a)(4)(ii)(A)','Isolating health care clearinghouse functions (R)'],['164.308(a)(4)(ii)(B)','Access authorization (A)'],['164.308(a)(4)(ii)(C)','Access establishment and modification (A)'],
 ['164.308(a)(5)(i)','Security awareness and training'],['164.308(a)(5)(ii)(A)','Security reminders (A)'],['164.308(a)(5)(ii)(B)','Protection from malicious software (A)'],['164.308(a)(5)(ii)(C)','Log-in monitoring (A)'],['164.308(a)(5)(ii)(D)','Password management (A)'],
 ['164.308(a)(6)(i)','Security incident procedures'],['164.308(a)(6)(ii)','Response and reporting (R)'],
 ['164.308(a)(7)(i)','Contingency plan'],['164.308(a)(7)(ii)(A)','Data backup plan (R)'],['164.308(a)(7)(ii)(B)','Disaster recovery plan (R)'],['164.308(a)(7)(ii)(C)','Emergency mode operation plan (R)'],['164.308(a)(7)(ii)(D)','Testing and revision procedures (A)'],['164.308(a)(7)(ii)(E)','Applications and data criticality analysis (A)'],
 ['164.308(a)(8)','Evaluation (R)'],['164.308(b)(1)','Business associate contracts and other arrangements (R)'],
 ['164.310(a)(1)','Facility access controls'],['164.310(a)(2)(i)','Contingency operations (A)'],['164.310(a)(2)(ii)','Facility security plan (A)'],['164.310(a)(2)(iii)','Access control and validation procedures (A)'],['164.310(a)(2)(iv)','Maintenance records (A)'],
 ['164.310(b)','Workstation use (R)'],['164.310(c)','Workstation security (R)'],
 ['164.310(d)(1)','Device and media controls'],['164.310(d)(2)(i)','Disposal (R)'],['164.310(d)(2)(ii)','Media re-use (R)'],['164.310(d)(2)(iii)','Accountability (A)'],['164.310(d)(2)(iv)','Data backup and storage (A)'],
 ['164.312(a)(1)','Access control'],['164.312(a)(2)(i)','Unique user identification (R)'],['164.312(a)(2)(ii)','Emergency access procedure (R)'],['164.312(a)(2)(iii)','Automatic logoff (A)'],['164.312(a)(2)(iv)','Encryption and decryption (A)'],
 ['164.312(b)','Audit controls (R)'],['164.312(c)(1)','Integrity'],['164.312(c)(2)','Mechanism to authenticate electronic PHI (A)'],['164.312(d)','Person or entity authentication (R)'],
 ['164.312(e)(1)','Transmission security'],['164.312(e)(2)(i)','Integrity controls (A)'],['164.312(e)(2)(ii)','Encryption (A)'],
 ['164.314(a)','Business associate contracts or other arrangements'],['164.314(b)','Requirements for group health plans'],
 ['164.316(a)','Policies and procedures'],['164.316(b)(1)','Documentation'],['164.316(b)(2)(i)','Time limit: retain six years (R)'],['164.316(b)(2)(ii)','Availability (R)'],['164.316(b)(2)(iii)','Updates (R)'],
]
const breach: [string, string][] = [
 ['164.402','Breach risk assessment (four-factor)'],['164.404','Notification to individuals'],['164.406','Notification to the media'],['164.408','Notification to the Secretary'],['164.410','Notification by a business associate'],['164.412','Law enforcement delay'],['164.414','Burden of proof'],
]
export const hipaa: Framework = {
 id: 'hipaa', name: 'HIPAA', licence: '45 CFR Part 164 is US federal regulation; references are public.',
 assessor: 'HIPAA has no certification. Qualified assessors and counsel determine your obligations.',
 editions: [{ id: 'security-breach-2013', label: 'Security Rule and Breach Notification Rule (as amended 2013)', requirements: [
  ...security.map(([ref,title]) => ({ ref, title, section: 'Security Rule · '+(ref.startsWith('164.308') ? 'Administrative safeguards' : ref.startsWith('164.310') ? 'Physical safeguards' : ref.startsWith('164.312') ? 'Technical safeguards' : ref.startsWith('164.314') ? 'Organizational requirements' : 'Policies and documentation') })),
  ...breach.map(([ref,title]) => ({ ref, title, section: 'Breach Notification Rule' })),
 ] }],
}
