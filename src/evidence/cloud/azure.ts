import type { CatalogueEntry } from '../tests/catalogue'
import { microsoftToken, OAuthFailure } from '../oauth'
import { cloudCall, CloudFailure, type Item, type ScopedCloud } from './scoped'
// Microsoft Azure (CLOUD-001) through Azure Resource Manager with an app
// registration holding Reader and Security Reader on the subscriptions or a
// management group. Every subscription it can list is read; nothing here
// can change one.
const label = 'Azure'
const arm = 'https://management.azure.com'
// COLLECTION-001: ARM list envelopes and continuation links must be complete.
// A missing/malformed page is not an empty inventory. Throwing preserves the
// class's known resources as unknown through the shared scoped collector.
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
function drift(field: string): never { throw new CloudFailure('unavailable', `Azure schema drift: ${field}`) }
async function list<T>(url: string, token: string, limit = 20) {
 const items: T[] = [], seen = new Set<string>(); let next: string | null = url
 while (next) {
  if (seen.has(next) || seen.size >= limit) throw new CloudFailure('unavailable', 'Azure pagination incomplete: repeated continuation or page limit reached')
  seen.add(next)
  const body = await cloudCall(next, token, label)
  if (!record(body) || !Array.isArray(body.value) || !body.value.every(record)) drift('list value must be an array of records')
  items.push(...body.value as T[])
  const link = body.nextLink
  if (link === undefined || link === null || link === '') { next = null; continue }
  if (typeof link !== 'string') drift('nextLink must be a string')
  let continuation: URL
  try { continuation = new URL(link) } catch { throw new CloudFailure('unavailable', 'Azure pagination incomplete: invalid continuation') }
  if (continuation.origin !== arm || continuation.username || continuation.password || continuation.hash) throw new CloudFailure('unavailable', 'Azure pagination incomplete: unsupported continuation')
  next = continuation.href
 }
 return items
}
const sub = (id: string) => `${arm}/subscriptions/${encodeURIComponent(id)}`
const openToInternet = (rule: { direction?: string; access?: string; sourceAddressPrefix?: string; sourceAddressPrefixes?: string[]; destinationPortRange?: string; destinationPortRanges?: string[] }) => {
 const sources = [rule.sourceAddressPrefix, ...(rule.sourceAddressPrefixes ?? [])].filter(Boolean) as string[], ports = [rule.destinationPortRange, ...(rule.destinationPortRanges ?? [])].filter(Boolean) as string[]
 return rule.direction === 'Inbound' && rule.access === 'Allow' && sources.some(s => ['*', '0.0.0.0/0', 'Internet', 'Any'].includes(s)) && ports.some(p => { if (p === '*') return true; const [from, to] = p.split('-').map(Number); return [22, 3389].some(port => from <= port && port <= (to ?? from)) })
}
export const azure: ScopedCloud = {
 name: 'Microsoft Azure', scopeLabel: 'subscriptions', revision: 'azure-2', scopeType: 'azure.subscription',
 credential: 'An app registration client secret; grant the app Reader and Security Reader on the subscriptions or a management group', permissions: ['Reader', 'Security Reader'],
 fields: [{ key: 'tenant_id', label: 'Directory (tenant) ID', required: true, pattern: /^[0-9a-f-]{36}$/ }, { key: 'client_id', label: 'Application (client) ID', required: true, pattern: /^[0-9a-f-]{36}$/ }],
 types: {
  'azure.subscription': { fields: { readable: 'boolean', activity_log_exported: 'boolean', defender_enabled: 'boolean' }, required: [] },
  'azure.storage_account': { fields: { public_blob_access: 'boolean', https_only: 'boolean', min_tls_12: 'boolean' }, required: [] },
  'azure.sql_server': { fields: { public_network: 'boolean' }, required: [] },
  'azure.sql_database': { fields: { backup_retention_days: 'number' }, required: [] },
  'azure.nsg': { fields: { open_admin_ports: 'boolean' }, required: [] },
 },
 account: config => config.tenant_id,
 async authorize(config, secret) { try { return await microsoftToken(config.tenant_id, config.client_id, secret, arm) } catch (error) { if (error instanceof OAuthFailure) throw new CloudFailure(error.kind, error.message); throw error } },
 async discover(token) { const subs = await list<{ subscriptionId: string; displayName?: string; state?: string }>(`${arm}/subscriptions?api-version=2022-12-01`, token); if (!subs.every(s => typeof s.subscriptionId === 'string' && s.subscriptionId.length > 0 && (s.state === undefined || typeof s.state === 'string'))) drift('subscription identity or state'); return { scopes: subs.filter(s => s.state !== 'Disabled').map(s => ({ id: s.subscriptionId, name: `${s.displayName ?? s.subscriptionId} (${s.subscriptionId})` })), complete: true } },
 classes: [
  { name: 'Activity log export', types: ['azure.subscription'], async read(token, s) { const settings = await list<unknown>(`${sub(s.id)}/providers/Microsoft.Insights/diagnosticSettings?api-version=2021-05-01-preview`, token); return { 'azure.subscription': [{ uniqueId: s.id, displayName: s.name, attributes: { activity_log_exported: settings.length > 0 } }] } } },
  { name: 'Defender for Cloud', types: ['azure.subscription'], async read(token, s) { const plans = await list<{ name: string; properties?: { pricingTier?: string } }>(`${sub(s.id)}/providers/Microsoft.Security/pricings?api-version=2024-01-01`, token); return { 'azure.subscription': [{ uniqueId: s.id, displayName: s.name, attributes: { defender_enabled: plans.some(p => ['VirtualMachines', 'StorageAccounts', 'SqlServers'].includes(p.name) && p.properties?.pricingTier === 'Standard') } }] } } },
  { name: 'Storage accounts', types: ['azure.storage_account'], async read(token, s) {
   const accounts = await list<{ name: string; properties?: { allowBlobPublicAccess?: boolean; supportsHttpsTrafficOnly?: boolean; minimumTlsVersion?: string } }>(`${sub(s.id)}/providers/Microsoft.Storage/storageAccounts?api-version=2023-05-01`, token)
   return { 'azure.storage_account': accounts.map(a => ({ uniqueId: `${s.id}/${a.name}`, displayName: `${a.name} (${s.id})`, attributes: { public_blob_access: a.properties?.allowBlobPublicAccess !== false, https_only: a.properties?.supportsHttpsTrafficOnly === true, min_tls_12: ['TLS1_2', 'TLS1_3'].includes(a.properties?.minimumTlsVersion ?? '') } })) }
  } },
  { name: 'Azure SQL', types: ['azure.sql_server', 'azure.sql_database'], async read(token, s) {
   const servers = await list<{ id: string; name: string; properties?: { publicNetworkAccess?: string } }>(`${sub(s.id)}/providers/Microsoft.Sql/servers?api-version=2023-08-01-preview`, token), databases: Item[] = []
   for (const server of servers.slice(0, 50)) for (const db of (await list<{ id: string; name: string }>(`${arm}${server.id}/databases?api-version=2023-08-01-preview`, token)).filter(d => d.name !== 'master')) {
    const policy = await cloudCall(`${arm}${db.id}/backupShortTermRetentionPolicies/default?api-version=2023-08-01-preview`, token, label)
    databases.push({ uniqueId: `${s.id}/${server.name}/${db.name}`, displayName: `${server.name}/${db.name} (${s.id})`, attributes: { backup_retention_days: (policy?.properties as { retentionDays?: number } | undefined)?.retentionDays ?? null } })
   }
   return { 'azure.sql_server': servers.map(x => ({ uniqueId: `${s.id}/${x.name}`, displayName: `${x.name} (${s.id})`, attributes: { public_network: x.properties?.publicNetworkAccess !== 'Disabled' } })), 'azure.sql_database': databases }
  } },
  { name: 'Network security groups', types: ['azure.nsg'], async read(token, s) {
   const groups = await list<{ name: string; properties?: { securityRules?: { properties?: Record<string, unknown> }[] } }>(`${sub(s.id)}/providers/Microsoft.Network/networkSecurityGroups?api-version=2023-09-01`, token)
   return { 'azure.nsg': groups.map(g => {
    if (typeof g.name !== 'string' || !g.name || !record(g.properties) || !Array.isArray(g.properties.securityRules)) drift('network security group identity or securityRules')
    const rules = g.properties.securityRules
    for (const rule of rules) {
     if (!record(rule) || !record(rule.properties)) drift('network security rule properties')
     const r = rule.properties
     const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(v => typeof v === 'string' && v.length > 0)
     if ((r.direction !== 'Inbound' && r.direction !== 'Outbound') || (r.access !== 'Allow' && r.access !== 'Deny')
      || (r.sourceAddressPrefix !== undefined && (typeof r.sourceAddressPrefix !== 'string' || !r.sourceAddressPrefix))
      || (r.sourceAddressPrefixes !== undefined && !strings(r.sourceAddressPrefixes))
      || (r.destinationPortRange !== undefined && (typeof r.destinationPortRange !== 'string' || !r.destinationPortRange))
      || (r.destinationPortRanges !== undefined && !strings(r.destinationPortRanges))) drift('network security rule direction, access, source or ports')
     if (!r.sourceAddressPrefix && !(strings(r.sourceAddressPrefixes) && r.sourceAddressPrefixes.length) && !(Array.isArray(r.sourceApplicationSecurityGroups) && r.sourceApplicationSecurityGroups.length && r.sourceApplicationSecurityGroups.every(v => record(v) && typeof v.id === 'string' && v.id.length))) drift('network security rule source')
     if (!r.destinationPortRange && !(strings(r.destinationPortRanges) && r.destinationPortRanges.length)) drift('network security rule ports')
    }
    return { uniqueId: `${s.id}/${g.name}`, displayName: `${g.name} (${s.id})`, attributes: { open_admin_ports: rules.some(r => openToInternet(r.properties as never)) } }
   }) }
  } },
 ],
}
const steps = (console: string, api: string, terraform?: string, noTerraform?: string) => ({ azure: { console, api, ...(terraform ? { terraform } : {}), ...(noTerraform ? { noTerraform } : {}) } })
export const azureCatalogue: CatalogueEntry[] = [
 { id: 'azure.mfa', name: 'Azure users sign in with MFA', providers: ['azure'], resourceType: 'azure.subscription', evidenceClass: 'IAM and MFA', cadence: 'hourly', category: 'identity', severity: 'high', controls: ['AC-05'], configuration: true, unsupported: true,
  manualRequirement: 'AC-05 evidence from Microsoft Entra ID: connect Entra ID (IDENTITY-001), whose MFA and administrator MFA tests cover Azure sign-in.',
  remediation: steps('Entra admin center → Protection → Conditional Access → require MFA for the Microsoft Azure Management app.', 'GET https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies', 'resource "azuread_conditional_access_policy" "azure_mfa" {\n  display_name = "Require MFA for Azure management"\n  state        = "enabled"\n  conditions {\n    client_app_types = ["all"]\n    applications { included_applications = ["797f4846-ba00-4fd7-ba43-dac1f8f63013"] }\n    users { included_users = ["All"] }\n  }\n  grant_controls {\n    operator          = "OR"\n    built_in_controls = ["mfa"]\n  }\n}') },
 { id: 'azure.storage-public', name: 'Storage accounts block public blob access', providers: ['azure'], resourceType: 'azure.storage_account', evidenceClass: 'Public storage', criteria: [{ attribute: 'public_blob_access', op: 'equals', value: false }], cadence: 'hourly', category: 'cloud', severity: 'high', controls: ['DAT-08', 'VEN-03'], configuration: true,
  remediation: steps('Storage accounts → the account → Configuration → Allow Blob anonymous access: Disabled.', 'az storage account update --name ACCOUNT --resource-group RG --allow-blob-public-access false', 'resource "azurerm_storage_account" "data" {\n  # ...\n  allow_nested_items_to_be_public = false\n}') },
 { id: 'azure.storage-https', name: 'Storage accounts require HTTPS and TLS 1.2', providers: ['azure'], resourceType: 'azure.storage_account', evidenceClass: 'Encryption in transit', criteria: [{ attribute: 'https_only', op: 'equals', value: true }, { attribute: 'min_tls_12', op: 'equals', value: true }], cadence: 'hourly', category: 'cloud', severity: 'high', controls: ['DAT-03'], configuration: true,
  remediation: steps('Storage accounts → the account → Configuration → Secure transfer required: Enabled; Minimum TLS version: 1.2.', 'az storage account update --name ACCOUNT --resource-group RG --https-only true --min-tls-version TLS1_2', 'resource "azurerm_storage_account" "data" {\n  # ...\n  https_traffic_only_enabled = true\n  min_tls_version            = "TLS1_2"\n}') },
 { id: 'azure.encryption-at-rest', name: 'Azure data is encrypted at rest', providers: ['azure'], resourceType: 'azure.storage_account', evidenceClass: 'Encryption at rest', cadence: 'daily', category: 'cloud', severity: 'medium', controls: ['DAT-02'], configuration: true, unsupported: true,
  manualRequirement: 'DAT-02 record of Azure Storage Service Encryption (always on), plus customer-managed key configuration where contracts require it; Evidence does not yet read key configuration.',
  remediation: steps('Storage accounts → the account → Encryption → Customer-managed keys, where required.', 'az storage account update --name ACCOUNT --resource-group RG --encryption-key-source Microsoft.Keyvault --encryption-key-vault URI --encryption-key-name KEY', 'resource "azurerm_storage_account_customer_managed_key" "cmk" {\n  storage_account_id = azurerm_storage_account.data.id\n  key_vault_id       = azurerm_key_vault.vault.id\n  key_name           = azurerm_key_vault_key.key.name\n}') },
 { id: 'azure.activity-log', name: 'The activity log is exported for retention', providers: ['azure'], resourceType: 'azure.subscription', evidenceClass: 'Logging and monitoring', criteria: [{ attribute: 'activity_log_exported', op: 'equals', value: true }], cadence: 'hourly', category: 'cloud', severity: 'high', controls: ['OPS-01'], configuration: true,
  remediation: steps('Monitor → Activity log → Export Activity Logs → add a diagnostic setting to a Log Analytics workspace or storage account.', 'az monitor diagnostic-settings subscription create --name export --location eastus --workspace WORKSPACE_ID --logs \'[{"category":"Administrative","enabled":true}]\'', 'resource "azurerm_monitor_diagnostic_setting" "activity" {\n  name                       = "activity-log-export"\n  target_resource_id         = "/subscriptions/SUBSCRIPTION_ID"\n  log_analytics_workspace_id = azurerm_log_analytics_workspace.logs.id\n  enabled_log { category = "Administrative" }\n  enabled_log { category = "Security" }\n}') },
 { id: 'azure.defender', name: 'Microsoft Defender for Cloud protects servers, storage and SQL', providers: ['azure'], resourceType: 'azure.subscription', evidenceClass: 'Logging and monitoring', criteria: [{ attribute: 'defender_enabled', op: 'equals', value: true }], cadence: 'hourly', category: 'cloud', severity: 'high', controls: ['OPS-02', 'OPS-06'], configuration: true,
  remediation: steps('Defender for Cloud → Environment settings → the subscription → turn on Servers, Storage and Databases plans.', 'az security pricing create --name VirtualMachines --tier Standard', 'resource "azurerm_security_center_subscription_pricing" "servers" {\n  tier          = "Standard"\n  resource_type = "VirtualMachines"\n}') },
 { id: 'azure.sql-backup-retention', name: 'Azure SQL keeps 7 or more days of backups', providers: ['azure'], resourceType: 'azure.sql_database', evidenceClass: 'Backup', criteria: [{ attribute: 'backup_retention_days', op: 'min', value: 7 }], cadence: 'hourly', category: 'cloud', severity: 'high', controls: ['OPS-08'], configuration: true,
  remediation: steps('SQL servers → the server → Backups → Retention policies → point-in-time restore 7 days or more.', 'az sql db str-policy set --resource-group RG --server SERVER --name DB --retention-days 7', 'resource "azurerm_mssql_database" "db" {\n  # ...\n  short_term_retention_policy {\n    retention_days = 7\n  }\n}') },
 { id: 'azure.sql-public', name: 'Azure SQL servers deny public network access', providers: ['azure'], resourceType: 'azure.sql_server', evidenceClass: 'Network configuration', criteria: [{ attribute: 'public_network', op: 'equals', value: false }], cadence: 'hourly', category: 'cloud', severity: 'high', controls: ['OPS-14'], configuration: true,
  remediation: steps('SQL servers → the server → Networking → Public network access: Disable; use private endpoints.', 'az sql server update --name SERVER --resource-group RG --enable-public-network false', 'resource "azurerm_mssql_server" "sql" {\n  # ...\n  public_network_access_enabled = false\n}') },
 { id: 'azure.nsg-admin-ports', name: 'No network security group opens SSH or RDP to the internet', providers: ['azure'], resourceType: 'azure.nsg', evidenceClass: 'Network configuration', criteria: [{ attribute: 'open_admin_ports', op: 'equals', value: false }], cadence: 'hourly', category: 'cloud', severity: 'high', controls: ['OPS-14'], configuration: true,
  remediation: steps('Network security groups → the group → Inbound security rules → delete or narrow rules allowing 22 or 3389 from Any or Internet; use Azure Bastion.', 'az network nsg rule delete --resource-group RG --nsg-name NSG --name RULE', 'resource "azurerm_network_security_rule" "ssh_vpn" {\n  name                        = "ssh-from-vpn"\n  priority                    = 100\n  direction                   = "Inbound"\n  access                      = "Allow"\n  protocol                    = "Tcp"\n  source_address_prefix       = "10.10.0.0/16" # never * or Internet\n  source_port_range           = "*"\n  destination_port_range      = "22"\n  destination_address_prefix  = "*"\n  resource_group_name         = azurerm_resource_group.rg.name\n  network_security_group_name = azurerm_network_security_group.nsg.name\n}') },
]
