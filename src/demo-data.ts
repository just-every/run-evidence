import type { Cadence } from './evidence/model'
import type { Category, Severity } from './evidence/tests/storage'

// Illustrative Northstar Studio records, based on the seed's access-review and
// training examples. These are sample assertions, never observed customer facts.
export const sampleControls: { slug: string; name: string; group: string; proof: string; cadence: Cadence; author: string; note: string; state?: 'overdue' }[] = [
 { slug: 'production-access', name: 'Review production access', group: 'Access', proof: 'Signed production access review', cadence: 'monthly', author: 'Maya Chen', note: 'Reviewed 14 production accounts. Removed two former contractor accounts. Sarah confirmed the administrator list.' },
 { slug: 'joiners-leavers', name: 'Close access for departing employees', group: 'Access', proof: 'Joiner and leaver checklist', cadence: 'weekly', author: 'Sarah Kim', note: 'Checked the people register against identity accounts. All three leavers closed within one business day.' },
 { slug: 'privileged-access', name: 'Check privileged account use', group: 'Access', proof: 'Privileged account activity review', cadence: 'daily', author: 'Liam Brooks', note: 'Reviewed administrator activity and the emergency account log. No unexpected use recorded.' },
 { slug: 'backup', name: 'Verify customer data backups', group: 'Data', proof: 'Backup verification log', cadence: 'daily', author: 'Liam Brooks', note: 'Nightly backup completed. Object counts and checksums matched the source inventory.' },
 { slug: 'restore', name: 'Practice restoring customer records', group: 'Data', proof: 'Restore exercise notes', cadence: 'quarterly', author: 'Maya Chen', note: 'Restored an isolated sample workspace. Verified 120 records and attachments. Exercise completed in 34 minutes.' },
 { slug: 'retention', name: 'Review data retention', group: 'Data', proof: 'Retention review and deletion register', cadence: 'monthly', author: 'Sarah Kim', note: 'Reviewed expired support attachments and closed accounts. Logged the approved deletion batch.' },
 { slug: 'releases', name: 'Approve production releases', group: 'Change', proof: 'Release approval register', cadence: 'weekly', author: 'Jonah Williams', note: 'Three releases linked to reviewed changes, passing checks and named approvers. Rollback instructions retained.' },
 { slug: 'dependencies', name: 'Review dependency updates', group: 'Change', proof: 'Dependency review notes', cadence: 'weekly', author: 'Jonah Williams', note: 'Reviewed the dependency inventory and security notices. Two routine updates scheduled for the next release.' },
 { slug: 'recovery', name: 'Rehearse service recovery', group: 'Change', proof: 'Recovery exercise report', cadence: 'quarterly', author: 'Liam Brooks', note: 'Rehearsed a failed release and rollback in the practice environment. Updated the service recovery checklist.' },
 { slug: 'training', name: 'Keep security training current', group: 'People', proof: 'Training attendance register', cadence: 'quarterly', author: 'Sarah Kim', note: 'All 42 employees completed the awareness session. New starter induction materials reviewed.' },
 { slug: 'onboarding', name: 'Complete new starter induction', group: 'People', proof: 'New starter induction checklist', cadence: 'monthly', author: 'Sarah Kim', note: 'Alex Rivera completed induction, accepted the security policy and received role-specific access.' },
 { slug: 'incident-exercise', name: 'Practice incident response', group: 'People', proof: 'Incident tabletop notes', cadence: 'quarterly', author: 'Maya Chen', note: 'Walked through a lost device scenario. Updated contacts and assigned follow-up actions.', state: 'overdue' },
 { slug: 'supplier-access', name: 'Review supplier access', group: 'Vendors', proof: 'Supplier access register', cadence: 'monthly', author: 'Maya Chen', note: 'Checked the three suppliers with workspace access. Confirmed named owners, expiry dates and least privilege.' },
 { slug: 'supplier-review', name: 'Review critical service suppliers', group: 'Vendors', proof: 'Critical supplier assessment', cadence: 'quarterly', author: 'Jonah Williams', note: 'Reviewed hosting, payments and support suppliers. Current assurance documents are retained with the assessment.' },
 { slug: 'supplier-exit', name: 'Confirm supplier exit arrangements', group: 'Vendors', proof: 'Supplier exit plan review', cadence: 'quarterly', author: 'Maya Chen', note: 'Confirmed export formats, deletion contacts and a named replacement for each critical supplier. Maya completed the annual exit walkthrough.' },
]

// The people who own Northstar Studio's tested controls (illustrative, US).
export const samplePeople = [
 { name: 'Maria Alvarez', email: 'maria@northstar.test', role: 'IT lead' },
 { name: 'Sarah Kim', email: 'sarah@northstar.test', role: 'Identity' },
 { name: 'Daniel Park', email: 'daniel@northstar.test', role: 'Platform' },
 { name: 'Jordan Lee', email: 'jordan@northstar.test', role: 'Engineering manager' },
 { name: 'Ben Thomas', email: 'ben@northstar.test', role: 'IT' },
 { name: 'Alex Chen', email: 'alex@northstar.test', role: 'People operations' },
 { name: 'Taylor Brooks', email: 'taylor@northstar.test', role: 'Site reliability' },
 { name: 'Morgan Lee', email: 'morgan@northstar.test', role: 'IT' },
 { name: 'Avery Patel', email: 'avery@northstar.test', role: 'Security engineer' },
 { name: 'Riley Cooper', email: 'riley@northstar.test', role: 'Database engineer' },
 { name: 'Casey Morgan', email: 'casey@northstar.test', role: 'Endpoint engineer' },
]
// Continuous tests over pushed inventories. `runs` are hours before the demo
// starts; `drift` is when the first item fell out of policy. Two tests missed
// their daily runs and show stale until the scheduler next runs them.
export const sampleTests: { name: string; source: string; type: string; noun: string; first?: string; field: string; value: boolean | number; drifted?: boolean | number; drift?: number; count: number; control: string; owner: string; category: Category; severity: Severity; cadence: 'hourly' | 'daily'; runs: number[] }[] = [
 { name: 'MFA enforced for all users', source: 'Okta', type: 'user', noun: 'User', field: 'mfa_enforced', value: true, count: 42, control: 'AC-05', owner: 'Sarah Kim', category: 'identity', severity: 'high', cadence: 'hourly', runs: [170, 0.4] },
 { name: 'Production S3 buckets encrypted', source: 'AWS', type: 'bucket', noun: 'Bucket', field: 'default_encryption', value: true, count: 12, control: 'DAT-02', owner: 'Daniel Park', category: 'cloud', severity: 'high', cadence: 'daily', runs: [170, 3.1] },
 { name: 'Branch protection requires 2 reviewers', source: 'GitHub', type: 'repo', noun: 'Repository', field: 'required_reviews', value: 2, count: 31, control: 'CHG-01', owner: 'Jordan Lee', category: 'code', severity: 'high', cadence: 'hourly', runs: [170, 0.6] },
 { name: 'Laptop disk encryption', source: 'Jamf', type: 'device', noun: 'MacBook', first: "Maria Alvarez's MacBook Pro", field: 'filevault_enabled', value: true, drifted: false, drift: 21.5, count: 42, control: 'END-01', owner: 'Maria Alvarez', category: 'device', severity: 'high', cadence: 'daily', runs: [314, 146, 20.8] },
 { name: 'Quarterly access review', source: 'Okta', type: 'access_review', noun: 'Application', field: 'reviewed_this_quarter', value: true, count: 9, control: 'AC-04', owner: 'Ben Thomas', category: 'identity', severity: 'medium', cadence: 'daily', runs: [194, 98] },
 { name: 'Security training complete', source: 'Rippling', type: 'employee', noun: 'Employee', field: 'training_current', value: true, count: 42, control: 'HR-03', owner: 'Alex Chen', category: 'personnel', severity: 'medium', cadence: 'daily', runs: [170, 5.3] },
 { name: 'Vulnerability scans complete', source: 'Wiz', type: 'host', noun: 'Host', field: 'scanned_within_7_days', value: true, count: 18, control: 'OPS-04', owner: 'Jordan Lee', category: 'vulnerability', severity: 'critical', cadence: 'daily', runs: [170, 4.2] },
 { name: 'Audit logs retained 1 year', source: 'Datadog', type: 'log_index', noun: 'Log index', field: 'retention_days', value: 365, count: 6, control: 'OPS-01', owner: 'Taylor Brooks', category: 'cloud', severity: 'medium', cadence: 'daily', runs: [170, 5.0] },
 { name: 'Inactive users deprovisioned', source: 'Google Workspace', type: 'directory_account', noun: 'Account', field: 'active_or_suspended', value: true, count: 44, control: 'HR-05', owner: 'Morgan Lee', category: 'identity', severity: 'high', cadence: 'daily', runs: [194, 98] },
 { name: 'Encryption at rest enabled (RDS)', source: 'AWS', type: 'instance', noun: 'Database', field: 'storage_encrypted', value: true, count: 16, control: 'DAT-02', owner: 'Daniel Park', category: 'cloud', severity: 'high', cadence: 'daily', runs: [170, 6.9] },
 { name: 'SSO enforced for production', source: 'Google Workspace', type: 'app', noun: 'App', field: 'sso_required', value: true, count: 28, control: 'AC-02', owner: 'Avery Patel', category: 'identity', severity: 'high', cadence: 'hourly', runs: [170, 0.9] },
 { name: 'Backups restored successfully', source: 'AWS', type: 'restore', noun: 'Restore', field: 'restore_verified', value: true, count: 12, control: 'OPS-08', owner: 'Riley Cooper', category: 'cloud', severity: 'high', cadence: 'daily', runs: [170, 11.6] },
 { name: 'Endpoint protection active', source: 'CrowdStrike', type: 'endpoint', noun: 'Endpoint', field: 'protection_active', value: true, count: 42, control: 'OPS-06', owner: 'Casey Morgan', category: 'device', severity: 'high', cadence: 'daily', runs: [170, 50] },
]
