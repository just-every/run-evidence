-- OPS-001. Installation-local scheduler execution metadata, not observations.
-- Product obligations and their own deduplication identities remain unchanged.
CREATE TABLE operation_steps (
 id TEXT PRIMARY KEY,
 step TEXT NOT NULL,
 scheduled_at TEXT NOT NULL,
 lease_until TEXT NOT NULL,
 finished_at TEXT,
 outcome TEXT NOT NULL CHECK(outcome IN ('running','succeeded','failed','unknown')),
 processed_count INTEGER,
 detail TEXT NOT NULL DEFAULT '',
 CHECK((outcome='running' AND finished_at IS NULL) OR (outcome!='running' AND finished_at IS NOT NULL)),
 CHECK((outcome='succeeded' AND processed_count IS NOT NULL AND processed_count>=0) OR (outcome!='succeeded' AND processed_count IS NULL))
);
CREATE UNIQUE INDEX operation_steps_claim ON operation_steps(step) WHERE outcome='running';
CREATE INDEX operation_steps_recent ON operation_steps(scheduled_at DESC);
CREATE TRIGGER operation_steps_terminal_update BEFORE UPDATE ON operation_steps WHEN OLD.outcome!='running' BEGIN SELECT RAISE(ABORT,'terminal_operation_outcome'); END;
CREATE TRIGGER operation_steps_retained BEFORE DELETE ON operation_steps BEGIN SELECT RAISE(ABORT,'retained_operation_outcome'); END;
