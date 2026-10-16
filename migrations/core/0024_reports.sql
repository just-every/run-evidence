-- Daily readiness snapshots per program (READINESS-001 trend history). A
-- snapshot records what readiness reported that day; it is never recomputed.
CREATE TABLE readiness_snapshots (program_id TEXT NOT NULL REFERENCES programs(id), day TEXT NOT NULL, totals_json TEXT NOT NULL, taken_at TEXT NOT NULL, PRIMARY KEY(program_id,day));
CREATE TRIGGER readiness_snapshots_immutable BEFORE UPDATE ON readiness_snapshots BEGIN SELECT RAISE(ABORT,'immutable_snapshot'); END;
