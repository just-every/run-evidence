-- AUTH-001: delegated roles, SCIM provisioning and SSO subjects. These tables
-- are authority, not business records: an archive never carries them, so a
-- restored installation starts with the owner alone and grants roles again.
CREATE TABLE access_grants (
 id TEXT PRIMARY KEY, email TEXT NOT NULL COLLATE NOCASE,
 role TEXT NOT NULL CHECK(role IN ('administrator','compliance_manager','control_owner','contributor','risk_approver')),
 scope_kind TEXT NOT NULL CHECK(scope_kind IN ('business','team','control','area')),
 scope_ref TEXT NOT NULL DEFAULT '',
 source TEXT NOT NULL CHECK(source IN ('owner','scim')),
 granted_by TEXT NOT NULL, granted_name TEXT NOT NULL, reason TEXT NOT NULL, granted_at TEXT NOT NULL,
 revoked_at TEXT, revoked_by TEXT, revoke_reason TEXT
);
CREATE UNIQUE INDEX access_grants_active ON access_grants(email,role,scope_kind,scope_ref) WHERE revoked_at IS NULL;
CREATE INDEX access_grants_email ON access_grants(email) WHERE revoked_at IS NULL;
CREATE TABLE control_teams (control_id TEXT PRIMARY KEY REFERENCES controls(id), team TEXT NOT NULL, set_by TEXT NOT NULL, set_at TEXT NOT NULL);
CREATE TABLE scim_tokens (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, provider TEXT NOT NULL CHECK(provider IN ('okta','microsoft','google')), token_sha256 TEXT NOT NULL UNIQUE,
 created_by TEXT NOT NULL, created_name TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL, revoked_at TEXT, last_used_at TEXT
);
CREATE TABLE scim_users (
 id TEXT PRIMARY KEY, provider TEXT NOT NULL, external_id TEXT NOT NULL, user_name TEXT NOT NULL COLLATE NOCASE, email TEXT NOT NULL COLLATE NOCASE,
 display_name TEXT NOT NULL, active INTEGER NOT NULL CHECK(active IN (0,1)), operator_id TEXT NOT NULL, person_id TEXT NOT NULL,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deprovisioned_at TEXT, UNIQUE(provider,external_id), UNIQUE(provider,user_name)
);
-- The trusted subject map that Base's Okta and Microsoft presets require: a provider subject names an operator only here.
CREATE TABLE sso_subjects (provider TEXT NOT NULL, subject TEXT NOT NULL, email TEXT NOT NULL COLLATE NOCASE, scim_user_id TEXT NOT NULL REFERENCES scim_users(id), PRIMARY KEY(provider,subject));
CREATE TABLE sso_policy (singleton INTEGER PRIMARY KEY CHECK(singleton=1), require_mfa INTEGER NOT NULL DEFAULT 0 CHECK(require_mfa IN (0,1)), changed_by TEXT NOT NULL, changed_at TEXT NOT NULL);
