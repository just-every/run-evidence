CREATE TABLE promise_dependencies (
 id TEXT PRIMARY KEY,
 subject_kind TEXT NOT NULL CHECK(subject_kind IN ('answer','trust')),
 subject_id TEXT NOT NULL,
 source_json TEXT NOT NULL,
 linked_by TEXT NOT NULL,
 linked_at TEXT NOT NULL,
 UNIQUE(subject_kind,subject_id,source_json)
);
CREATE TRIGGER promise_dependencies_update BEFORE UPDATE ON promise_dependencies BEGIN SELECT RAISE(ABORT,'immutable_promise_dependency'); END;
CREATE TRIGGER promise_dependencies_delete BEFORE DELETE ON promise_dependencies BEGIN SELECT RAISE(ABORT,'retained_promise_dependency'); END;
CREATE TRIGGER generation_promise_dependencies_insert AFTER INSERT ON promise_dependencies BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
CREATE TRIGGER promise_dependencies_frozen BEFORE INSERT ON promise_dependencies
WHEN (NEW.subject_kind='answer' AND EXISTS(SELECT 1 FROM questionnaire_approvals WHERE draft_id=NEW.subject_id)) OR (NEW.subject_kind='trust' AND EXISTS(SELECT 1 FROM trust_updates WHERE id=NEW.subject_id AND approved_at IS NOT NULL))
BEGIN SELECT RAISE(ABORT,'approved_promise_dependencies_frozen'); END;
CREATE TABLE promise_reviews (
 update_id TEXT PRIMARY KEY REFERENCES trust_updates(id),
 snapshot_hash TEXT NOT NULL,
 dependency_hash TEXT NOT NULL,
 reviewer_person_id TEXT NOT NULL REFERENCES people(id),
 reason TEXT NOT NULL,
 actor_id TEXT NOT NULL,
 actor_name TEXT NOT NULL,
 decided_at TEXT NOT NULL
);
CREATE TRIGGER promise_reviews_update BEFORE UPDATE ON promise_reviews BEGIN SELECT RAISE(ABORT,'immutable_promise_review'); END;
CREATE TRIGGER promise_reviews_delete BEFORE DELETE ON promise_reviews BEGIN SELECT RAISE(ABORT,'retained_promise_review'); END;
CREATE TRIGGER generation_promise_reviews_insert AFTER INSERT ON promise_reviews BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
CREATE TABLE promise_revisions (
 update_id TEXT PRIMARY KEY REFERENCES trust_updates(id),
 previous_update_id TEXT NOT NULL REFERENCES trust_updates(id),
 actor_name TEXT NOT NULL,
 prepared_at TEXT NOT NULL,
 CHECK(update_id<>previous_update_id)
);
CREATE TRIGGER promise_revisions_update BEFORE UPDATE ON promise_revisions BEGIN SELECT RAISE(ABORT,'immutable_promise_revision'); END;
CREATE TRIGGER promise_revisions_delete BEFORE DELETE ON promise_revisions BEGIN SELECT RAISE(ABORT,'retained_promise_revision'); END;
CREATE TRIGGER generation_promise_revisions_insert AFTER INSERT ON promise_revisions BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
