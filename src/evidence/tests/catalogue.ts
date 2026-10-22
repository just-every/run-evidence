import type { Criterion } from './criteria'
import { awsCatalogue } from '../cloud/catalogue'
import { gcpCatalogue } from '../cloud/gcp'
import { azureCatalogue } from '../cloud/azure'
import { identityCatalogue } from '../identity/catalogue'
import { attestationTest, policyTests } from '../policy/templates'
import { trainingTest } from '../training/courses'
// The published LIBRARY-001 test catalogue for connectors Evidence ships. Each
// entry names criteria, the evaluated resource type, mapped library controls,
// cadence and remediation per provider. Classes the provider cannot expose are
// listed as unsupported with the manual evidence requirement that replaces them.
export interface Remediation { console: string; api: string; terraform?: string; noTerraform?: string }
export interface CatalogueEntry {
 id: string; name: string; providers: string[]; resourceType: string; evidenceClass: string
 criteria?: Criterion[]; cadence: 'hourly' | 'daily'; category: 'code' | 'identity' | 'vulnerability' | 'cloud' | 'policy' | 'personnel'; severity: 'critical' | 'high' | 'medium' | 'low'
 controls: string[]; configuration: boolean; remediation: Record<string, Remediation>
 unsupported?: boolean; manualRequirement?: string
}
export const catalogueRevision = 1
export const catalogue: CatalogueEntry[] = [
 { id: 'github.branch-protection', name: 'Default branch is protected', providers: ['github'], resourceType: 'github.repository', evidenceClass: 'Branch protection',
  criteria: [{ attribute: 'branch_protection', op: 'equals', value: true }], cadence: 'hourly', category: 'code', severity: 'high', controls: ['CHG-02', 'CHG-01'], configuration: true,
  remediation: { github: {
   console: 'Repository → Settings → Branches → Add branch protection rule for the default branch (or a ruleset targeting it). Require a pull request before merging.',
   api: 'gh api -X PUT repos/OWNER/REPO/branches/BRANCH/protection --input protection.json  (PUT /repos/{owner}/{repo}/branches/{branch}/protection)',
   terraform: 'resource "github_branch_protection" "default" {\n  repository_id = github_repository.repo.node_id\n  pattern       = "main"\n  required_pull_request_reviews {\n    required_approving_review_count = 1\n  }\n}',
  } } },
 { id: 'github.required-review', name: 'Merges need at least one approving review', providers: ['github'], resourceType: 'github.repository', evidenceClass: 'Required review',
  criteria: [{ attribute: 'required_reviews', op: 'min', value: 1 }], cadence: 'hourly', category: 'code', severity: 'high', controls: ['CHG-01'], configuration: true,
  remediation: { github: {
   console: 'Repository → Settings → Branches → edit the default branch rule → Require a pull request before merging → Require approvals: 1 or more.',
   api: 'gh api -X PATCH repos/OWNER/REPO/branches/BRANCH/protection/required_pull_request_reviews -F required_approving_review_count=1',
   terraform: 'resource "github_branch_protection" "default" {\n  repository_id = github_repository.repo.node_id\n  pattern       = "main"\n  required_pull_request_reviews {\n    required_approving_review_count = 1\n    dismiss_stale_reviews           = true\n  }\n}',
  } } },
 { id: 'github.required-checks', name: 'Merges need passing status checks', providers: ['github'], resourceType: 'github.repository', evidenceClass: 'Required checks',
  criteria: [{ attribute: 'required_status_checks', op: 'min', value: 1 }], cadence: 'hourly', category: 'code', severity: 'medium', controls: ['CHG-02', 'CHG-05'], configuration: true,
  remediation: { github: {
   console: 'Repository → Settings → Branches → edit the default branch rule → Require status checks to pass before merging → add your CI checks.',
   api: 'gh api -X PATCH repos/OWNER/REPO/branches/BRANCH/protection/required_status_checks -F strict=true -f "contexts[]=ci"',
   terraform: 'resource "github_branch_protection" "default" {\n  repository_id = github_repository.repo.node_id\n  pattern       = "main"\n  required_status_checks {\n    strict   = true\n    contexts = ["ci"]\n  }\n}',
  } } },
 { id: 'github.repository-private', name: 'Repositories are private', providers: ['github'], resourceType: 'github.repository', evidenceClass: 'Repository privacy',
  criteria: [{ attribute: 'private', op: 'equals', value: true }], cadence: 'hourly', category: 'code', severity: 'high', controls: ['AC-09', 'DAT-08'], configuration: true,
  remediation: { github: {
   console: 'Repository → Settings → General → Danger Zone → Change repository visibility → Private. Mark repositories that are public by design as not applicable in the test scope with a rationale.',
   api: 'gh repo edit OWNER/REPO --visibility private --accept-visibility-change-consequences  (PATCH /repos/{owner}/{repo} {"private": true})',
   terraform: 'resource "github_repository" "repo" {\n  name       = "REPO"\n  visibility = "private"\n}',
  } } },
 { id: 'github.org-two-factor', name: 'Organization requires two-factor authentication', providers: ['github'], resourceType: 'github.organization', evidenceClass: 'Membership and MFA',
  criteria: [{ attribute: 'two_factor_requirement_enabled', op: 'equals', value: true }], cadence: 'hourly', category: 'identity', severity: 'high', controls: ['AC-05'], configuration: true,
  remediation: { github: {
   console: 'Organization → Settings → Authentication security → Require two-factor authentication for everyone in the organization.',
   api: 'GitHub has no REST call to turn this on; read it with gh api orgs/ORG --jq .two_factor_requirement_enabled after changing it in settings.',
   noTerraform: 'The GitHub Terraform provider has no organization two-factor requirement setting; change it in organization settings.',
  } } },
 { id: 'github.dependabot-critical', name: 'No open critical Dependabot alerts', providers: ['github'], resourceType: 'github.repository', evidenceClass: 'Dependency alerts',
  criteria: [{ attribute: 'open_critical_dependabot_alerts', op: 'max', value: 0 }], cadence: 'daily', category: 'vulnerability', severity: 'critical', controls: ['OPS-04'], configuration: false,
  remediation: { github: {
   console: 'Repository → Security → Dependabot → open each critical alert and merge its security update, or dismiss it with a reason after review.',
   api: 'gh api repos/OWNER/REPO/dependabot/alerts?state=open&severity=critical  then update the dependency; dismiss with PATCH /repos/{owner}/{repo}/dependabot/alerts/{number}',
  } } },
 { id: 'github.secret-scanning-open', name: 'No open secret-scanning alerts', providers: ['github'], resourceType: 'github.repository', evidenceClass: 'Secret alerts',
  criteria: [{ attribute: 'open_secret_scanning_alerts', op: 'max', value: 0 }], cadence: 'daily', category: 'vulnerability', severity: 'critical', controls: ['OPS-04'], configuration: false,
  remediation: { github: {
   console: 'Repository → Security → Secret scanning → rotate each exposed secret at its provider, then close the alert as revoked.',
   api: 'gh api repos/OWNER/REPO/secret-scanning/alerts?state=open  then PATCH /repos/{owner}/{repo}/secret-scanning/alerts/{number} {"state":"resolved","resolution":"revoked"}',
  } } },
 { id: 'github.departed-members', name: 'Departed people hold no organization membership', providers: ['github'], resourceType: 'github.organization', evidenceClass: 'Departed members',
  criteria: [{ attribute: 'departed_members', op: 'max', value: 0 }], cadence: 'daily', category: 'identity', severity: 'high', controls: ['HR-05'], configuration: false,
  remediation: { github: {
   console: 'Organization → People → remove the departed member, or convert them to an outside collaborator only if access is still approved.',
   api: 'gh api -X DELETE orgs/ORG/members/USERNAME',
   noTerraform: 'Membership removal is an operational action; github_membership resources can manage it if you hold membership in Terraform.',
  } } },
 ...awsCatalogue,
 ...gcpCatalogue,
 ...azureCatalogue,
 ...identityCatalogue,
 ...policyTests,
 attestationTest,
 trainingTest,
]
export const catalogueEntry = (id: string) => catalogue.find(e => e.id === id)
