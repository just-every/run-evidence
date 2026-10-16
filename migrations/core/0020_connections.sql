-- Read-only provider connections and scheduled collection (CONNECT-001,
-- COLLECTION-001). Credentials are AES-GCM ciphertext under an installation key;
-- archives never carry them and restored connections stay inactive.
CREATE TABLE connections (
 id TEXT PRIMARY KEY, provider TEXT NOT NULL CHECK(provider IN ('github')), label TEXT NOT NULL, account TEXT NOT NULL, api_base TEXT NOT NULL,
 secret_ciphertext TEXT, secret_iv TEXT, granted_scopes TEXT NOT NULL DEFAULT '[]',
 status TEXT NOT NULL CHECK(status IN ('active','revoked','needs reconnect','inactive after restore')),
 created_by TEXT NOT NULL, created_name TEXT NOT NULL, created_at TEXT NOT NULL, rotated_at TEXT, revoked_at TEXT,
 last_success_at TEXT, last_attempt_at TEXT, next_attempt_at TEXT, backoff_seconds INTEGER NOT NULL DEFAULT 0, last_error TEXT NOT NULL DEFAULT ''
);
CREATE TABLE connection_repositories (connection_id TEXT NOT NULL REFERENCES connections(id), full_name TEXT NOT NULL, selected INTEGER NOT NULL CHECK(selected IN (0,1)), PRIMARY KEY(connection_id,full_name));
CREATE TABLE collection_runs (
 id TEXT PRIMARY KEY, connection_id TEXT NOT NULL REFERENCES connections(id), trigger TEXT NOT NULL CHECK(trigger IN ('schedule','manual')),
 connector_revision TEXT NOT NULL, started_at TEXT NOT NULL, finished_at TEXT,
 outcome TEXT CHECK(outcome IN ('complete','partial','failed','throttled')), coverage_json TEXT NOT NULL DEFAULT '{}', error_code TEXT NOT NULL DEFAULT ''
);
CREATE INDEX collection_runs_connection ON collection_runs(connection_id,started_at);
CREATE UNIQUE INDEX collection_run_claim ON collection_runs(connection_id) WHERE finished_at IS NULL;
