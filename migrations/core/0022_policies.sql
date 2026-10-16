-- Policy register with exact-revision approval (POLICY-001 core). A revision's
-- text never changes; a changed draft is a new revision needing a new decision.
CREATE TABLE policies (id TEXT PRIMARY KEY, title TEXT NOT NULL UNIQUE COLLATE NOCASE, owner_person_id TEXT REFERENCES people(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE policy_revisions (
 id TEXT PRIMARY KEY, policy_id TEXT NOT NULL REFERENCES policies(id), version INTEGER NOT NULL, body TEXT NOT NULL, body_sha256 TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('draft','approved','rejected','published','superseded')),
 drafted_by TEXT NOT NULL, drafted_at TEXT NOT NULL, decided_by TEXT, decided_at TEXT, decision_note TEXT, approved_sha256 TEXT,
 published_at TEXT, effective_date TEXT, review_due TEXT, UNIQUE(policy_id,version)
);
CREATE TRIGGER policy_revision_text_immutable BEFORE UPDATE ON policy_revisions WHEN NEW.body IS NOT OLD.body OR NEW.body_sha256 IS NOT OLD.body_sha256 OR NEW.version IS NOT OLD.version OR NEW.policy_id IS NOT OLD.policy_id BEGIN SELECT RAISE(ABORT,'immutable_policy_revision'); END;
CREATE TRIGGER policy_revision_retained BEFORE DELETE ON policy_revisions BEGIN SELECT RAISE(ABORT,'immutable_policy_revision'); END;
