import type { CatalogueEntry } from '../tests/catalogue'
import { googleToken, OAuthFailure, serviceAccount } from '../oauth'
import { cloudCall, CloudFailure, type Item, type ScopedCloud } from './scoped'
// Google Cloud (CLOUD-001): a service account with read-only roles at the
// organization or folder (Viewer, Security Reviewer) lists every project it
// can see and reads IAM, Cloud Storage, service account keys, Cloud SQL and
// firewall rules in each. Nothing here can change a project.
const label = 'Google Cloud'
const scope = 'https://www.googleapis.com/auth/cloud-platform.read-only'
const DAY = 86400000
const record = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value)
const named = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(named)
function drift(field: string): never { throw new CloudFailure('unavailable', `Google Cloud schema drift: ${field}`) }
function rows(body: unknown, field: string, optional = false): Record<string, any>[] {
 if (!record(body)) drift(field + ' response')
 if (optional && body[field] === undefined) return []
 if (!Array.isArray(body[field]) || !body[field].every(record)) drift(field + ' must be an array of records')
 return body[field]
}
function bindings(body: unknown) {
 const result = rows(body, 'bindings')
 if (!result.every(b => named(b.role) && strings(b.members))) drift('IAM binding role or members')
 return result
}
const world = (members: unknown) => Array.isArray(members) && members.some(m => m === 'allUsers' || m === 'allAuthenticatedUsers')
async function all<T>(url: string, token: string, key: string, limit = 20) {
 const items: T[] = [], seen = new Set<string>(); let page = ''
 for (let n = 0; n < limit; n++) {
  if (seen.has(page)) throw new CloudFailure('unavailable', 'Google Cloud pagination incomplete: repeated page token')
  seen.add(page)
  const body = await cloudCall(url + (page ? (url.includes('?') ? '&' : '?') + 'pageToken=' + encodeURIComponent(page) : ''), token, label)
  items.push(...rows(body, key) as T[])
  const next = body!.nextPageToken
  if (next === undefined || next === '') return items
  if (!named(next)) drift('nextPageToken')
  page = next
 }
 throw new CloudFailure('unavailable', 'Google Cloud pagination incomplete: page limit reached')
}
const adminPorts = (allowed: { IPProtocol?: string; ports?: string[] }[] | undefined) => (allowed ?? []).some(a => a.IPProtocol === 'all' || (a.IPProtocol === 'tcp' && (!a.ports?.length || a.ports.some(p => { const [from, to] = p.split('-').map(Number); return [22, 3389].some(port => from <= port && port <= (to ?? from)) }))))
export const gcp: ScopedCloud = {
 name: 'Google Cloud', scopeLabel: 'projects', revision: 'gcp-2', scopeType: 'gcp.project',
 credential: 'A service account key (JSON) with Viewer and Security Reviewer granted on the organization or folder', permissions: ['roles/viewer', 'roles/iam.securityReviewer', 'roles/browser at the organization or folder to list projects'],
 fields: [],
 types: {
  'gcp.project': { fields: { readable: 'boolean', public_iam: 'boolean', data_access_logs: 'boolean' }, required: [] },
  'gcp.bucket': { fields: { public: 'boolean', public_access_prevention: 'boolean' }, required: [] },
  'gcp.sa_key': { fields: { account: 'string', age_days: 'number' }, required: [] },
  'gcp.sql_instance': { fields: { backups_enabled: 'boolean', public_ip_open: 'boolean', ssl_required: 'boolean' }, required: [] },
  'gcp.firewall': { fields: { network: 'string', open_admin_ports: 'boolean' }, required: [] },
 },
 account: (_config, secret) => { try { return serviceAccount(secret).client_email.toLowerCase() } catch (error) { if (error instanceof OAuthFailure) throw new CloudFailure('unauthorized', error.message); throw error } },
 async authorize(_config, secret, now) { try { return await googleToken(secret, scope, null, now, 'Google refused the service account key') } catch (error) { if (error instanceof OAuthFailure) throw new CloudFailure(error.kind, error.message); throw error } },
 async discover(token) { const projects = await all<{ projectId: string; name?: string; lifecycleState?: string }>('https://cloudresourcemanager.googleapis.com/v1/projects?filter=lifecycleState%3AACTIVE&pageSize=500', token, 'projects'); if (!projects.every(p => named(p.projectId) && /^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(p.projectId) && (p.name === undefined || named(p.name)))) drift('project identity'); return { scopes: projects.map(p => ({ id: p.projectId, name: `${p.name ?? p.projectId} (${p.projectId})` })), complete: true } },
 classes: [
  { name: 'IAM policy and audit logging', types: ['gcp.project'], async read(token, project) {
   const policy = await cloudCall(`https://cloudresourcemanager.googleapis.com/v1/projects/${encodeURIComponent(project.id)}:getIamPolicy`, token, label, { method: 'POST', body: JSON.stringify({ options: { requestedPolicyVersion: 3 } }) }) ?? {}
   bindings(policy)
   if (policy.auditConfigs !== undefined && (!Array.isArray(policy.auditConfigs) || !policy.auditConfigs.every(a => record(a) && named(a.service) && Array.isArray(a.auditLogConfigs) && a.auditLogConfigs.every((c: unknown) => record(c) && ['ADMIN_READ', 'DATA_READ', 'DATA_WRITE'].includes(c.logType))))) drift('audit log configuration')
   const audit = ((policy.auditConfigs as { service: string; auditLogConfigs?: { logType: string }[] }[] | undefined) ?? []).find(a => a.service === 'allServices'), types = new Set((audit?.auditLogConfigs ?? []).map(c => c.logType))
   return { 'gcp.project': [{ uniqueId: project.id, displayName: project.name, attributes: { public_iam: ((policy.bindings as { members?: string[] }[] | undefined) ?? []).some(b => world(b.members)), data_access_logs: types.has('DATA_READ') && types.has('DATA_WRITE') } }] }
  } },
  { name: 'Cloud Storage', types: ['gcp.bucket'], async read(token, project) {
   const buckets = await all<{ name: string; iamConfiguration?: { publicAccessPrevention?: string } }>(`https://storage.googleapis.com/storage/v1/b?project=${encodeURIComponent(project.id)}&maxResults=1000`, token, 'items')
   const items: Item[] = []
   if (buckets.length > 200) throw new CloudFailure('unavailable', 'Google Cloud storage coverage incomplete: more than 200 buckets')
   if (!buckets.every(b => named(b.name) && record(b.iamConfiguration) && ['enforced', 'inherited'].includes(b.iamConfiguration.publicAccessPrevention as string))) drift('bucket identity or public access prevention')
   for (const b of buckets) { const iam = await cloudCall(`https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(b.name)}/iam`, token, label) ?? {}; bindings(iam); const prevention = b.iamConfiguration?.publicAccessPrevention === 'enforced'; items.push({ uniqueId: `${project.id}/${b.name}`, displayName: `${b.name} (${project.id})`, attributes: { public_access_prevention: prevention, public: !prevention && ((iam.bindings as { members?: string[] }[] | undefined) ?? []).some(x => world(x.members)) } }) }
   return { 'gcp.bucket': items }
  } },
  { name: 'Service account keys', types: ['gcp.sa_key'], async read(token, project, now) {
   const accounts = await all<{ email: string; name: string }>(`https://iam.googleapis.com/v1/projects/${encodeURIComponent(project.id)}/serviceAccounts?pageSize=100`, token, 'accounts'), items: Item[] = []
   if (accounts.length > 200) throw new CloudFailure('unavailable', 'Google Cloud key coverage incomplete: more than 200 service accounts')
   for (const a of accounts) {
    if (!named(a.email) || !named(a.name) || !a.name.startsWith(`projects/${project.id}/serviceAccounts/`) || /[?#\\\x00-\x1f]/.test(a.name)) drift('service account identity or parent')
    for (const k of rows(await cloudCall(`https://iam.googleapis.com/v1/${a.name}/keys?keyTypes=USER_MANAGED`, token, label), 'keys', true)) {
     if (!named(k.name) || !k.name.startsWith(a.name + '/keys/') || (k.disabled !== undefined && typeof k.disabled !== 'boolean') || !named(k.validAfterTime) || !Number.isFinite(Date.parse(k.validAfterTime))) drift('service account key identity, status or creation time')
     if (!k.disabled) items.push({ uniqueId: `${project.id}/${k.name.split('/').pop()}`, displayName: `${a.email} key ${k.name.split('/').pop()!.slice(0, 8)}`, attributes: { account: a.email, age_days: Math.floor((now.getTime() - Date.parse(k.validAfterTime)) / DAY) } })
    }
   }
   return { 'gcp.sa_key': items }
  } },
  { name: 'Cloud SQL', types: ['gcp.sql_instance'], async read(token, project) {
   const instances = await all<{ name: string; settings?: { backupConfiguration?: { enabled?: boolean }; ipConfiguration?: { ipv4Enabled?: boolean; authorizedNetworks?: { value: string }[]; requireSsl?: boolean; sslMode?: string } } }>(`https://sqladmin.googleapis.com/v1/projects/${encodeURIComponent(project.id)}/instances`, token, 'items')
   if (!instances.every(i => named(i.name) && record(i.settings) && record(i.settings.backupConfiguration) && typeof i.settings.backupConfiguration.enabled === 'boolean' && record(i.settings.ipConfiguration) && typeof i.settings.ipConfiguration.ipv4Enabled === 'boolean' && (i.settings.ipConfiguration.authorizedNetworks === undefined || Array.isArray(i.settings.ipConfiguration.authorizedNetworks) && i.settings.ipConfiguration.authorizedNetworks.every(n => record(n) && named(n.value))) && (typeof i.settings.ipConfiguration.requireSsl === 'boolean' || ['ALLOW_UNENCRYPTED_AND_ENCRYPTED', 'ENCRYPTED_ONLY', 'TRUSTED_CLIENT_CERTIFICATE_REQUIRED'].includes(i.settings.ipConfiguration.sslMode as string)))) drift('SQL identity, backup, public network or SSL configuration')
   return { 'gcp.sql_instance': instances.map(i => { const ip = i.settings?.ipConfiguration; return { uniqueId: `${project.id}/${i.name}`, displayName: `${i.name} (${project.id})`, attributes: { backups_enabled: i.settings?.backupConfiguration?.enabled === true, public_ip_open: ip?.ipv4Enabled === true && (ip.authorizedNetworks ?? []).some(n => n.value === '0.0.0.0/0'), ssl_required: ip?.requireSsl === true || ip?.sslMode === 'ENCRYPTED_ONLY' || ip?.sslMode === 'TRUSTED_CLIENT_CERTIFICATE_REQUIRED' } } }) }
  } },
  { name: 'Firewall rules', types: ['gcp.firewall'], async read(token, project) {
   const rules = await all<{ name: string; network?: string; direction?: string; disabled?: boolean; sourceRanges?: string[]; allowed?: { IPProtocol?: string; ports?: string[] }[] }>(`https://compute.googleapis.com/compute/v1/projects/${encodeURIComponent(project.id)}/global/firewalls`, token, 'items')
   if (!rules.every(r => named(r.name) && named(r.network) && ['INGRESS', 'EGRESS'].includes(r.direction as string) && (r.disabled === undefined || typeof r.disabled === 'boolean') && (r.direction === 'EGRESS' || strings(r.sourceRanges)) && (r.allowed === undefined || Array.isArray(r.allowed) && r.allowed.every(a => record(a) && named(a.IPProtocol) && (a.ports === undefined || strings(a.ports)))))) drift('firewall identity, direction, source or allowed ports')
   return { 'gcp.firewall': rules.map(r => ({ uniqueId: `${project.id}/${r.name}`, displayName: `${r.name} (${project.id})`, attributes: { network: String(r.network ?? '').split('/').pop() ?? '', open_admin_ports: r.direction !== 'EGRESS' && !r.disabled && (r.sourceRanges ?? []).some(s => s === '0.0.0.0/0' || s === '::/0') && adminPorts(r.allowed) } })) }
  } },
 ],
}
const steps = (console: string, api: string, terraform?: string, noTerraform?: string) => ({ gcp: { console, api, ...(terraform ? { terraform } : {}), ...(noTerraform ? { noTerraform } : {}) } })
export const gcpCatalogue: CatalogueEntry[] = [
 { id: 'gcp.public-iam', name: 'No Google Cloud project grants roles to allUsers', providers: ['gcp'], resourceType: 'gcp.project', evidenceClass: 'IAM and MFA', criteria: [{ attribute: 'public_iam', op: 'equals', value: false }], cadence: 'hourly', category: 'identity', severity: 'critical', controls: ['AC-03', 'AC-08'], configuration: true,
  remediation: steps('IAM & Admin → IAM → remove allUsers and allAuthenticatedUsers principals from every role.', 'gcloud projects remove-iam-policy-binding PROJECT --member=allUsers --role=ROLE', 'resource "google_project_iam_binding" "viewers" {\n  project = "PROJECT"\n  role    = "roles/viewer"\n  members = ["group:engineering@example.com"] # never allUsers or allAuthenticatedUsers\n}') },
 { id: 'gcp.sa-key-age', name: 'Service account keys are rotated within 90 days', providers: ['gcp'], resourceType: 'gcp.sa_key', evidenceClass: 'IAM and MFA', criteria: [{ attribute: 'age_days', op: 'max', value: 90 }], cadence: 'daily', category: 'identity', severity: 'medium', controls: ['AC-07', 'AC-13'], configuration: true,
  remediation: steps('IAM & Admin → Service accounts → the account → Keys → add a key, move the workload, delete the old key; prefer workload identity over keys.', 'gcloud iam service-accounts keys create new.json --iam-account=SA; gcloud iam service-accounts keys delete KEY_ID --iam-account=SA', undefined, 'Keys created by Terraform land in state; rotate them operationally or replace them with workload identity federation.') },
 { id: 'gcp.mfa', name: 'Google Cloud users sign in with 2-Step Verification', providers: ['gcp'], resourceType: 'gcp.project', evidenceClass: 'IAM and MFA', cadence: 'hourly', category: 'identity', severity: 'high', controls: ['AC-05'], configuration: true, unsupported: true,
  manualRequirement: 'AC-05 evidence from the identity provider: connect Google Workspace or Cloud Identity (IDENTITY-001), whose MFA test covers Google Cloud sign-in.',
  remediation: steps('Google Admin console → Security → 2-Step Verification → enforce for everyone with Google Cloud access.', 'Read isEnrolledIn2Sv through the Admin SDK Directory API', undefined, 'MFA is enforced in Google Workspace or Cloud Identity, not in a Google Cloud project.') },
 { id: 'gcp.bucket-public', name: 'Cloud Storage buckets are not public', providers: ['gcp'], resourceType: 'gcp.bucket', evidenceClass: 'Public storage', criteria: [{ attribute: 'public', op: 'equals', value: false }], cadence: 'hourly', category: 'cloud', severity: 'high', controls: ['DAT-08', 'VEN-03'], configuration: true,
  remediation: steps('Cloud Storage → the bucket → Permissions → Prevent public access; remove allUsers and allAuthenticatedUsers.', 'gcloud storage buckets update gs://BUCKET --public-access-prevention', 'resource "google_storage_bucket" "bucket" {\n  name                        = "BUCKET"\n  location                    = "US"\n  public_access_prevention    = "enforced"\n  uniform_bucket_level_access = true\n}') },
 { id: 'gcp.encryption-at-rest', name: 'Google Cloud data is encrypted at rest', providers: ['gcp'], resourceType: 'gcp.bucket', evidenceClass: 'Encryption at rest', cadence: 'daily', category: 'cloud', severity: 'medium', controls: ['DAT-02'], configuration: true, unsupported: true,
  manualRequirement: 'DAT-02 record of Google Cloud default encryption at rest, plus customer-managed key (CMEK) configuration where contracts require it; Evidence does not yet read key configuration.',
  remediation: steps('Cloud KMS → create a key ring and key; set it as the default key on buckets and databases that require CMEK.', 'gcloud storage buckets update gs://BUCKET --default-encryption-key=KEY', 'resource "google_storage_bucket" "bucket" {\n  name     = "BUCKET"\n  location = "US"\n  encryption {\n    default_kms_key_name = google_kms_crypto_key.key.id\n  }\n}') },
 { id: 'gcp.sql-ssl', name: 'Cloud SQL requires encrypted connections', providers: ['gcp'], resourceType: 'gcp.sql_instance', evidenceClass: 'Encryption in transit', criteria: [{ attribute: 'ssl_required', op: 'equals', value: true }], cadence: 'hourly', category: 'cloud', severity: 'high', controls: ['DAT-03'], configuration: true,
  remediation: steps('SQL → the instance → Connections → Security → Allow only SSL connections.', 'gcloud sql instances patch INSTANCE --ssl-mode=ENCRYPTED_ONLY', 'resource "google_sql_database_instance" "db" {\n  # ...\n  settings {\n    ip_configuration {\n      ssl_mode = "ENCRYPTED_ONLY"\n    }\n  }\n}') },
 { id: 'gcp.audit-logs', name: 'Data Access audit logs are on for all services', providers: ['gcp'], resourceType: 'gcp.project', evidenceClass: 'Logging and monitoring', criteria: [{ attribute: 'data_access_logs', op: 'equals', value: true }], cadence: 'hourly', category: 'cloud', severity: 'high', controls: ['OPS-01'], configuration: true,
  remediation: steps('IAM & Admin → Audit Logs → Default configuration → Data Read and Data Write on.', 'gcloud projects get-iam-policy PROJECT > policy.yaml; add auditConfigs for allServices; gcloud projects set-iam-policy PROJECT policy.yaml', 'resource "google_project_iam_audit_config" "all" {\n  project = "PROJECT"\n  service = "allServices"\n  audit_log_config { log_type = "DATA_READ" }\n  audit_log_config { log_type = "DATA_WRITE" }\n}') },
 { id: 'gcp.sql-backups', name: 'Cloud SQL instances run automated backups', providers: ['gcp'], resourceType: 'gcp.sql_instance', evidenceClass: 'Backup', criteria: [{ attribute: 'backups_enabled', op: 'equals', value: true }], cadence: 'hourly', category: 'cloud', severity: 'high', controls: ['OPS-08'], configuration: true,
  remediation: steps('SQL → the instance → Edit → Data protection → Automate backups.', 'gcloud sql instances patch INSTANCE --backup-start-time=03:00', 'resource "google_sql_database_instance" "db" {\n  # ...\n  settings {\n    backup_configuration {\n      enabled = true\n    }\n  }\n}') },
 { id: 'gcp.sql-public', name: 'Cloud SQL is not open to the internet', providers: ['gcp'], resourceType: 'gcp.sql_instance', evidenceClass: 'Network configuration', criteria: [{ attribute: 'public_ip_open', op: 'equals', value: false }], cadence: 'hourly', category: 'cloud', severity: 'high', controls: ['OPS-14'], configuration: true,
  remediation: steps('SQL → the instance → Connections → Networking → remove 0.0.0.0/0 from authorized networks; prefer private IP.', 'gcloud sql instances patch INSTANCE --clear-authorized-networks', 'resource "google_sql_database_instance" "db" {\n  # ...\n  settings {\n    ip_configuration {\n      ipv4_enabled    = false\n      private_network = google_compute_network.vpc.id\n    }\n  }\n}') },
 { id: 'gcp.firewall-admin-ports', name: 'No firewall rule opens SSH or RDP to the internet', providers: ['gcp'], resourceType: 'gcp.firewall', evidenceClass: 'Network configuration', criteria: [{ attribute: 'open_admin_ports', op: 'equals', value: false }], cadence: 'hourly', category: 'cloud', severity: 'high', controls: ['OPS-14'], configuration: true,
  remediation: steps('VPC network → Firewall → the rule → remove 0.0.0.0/0 for tcp:22 and tcp:3389; use IAP TCP forwarding instead.', 'gcloud compute firewall-rules update RULE --source-ranges=35.235.240.0/20', 'resource "google_compute_firewall" "ssh_iap" {\n  name          = "allow-ssh-from-iap"\n  network       = google_compute_network.vpc.name\n  source_ranges = ["35.235.240.0/20"]\n  allow {\n    protocol = "tcp"\n    ports    = ["22"]\n  }\n}') },
]
