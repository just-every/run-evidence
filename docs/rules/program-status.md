# Program and library status notes

These are the exact rules, bounds and formats behind PROGRAM-003, LIBRARY-001, CONTROL-001, POPULATION-001, CLOUD-001, IDENTITY-001, WORK-002, FOLLOWUP-001, MIGRATE-001 and AGENT-005 in [CONTRACT.md](../../CONTRACT.md). The contract holds the requirement and its acceptance; this page holds the mechanism they rely on, as recorded when the contract was rewritten to the RER contract standard on 28 October 2026.

PROGRAM-003: None for current doors. Per-SAQ mappings name their source revision; the merchant or QSA confirms against the licensed SAQ (`docs/SAQ-WORKSHEETS.md`). PROGRAM-004 inherits the document model and drift review.

LIBRARY-001: Live acceptance needs an account: applying the AWS Terraform snippet in a sandbox account. The hosting, app-account, vulnerability, security-issue, monitoring, HRIS and device catalogs ship with CLOUD-002, APPS-001, VULN-001, ISSUES-001, MONITOR-001, HRIS-001 and DEVICE-001

CONTROL-001: Current definitions, mappings and reviewed CSV/XLSX framework import conform. AGENT-006 inherits proposal decisions before its capability ships.

POPULATION-001: LIFECYCLE-001 carries consumption by future checklists; no checklist claimed today.

CLOUD-001: Live acceptance needs an account: AWS organization, GCP organization, Azure tenant sandboxes for live acceptance

IDENTITY-001: Live acceptance needs an account: tenants for each directory

WORK-002: Live acceptance needs an account

FOLLOWUP-001: Live acceptance needs an account: Slack and Teams workspaces, production mail key

MIGRATE-001: Live acceptance needs an account: no real Vanta, Drata or Secureframe tenant has been read (named Gap, ct 19 Oct 2026); the fixtures follow each provider's published schema and no provider-verification claim is made. Evidence reads API responses the owner has captured, not a live API call.

AGENT-005: None for the current native doors. Dependencies are exact owner-selected source relationships, not inferred legal equivalence. AUTH-001 retains future reviewer roles; ANSWER-002 and ANSWER-003 inherit the same freshness, exact human decision and recipient gates before their new doors ship. `docs/CUSTOMER-PROMISES.md` documents the current semantics.
