-- Capability grants retain only digests. NULL digests are inert archive records.
CREATE TABLE agent_tokens (
 id TEXT PRIMARY KEY, label TEXT NOT NULL, token_hash TEXT UNIQUE,
 created_by TEXT NOT NULL, created_by_name TEXT NOT NULL, created_at TEXT NOT NULL,
 expires_at TEXT NOT NULL, revoked_at TEXT, revoked_by TEXT,
 CHECK ((revoked_at IS NULL) = (revoked_by IS NULL)),
 CHECK (token_hash IS NULL OR (length(token_hash)=64 AND token_hash NOT GLOB '*[^a-f0-9]*'))
);
CREATE TABLE agent_proposals (
 id TEXT PRIMARY KEY, token_id TEXT NOT NULL REFERENCES agent_tokens(id),
 created_at TEXT NOT NULL, input_json TEXT NOT NULL, snapshot_json TEXT NOT NULL,
 snapshot_hash TEXT NOT NULL CHECK(length(snapshot_hash)=64 AND snapshot_hash NOT GLOB '*[^a-f0-9]*')
);
CREATE TABLE agent_decisions (
 id TEXT PRIMARY KEY, proposal_id TEXT NOT NULL UNIQUE REFERENCES agent_proposals(id),
 action TEXT NOT NULL CHECK(action IN ('approved','rejected')),
 actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, decided_at TEXT NOT NULL,
 snapshot_hash TEXT NOT NULL, folder_id TEXT UNIQUE REFERENCES review_folders(id),
 CHECK ((action='approved' AND folder_id IS NOT NULL) OR (action='rejected' AND folder_id IS NULL))
);
CREATE TRIGGER immutable_agent_token BEFORE UPDATE ON agent_tokens
 WHEN NEW.id IS NOT OLD.id OR NEW.label IS NOT OLD.label OR NEW.token_hash IS NOT OLD.token_hash
 OR NEW.created_by IS NOT OLD.created_by OR NEW.created_by_name IS NOT OLD.created_by_name
 OR NEW.created_at IS NOT OLD.created_at OR NEW.expires_at IS NOT OLD.expires_at
 OR OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL OR NEW.revoked_by IS NULL
 BEGIN SELECT RAISE(ABORT,'immutable_agent_token'); END;
CREATE TRIGGER retained_agent_token BEFORE DELETE ON agent_tokens BEGIN SELECT RAISE(ABORT,'retained_agent_token'); END;
CREATE TRIGGER immutable_agent_proposal BEFORE UPDATE ON agent_proposals BEGIN SELECT RAISE(ABORT,'immutable_agent_proposal'); END;
CREATE TRIGGER retained_agent_proposal BEFORE DELETE ON agent_proposals BEGIN SELECT RAISE(ABORT,'retained_agent_proposal'); END;
CREATE TRIGGER exact_agent_decision BEFORE INSERT ON agent_decisions
 WHEN NEW.snapshot_hash IS NOT (SELECT snapshot_hash FROM agent_proposals WHERE id=NEW.proposal_id)
 BEGIN SELECT RAISE(ABORT,'exact_agent_decision'); END;
CREATE TRIGGER immutable_agent_decision BEFORE UPDATE ON agent_decisions BEGIN SELECT RAISE(ABORT,'immutable_agent_decision'); END;
CREATE TRIGGER retained_agent_decision BEFORE DELETE ON agent_decisions BEGIN SELECT RAISE(ABORT,'retained_agent_decision'); END;
