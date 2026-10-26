import type { CatalogueEntry } from '../tests/catalogue'
import { securityAwarenessUpdate } from './security-awareness-update'
// TRAIN-001 shipped courses. Each course is text (its own transcript, readable
// by screen readers and at any width) with a graded assessment. A course
// changes only through a new revision an owner adopts; results keep the
// revision they were earned under.
export interface Question { q: string; options: string[]; answer: number }
export interface Course { id: string; revision: number; title: string; audience: 'everyone' | 'hipaa' | 'engineering'; minutes: number; passMark: number; lessons: { title: string; text: string }[]; quiz: Question[] }
export const courseRevisions: Course[] = [
 { id: 'security-awareness', revision: 1, title: 'Security awareness', audience: 'everyone', minutes: 25, passMark: 80,
  lessons: [
   { title: 'Phishing', text: 'Most breaches start with a message that asks you to act quickly: open an attachment, sign in, pay an invoice or share a code. Check the sender address, hover over links before you click, and be suspicious of urgency and unusual requests. Never enter your password on a page you reached from an email link; go to the site yourself. Report suspicious messages with the report button or to the security team, even if you already clicked: early reports limit damage.' },
   { title: 'Passwords and multi-factor authentication', text: 'Use a password manager to create a long, unique password for every account. Never reuse a work password anywhere else. Multi-factor authentication stops most account takeovers: approve only sign-in prompts you started, and if you get a prompt you did not expect, deny it and tell the security team. Never share a password or a one-time code with anyone, including someone who says they work in IT.' },
   { title: 'Device security', text: 'Your laptop holds company and customer data. Keep disk encryption and the screen lock on, lock your screen when you step away, install updates promptly and keep endpoint protection running. Do not install unapproved software or browser extensions. Report a lost or stolen device immediately so access can be revoked.' },
   { title: 'Handling data', text: 'Treat customer data as confidential. Use only approved tools to store and share it, share the minimum needed, and never copy it to personal devices, personal email or unapproved AI tools. Classify information before sharing it, and delete it when you no longer need it, following the retention policy.' },
   { title: 'Reporting incidents', text: 'A security incident is anything that could put data or systems at risk: a lost laptop, a mistaken email to the wrong customer, malware, or a suspicious account change. Report it at once through the incident channel. You will not be blamed for reporting; delays make incidents worse. Preserve evidence: do not delete messages or wipe devices unless told to.' },
  ],
  quiz: [
   { q: 'An email from your CEO asks you to buy gift cards urgently and keep it quiet. What do you do?', options: ['Buy them quickly', 'Reply asking for details', 'Verify through a separate channel and report the message', 'Forward it to a colleague'], answer: 2 },
   { q: 'You clicked a link and entered your password on a suspicious page. What now?', options: ['Do nothing if nothing happened', 'Report it to security immediately and change your password', 'Wait to see if anything happens', 'Clear your browser history'], answer: 1 },
   { q: 'Which password practice is safest?', options: ['One strong password for everything', 'A unique password per account in a password manager', 'Writing passwords on a sticky note', 'Rotating a number at the end'], answer: 1 },
   { q: 'You receive an MFA prompt you did not start. You should:', options: ['Approve it to make it stop', 'Deny it and report it', 'Ignore it', 'Share the code with IT if they call'], answer: 1 },
   { q: 'Who may you share a one-time sign-in code with?', options: ['IT support', 'Your manager', 'Nobody', 'A vendor helping you'], answer: 2 },
   { q: 'Which keeps a laptop secure?', options: ['Disabling updates to avoid restarts', 'Disk encryption, screen lock and timely updates', 'Installing any extension you like', 'Sharing it with family'], answer: 1 },
   { q: 'Where may customer data be stored?', options: ['Personal cloud storage', 'Approved company tools only', 'A USB stick at home', 'Any AI chatbot'], answer: 1 },
   { q: 'You emailed a customer file to the wrong person. What is it?', options: ['Not important', 'A security incident to report now', 'Something to fix next week', 'Only a problem if they complain'], answer: 1 },
   { q: 'Your laptop was stolen. First step?', options: ['Buy a new one', 'Report it immediately', 'Wait a day in case it turns up', 'Change your desktop background'], answer: 1 },
   { q: 'Why report incidents quickly?', options: ['To assign blame', 'Early reports limit damage', 'It is optional', 'To avoid paperwork'], answer: 1 },
  ] },
 { id: 'hipaa-workforce', revision: 1, title: 'HIPAA privacy and security for the workforce', audience: 'hipaa', minutes: 20, passMark: 80,
  lessons: [
   { title: 'Protected health information', text: 'Protected health information (PHI) is health information that identifies a person, in any form. Electronic PHI (ePHI) is PHI created, received, stored or sent electronically. Names with diagnoses, appointment details, insurance numbers and lab results are all PHI.' },
   { title: 'Minimum necessary', text: 'Use, request and disclose only the minimum PHI needed for the task. Access PHI only for your job duties; looking up a friend, family member or celebrity is a violation even if you never share it.' },
   { title: 'Safeguards', text: 'Protect ePHI with the administrative, physical and technical safeguards in our policies: unique accounts, MFA, encryption, locked screens and approved systems only. Never send ePHI through personal email or unapproved messaging.' },
   { title: 'Breaches and sanctions', text: 'Report any suspected impermissible use or disclosure of PHI immediately. The company assesses every incident and notifies affected individuals and regulators when HIPAA requires. Violations lead to sanctions under the sanctions policy.' },
  ],
  quiz: [
   { q: 'Which is PHI?', options: ['A press release', 'A patient name with a diagnosis', 'An anonymous survey total', 'A public website'], answer: 1 },
   { q: 'Minimum necessary means:', options: ['Use all available data', 'Use only the PHI the task needs', 'Share PHI with any coworker', 'Never use PHI'], answer: 1 },
   { q: 'Looking up a celebrity patient out of curiosity is:', options: ['Allowed if you keep it private', 'A violation', 'Fine on a break', 'Allowed for managers'], answer: 1 },
   { q: 'How may ePHI be sent?', options: ['Personal email', 'Approved, encrypted systems', 'Text message', 'Any messaging app'], answer: 1 },
   { q: 'You suspect PHI went to the wrong person. You:', options: ['Report it immediately', 'Wait for a complaint', 'Delete the evidence', 'Fix it quietly'], answer: 0 },
   { q: 'Who decides whether breach notification is required?', options: ['Each employee', 'The company after a documented assessment', 'The patient', 'Nobody'], answer: 1 },
   { q: 'Which safeguard protects ePHI on a laptop?', options: ['Disk encryption', 'A shared password', 'Disabling the screen lock', 'Personal cloud backup'], answer: 0 },
   { q: 'Violating PHI policies leads to:', options: ['Nothing', 'Sanctions under the sanctions policy', 'A bonus', 'A warning only for executives'], answer: 1 },
  ] },
 { id: 'secure-coding', revision: 1, title: 'Secure coding', audience: 'engineering', minutes: 30, passMark: 80,
  lessons: [
   { title: 'OWASP Top 10', text: 'The most common web risks include broken access control, cryptographic failures, injection, insecure design, security misconfiguration, vulnerable components, authentication failures, integrity failures, logging gaps and server-side request forgery. Most are prevented by checking authorization on every request, parameterizing queries, validating input on the server and keeping dependencies patched.' },
   { title: 'Access control and injection', text: 'Enforce authorization on the server for every object a request touches; never trust identifiers from the client. Use parameterized queries or safe query builders, encode output for its context, and never build commands or queries by concatenating user input.' },
   { title: 'Secrets and dependencies', text: 'Never commit secrets; use a secret manager and rotate any secret that leaks. Keep dependencies current, review security alerts, and fix critical findings within the vulnerability SLA.' },
   { title: 'Secure development lifecycle', text: 'Every production change goes through a reviewed pull request with passing checks on a protected branch. Security testing runs before release. Production data is not used in testing without masking, and environments stay separated.' },
   { title: 'Threat modeling', text: 'Before building a feature, ask what you are building, what can go wrong, what you will do about it and whether you did a good job. Draw data flows, mark trust boundaries, and list threats such as spoofing, tampering, repudiation, information disclosure, denial of service and elevation of privilege.' },
  ],
  quiz: [
   { q: 'Where must authorization be enforced?', options: ['In the browser', 'On the server for every request', 'Only on the login page', 'In the database admin tool'], answer: 1 },
   { q: 'Prevent SQL injection with:', options: ['String concatenation', 'Parameterized queries', 'Client-side validation only', 'Longer table names'], answer: 1 },
   { q: 'A secret was committed to the repository. You:', options: ['Delete the commit and move on', 'Rotate the secret and remove it', 'Make the repository private', 'Ignore it if the repo is internal'], answer: 1 },
   { q: 'Production changes require:', options: ['A direct push', 'A reviewed pull request with passing checks', 'Manager approval by chat', 'Nothing for small fixes'], answer: 1 },
   { q: 'Testing with production data requires:', options: ['Nothing', 'Masking', 'A faster laptop', 'Admin rights'], answer: 1 },
   { q: 'Which is an OWASP Top 10 risk?', options: ['Broken access control', 'Slow builds', 'Long variable names', 'Tabs versus spaces'], answer: 0 },
   { q: 'Critical dependency findings are fixed:', options: ['Whenever convenient', 'Within the vulnerability SLA', 'Never', 'Only before audits'], answer: 1 },
   { q: 'Threat modeling starts by asking:', options: ['Who to blame', 'What are we building and what can go wrong', 'Which framework is fastest', 'How to skip review'], answer: 1 },
   { q: 'STRIDE includes:', options: ['Spoofing and tampering', 'Speed and design', 'Sprints and demos', 'Styling and fonts'], answer: 0 },
   { q: 'Output should be:', options: ['Encoded for its context', 'Left raw for speed', 'Encrypted always', 'Uppercased'], answer: 0 },
  ] },
]
courseRevisions.push(securityAwarenessUpdate(courseRevisions.find(c => c.id === 'security-awareness')!))
export const courses: Course[] = [...new Set(courseRevisions.map(c => c.id))].map(id => courseRevisions.filter(c => c.id === id).reduce((latest, c) => c.revision > latest.revision ? c : latest))
export const course = (id: string, revision?: number) => revision === undefined ? courses.find(c => c.id === id) : courseRevisions.find(c => c.id === id && c.revision === revision)
// Grade an attempt: answers are option indexes; the score is a percentage.
export function grade(c: Course, answers: number[]) {
 if (answers.length !== c.quiz.length || answers.some(a => !Number.isInteger(a) || a < 0 || a > 3)) return null
 const correct = c.quiz.filter((q, i) => q.answer === answers[i]).length, score = Math.round(correct / c.quiz.length * 100)
 return { correct, total: c.quiz.length, score, passed: score >= c.passMark }
}
// The training test (LIBRARY-001 personnel class): no overdue assignment.
export const trainingTest: CatalogueEntry = {
 id: 'training.current', name: 'People complete assigned training on time', providers: ['training'], resourceType: 'training.person', evidenceClass: 'Security training',
 criteria: [{ attribute: 'overdue', op: 'max', value: 0 }], cadence: 'daily', category: 'personnel', severity: 'medium', controls: ['HR-03'], configuration: false,
 remediation: { training: { console: 'Training → the campaign → remind the people who are overdue, extend the schedule with a reason, or record an approved internal course.', api: 'GET /api/training/export' } },
}
