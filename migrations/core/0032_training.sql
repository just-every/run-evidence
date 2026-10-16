-- TRAIN-001 training: adopted course revisions, campaigns with schedule
-- history, assignments per cycle, graded attempts and completions with their
-- provenance. An assignment is never a completion; attempts and completions
-- are never changed.
ALTER TABLE people ADD COLUMN role TEXT;
CREATE TABLE training_adoptions (course_id TEXT NOT NULL, revision INTEGER NOT NULL, adopted_by TEXT NOT NULL, adopted_at TEXT NOT NULL, PRIMARY KEY(course_id,revision));
CREATE TABLE training_campaigns (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, course_id TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('onboarding','recurring')),
 audience TEXT NOT NULL CHECK(audience IN ('everyone','employees','contractors','engineering')), due_days INTEGER NOT NULL CHECK(due_days BETWEEN 1 AND 365), interval_months INTEGER NOT NULL CHECK(interval_months BETWEEN 1 AND 36),
 created_by TEXT NOT NULL, created_name TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE training_schedule_changes (id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL REFERENCES training_campaigns(id), due_days INTEGER NOT NULL, interval_months INTEGER NOT NULL, reason TEXT NOT NULL, actor_name TEXT NOT NULL, at TEXT NOT NULL);
CREATE TABLE training_assignments (
 id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL REFERENCES training_campaigns(id), course_id TEXT NOT NULL, revision INTEGER NOT NULL, person_id TEXT NOT NULL REFERENCES people(id),
 cycle TEXT NOT NULL, assigned_at TEXT NOT NULL, due_date TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('assigned','completed','departed')), completed_at TEXT, completion_id TEXT,
 UNIQUE(campaign_id,person_id,cycle)
);
CREATE TABLE training_attempts (id TEXT PRIMARY KEY, person_id TEXT NOT NULL REFERENCES people(id), course_id TEXT NOT NULL, revision INTEGER NOT NULL, answers_json TEXT NOT NULL, score INTEGER NOT NULL, passed INTEGER NOT NULL, operator_email TEXT NOT NULL, at TEXT NOT NULL);
CREATE TRIGGER training_attempts_immutable BEFORE UPDATE ON training_attempts BEGIN SELECT RAISE(ABORT,'immutable_attempt'); END;
CREATE TRIGGER training_attempts_retained BEFORE DELETE ON training_attempts BEGIN SELECT RAISE(ABORT,'immutable_attempt'); END;
CREATE TABLE internal_courses (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL, counts_as TEXT, approved_by TEXT NOT NULL, approved_at TEXT NOT NULL);
CREATE TABLE training_completions (
 id TEXT PRIMARY KEY, person_id TEXT NOT NULL REFERENCES people(id), course_id TEXT, course_title TEXT NOT NULL, revision INTEGER,
 source TEXT NOT NULL CHECK(source IN ('evidence','internal','knowbe4')), provenance TEXT NOT NULL, score INTEGER, attempt_id TEXT REFERENCES training_attempts(id), external_ref TEXT,
 recorded_by TEXT NOT NULL, completed_at TEXT NOT NULL, recorded_at TEXT NOT NULL
);
CREATE UNIQUE INDEX training_completion_source ON training_completions(source,external_ref) WHERE external_ref IS NOT NULL;
CREATE TRIGGER training_completions_immutable BEFORE UPDATE ON training_completions BEGIN SELECT RAISE(ABORT,'immutable_completion'); END;
