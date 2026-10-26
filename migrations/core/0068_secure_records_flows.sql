-- SECURE-001: restricted records, declared outbound flows and key custody.
-- A record's class travels with its receipt; grants, publications, flow
-- declarations and their sealed keys are authority and stay with the installation.
CREATE TABLE record_classes (receipt_id TEXT PRIMARY KEY REFERENCES receipts(id), class TEXT NOT NULL CHECK(class IN ('sensitive')), reason TEXT NOT NULL, set_by TEXT NOT NULL, set_name TEXT NOT NULL, set_at TEXT NOT NULL);
CREATE TABLE record_grants (id TEXT PRIMARY KEY, receipt_id TEXT NOT NULL REFERENCES receipts(id), email TEXT NOT NULL COLLATE NOCASE, reason TEXT NOT NULL, granted_by TEXT NOT NULL, granted_name TEXT NOT NULL, granted_at TEXT NOT NULL, revoked_at TEXT, revoked_by TEXT);
CREATE UNIQUE INDEX record_grants_active ON record_grants(receipt_id,email) WHERE revoked_at IS NULL;
CREATE TABLE record_publications (id TEXT PRIMARY KEY, receipt_id TEXT NOT NULL REFERENCES receipts(id), reason TEXT NOT NULL, decided_by TEXT NOT NULL, decided_name TEXT NOT NULL, decided_at TEXT NOT NULL, revoked_at TEXT, revoked_by TEXT);
CREATE UNIQUE INDEX record_publications_active ON record_publications(receipt_id) WHERE revoked_at IS NULL;
CREATE TABLE flow_declarations (
 id TEXT PRIMARY KEY, provider TEXT NOT NULL CHECK(provider IN ('anthropic','openai')), model TEXT NOT NULL, purpose TEXT NOT NULL, data_classes TEXT NOT NULL,
 retention TEXT NOT NULL, region TEXT NOT NULL, account TEXT NOT NULL, workspace TEXT NOT NULL DEFAULT '', declaration_sha256 TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('declared','enabled','disabled')), declared_by TEXT NOT NULL, declared_name TEXT NOT NULL, declared_at TEXT NOT NULL,
 reviewed_by TEXT, reviewed_name TEXT, reviewed_at TEXT, disabled_at TEXT, secret_ciphertext TEXT, secret_iv TEXT, key_rotated_at TEXT, last_used_at TEXT
);
CREATE TABLE flow_calls (id TEXT PRIMARY KEY, flow_id TEXT NOT NULL REFERENCES flow_declarations(id), at TEXT NOT NULL, purpose TEXT NOT NULL, data_classes TEXT NOT NULL, bytes INTEGER NOT NULL, payload_sha256 TEXT NOT NULL, outcome TEXT NOT NULL CHECK(outcome IN ('sent','refused','failed')), detail TEXT NOT NULL DEFAULT '');
CREATE INDEX flow_calls_flow ON flow_calls(flow_id,at);
CREATE TABLE disclosure_events (id TEXT PRIMARY KEY, at TEXT NOT NULL, kind TEXT NOT NULL, subject TEXT NOT NULL, actor TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '');
CREATE INDEX disclosure_events_at ON disclosure_events(at);
CREATE TABLE custody_rotations (id TEXT PRIMARY KEY, at TEXT NOT NULL, actor TEXT NOT NULL, to_key TEXT NOT NULL, resealed INTEGER NOT NULL, unrecoverable INTEGER NOT NULL);
