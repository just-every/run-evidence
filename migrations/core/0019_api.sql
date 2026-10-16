-- Public REST API tokens (API-001). Only SHA-256 digests are stored; a token
-- never approves or publishes. Every call is recorded without the token.
CREATE TABLE api_tokens (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, scopes TEXT NOT NULL, token_hash TEXT UNIQUE,
 created_by TEXT NOT NULL, created_name TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL,
 revoked_at TEXT, revoked_by TEXT,
 CHECK (token_hash IS NULL OR (length(token_hash)=64 AND token_hash NOT GLOB '*[^a-f0-9]*'))
);
CREATE TRIGGER api_token_revocation_only BEFORE UPDATE ON api_tokens
 WHEN NEW.id IS NOT OLD.id OR NEW.scopes IS NOT OLD.scopes OR NEW.token_hash IS NOT OLD.token_hash OR NEW.expires_at IS NOT OLD.expires_at OR OLD.revoked_at IS NOT NULL
 BEGIN SELECT RAISE(ABORT,'immutable_api_token'); END;
CREATE TABLE api_calls (id TEXT PRIMARY KEY, token_id TEXT, method TEXT NOT NULL, route TEXT NOT NULL, status INTEGER NOT NULL, at TEXT NOT NULL);
CREATE INDEX api_calls_token ON api_calls(token_id,at);
CREATE TRIGGER api_calls_immutable BEFORE UPDATE ON api_calls BEGIN SELECT RAISE(ABORT,'immutable_audit'); END;
CREATE TABLE api_rate (token_id TEXT NOT NULL, window TEXT NOT NULL, count INTEGER NOT NULL, PRIMARY KEY(token_id,window));
CREATE TABLE api_evidence (receipt_id TEXT PRIMARY KEY REFERENCES receipts(id), token_id TEXT NOT NULL REFERENCES api_tokens(id), token_name TEXT NOT NULL, owner_name TEXT NOT NULL);
