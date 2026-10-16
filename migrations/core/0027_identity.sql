-- IDENTITY-001: connections admit directory providers (Okta, Google Workspace,
-- Microsoft Entra ID, JumpCloud). The provider CHECK is dropped so later
-- connectors need no rebuild; the application admits only listed providers.
-- SQLite cannot drop a CHECK in place, so the table is rebuilt. Its child rows are
-- set aside first (with their row order) and restored after, so no foreign key
-- is ever left dangling and every run and repository selection is kept.
CREATE TABLE migrate_collection_runs AS SELECT rowid AS kept_rowid,id,connection_id,trigger,connector_revision,started_at,finished_at,outcome,coverage_json,error_code FROM collection_runs;
CREATE TABLE migrate_connection_repositories AS SELECT rowid AS kept_rowid,connection_id,full_name,selected FROM connection_repositories;
DELETE FROM collection_runs;
DELETE FROM connection_repositories;
CREATE TABLE connections_rebuilt (
 id TEXT PRIMARY KEY, provider TEXT NOT NULL, label TEXT NOT NULL, account TEXT NOT NULL, api_base TEXT NOT NULL,
 secret_ciphertext TEXT, secret_iv TEXT, granted_scopes TEXT NOT NULL DEFAULT '[]',
 status TEXT NOT NULL CHECK(status IN ('active','revoked','needs reconnect','inactive after restore')),
 created_by TEXT NOT NULL, created_name TEXT NOT NULL, created_at TEXT NOT NULL, rotated_at TEXT, revoked_at TEXT,
 last_success_at TEXT, last_attempt_at TEXT, next_attempt_at TEXT, backoff_seconds INTEGER NOT NULL DEFAULT 0, last_error TEXT NOT NULL DEFAULT '',
 config_json TEXT NOT NULL DEFAULT '{}'
);
INSERT INTO connections_rebuilt(rowid,id,provider,label,account,api_base,secret_ciphertext,secret_iv,granted_scopes,status,created_by,created_name,created_at,rotated_at,revoked_at,last_success_at,last_attempt_at,next_attempt_at,backoff_seconds,last_error,config_json)
 SELECT rowid,id,provider,label,account,api_base,secret_ciphertext,secret_iv,granted_scopes,status,created_by,created_name,created_at,rotated_at,revoked_at,last_success_at,last_attempt_at,next_attempt_at,backoff_seconds,last_error,config_json FROM connections;
DROP TABLE connections;
ALTER TABLE connections_rebuilt RENAME TO connections;
INSERT INTO connection_repositories(rowid,connection_id,full_name,selected) SELECT kept_rowid,connection_id,full_name,selected FROM migrate_connection_repositories;
INSERT INTO collection_runs(rowid,id,connection_id,trigger,connector_revision,started_at,finished_at,outcome,coverage_json,error_code) SELECT kept_rowid,id,connection_id,trigger,connector_revision,started_at,finished_at,outcome,coverage_json,error_code FROM migrate_collection_runs;
DROP TABLE migrate_connection_repositories;
DROP TABLE migrate_collection_runs;
-- Reviewable identity matches: a directory account is proposed for a person by
-- email, and an owner approves, rejects or chooses another person. Accounts
-- without a decision stay visible as unmatched.
CREATE TABLE identity_matches (
 resource_id TEXT PRIMARY KEY REFERENCES resources(id), person_id TEXT REFERENCES people(id),
 state TEXT NOT NULL CHECK(state IN ('proposed','approved','rejected')), basis TEXT NOT NULL,
 proposed_at TEXT NOT NULL, decided_by TEXT, decided_at TEXT, reason TEXT NOT NULL DEFAULT ''
);
