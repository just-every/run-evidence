-- CADENCE-001 recurring reviews of policies and vendors. Schedules are
-- revisions that apply from their effective time; a completed review is an
-- owner-asserted date; a one-off renewal date moves only the current cycle.
CREATE TABLE review_schedules (
 id TEXT PRIMARY KEY, subject_kind TEXT NOT NULL CHECK(subject_kind IN ('policy','vendor')), subject_id TEXT NOT NULL,
 cadence TEXT NOT NULL CHECK(cadence IN ('semi-annual','annual')), anchor TEXT NOT NULL CHECK(anchor IN ('effective-date','fiscal-year','audit-window')),
 fiscal_start_month INTEGER, window_start TEXT, program_id TEXT REFERENCES programs(id), reminder_lead_days INTEGER, owner_person_id TEXT REFERENCES people(id),
 effective_from TEXT NOT NULL, actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, reason TEXT NOT NULL
);
CREATE TRIGGER review_schedules_immutable BEFORE UPDATE ON review_schedules BEGIN SELECT RAISE(ABORT,'immutable_schedule'); END;
CREATE TABLE review_completions (id TEXT PRIMARY KEY, subject_kind TEXT NOT NULL, subject_id TEXT NOT NULL, completed_on TEXT NOT NULL, notes TEXT NOT NULL, recorded_by TEXT NOT NULL, recorded_at TEXT NOT NULL);
CREATE TRIGGER review_completions_immutable BEFORE UPDATE ON review_completions BEGIN SELECT RAISE(ABORT,'immutable_review'); END;
CREATE TABLE review_overrides (id TEXT PRIMARY KEY, subject_kind TEXT NOT NULL, subject_id TEXT NOT NULL, cycle_due TEXT NOT NULL, due_date TEXT NOT NULL, reason TEXT NOT NULL, actor_name TEXT NOT NULL, at TEXT NOT NULL);
