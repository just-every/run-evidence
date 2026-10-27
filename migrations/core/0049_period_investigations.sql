-- AGENT-002: retained prepare-only findings, independently decided by the owner.
CREATE TABLE period_investigations (
 id TEXT PRIMARY KEY, control_id TEXT NOT NULL REFERENCES controls(id),
 period_from TEXT NOT NULL, period_to TEXT NOT NULL, snapshot_json TEXT NOT NULL,
 snapshot_hash TEXT NOT NULL, created_by TEXT NOT NULL, created_name TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE period_investigation_decisions (
 investigation_id TEXT PRIMARY KEY REFERENCES period_investigations(id),
 action TEXT NOT NULL CHECK(action IN ('reviewed','rejected')), snapshot_hash TEXT NOT NULL,
 reason TEXT NOT NULL, actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, decided_at TEXT NOT NULL
);
CREATE TRIGGER period_investigations_immutable BEFORE UPDATE ON period_investigations BEGIN SELECT RAISE(ABORT,'immutable_investigation'); END;
CREATE TRIGGER period_investigations_retained BEFORE DELETE ON period_investigations BEGIN SELECT RAISE(ABORT,'retained_investigation'); END;
CREATE TRIGGER period_investigation_decisions_immutable BEFORE UPDATE ON period_investigation_decisions BEGIN SELECT RAISE(ABORT,'immutable_investigation_decision'); END;
CREATE TRIGGER period_investigation_decisions_retained BEFORE DELETE ON period_investigation_decisions BEGIN SELECT RAISE(ABORT,'retained_investigation_decision'); END;
