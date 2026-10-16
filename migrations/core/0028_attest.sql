-- POLICY-001 template links and ATTEST-001 attestations. An acknowledgment is
-- made only by the signed-in person and binds the exact revision fingerprint;
-- it is never changed or deleted. Departed people keep their history.
ALTER TABLE policies ADD COLUMN template_id TEXT;
CREATE TABLE policy_assignments (
 id TEXT PRIMARY KEY, policy_id TEXT NOT NULL REFERENCES policies(id), revision_id TEXT NOT NULL REFERENCES policy_revisions(id), person_id TEXT NOT NULL REFERENCES people(id),
 assigned_by TEXT NOT NULL, assigned_at TEXT NOT NULL, due_date TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('pending','acknowledged','superseded','departed')), closed_at TEXT,
 UNIQUE(revision_id,person_id)
);
CREATE TABLE policy_acknowledgments (
 id TEXT PRIMARY KEY, assignment_id TEXT NOT NULL UNIQUE REFERENCES policy_assignments(id), person_id TEXT NOT NULL REFERENCES people(id),
 operator_id TEXT NOT NULL, operator_email TEXT NOT NULL, revision_id TEXT NOT NULL REFERENCES policy_revisions(id), version INTEGER NOT NULL, body_sha256 TEXT NOT NULL, acknowledged_at TEXT NOT NULL
);
CREATE TRIGGER policy_acknowledgments_immutable BEFORE UPDATE ON policy_acknowledgments BEGIN SELECT RAISE(ABORT,'immutable_acknowledgment'); END;
CREATE TRIGGER policy_acknowledgments_retained BEFORE DELETE ON policy_acknowledgments BEGIN SELECT RAISE(ABORT,'immutable_acknowledgment'); END;
CREATE TABLE policy_exceptions (id TEXT PRIMARY KEY, policy_id TEXT NOT NULL REFERENCES policies(id), person_id TEXT REFERENCES people(id), reason TEXT NOT NULL, approved_by TEXT NOT NULL, approved_at TEXT NOT NULL, expires_at TEXT NOT NULL, CHECK(expires_at > approved_at));
CREATE TABLE people_departures (person_id TEXT PRIMARY KEY REFERENCES people(id), departed_at TEXT NOT NULL, recorded_by TEXT NOT NULL, reason TEXT NOT NULL DEFAULT '', access_outcome TEXT NOT NULL DEFAULT '');
