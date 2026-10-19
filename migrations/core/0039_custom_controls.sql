-- CONTROL-001: prospective definitions and the exact meaning evaluated by a run.
CREATE TABLE control_revisions (
 id TEXT PRIMARY KEY, control_id TEXT NOT NULL REFERENCES controls(id), revision INTEGER NOT NULL,
 name TEXT NOT NULL, group_name TEXT NOT NULL, applicability TEXT NOT NULL,
 test_intent TEXT NOT NULL, evaluation_criteria TEXT NOT NULL, actor_id TEXT NOT NULL,
 actor_name TEXT NOT NULL, reason TEXT NOT NULL, effective_at TEXT NOT NULL,
 UNIQUE(control_id,revision)
);
CREATE TABLE requirement_revisions (
 id TEXT PRIMARY KEY, requirement_id TEXT NOT NULL REFERENCES requirements(id), revision INTEGER NOT NULL,
 name TEXT NOT NULL, actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, reason TEXT NOT NULL,
 effective_at TEXT NOT NULL, UNIQUE(requirement_id,revision)
);
CREATE TABLE run_control_definitions (
 run_id TEXT NOT NULL REFERENCES test_runs(id), control_id TEXT NOT NULL REFERENCES controls(id),
 control_revision INTEGER NOT NULL, snapshot_json TEXT NOT NULL, PRIMARY KEY(run_id,control_id)
);
