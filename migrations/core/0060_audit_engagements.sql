-- Native engagement authorization is separate from installation administration.
CREATE TABLE audit_engagements (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, period_from TEXT NOT NULL, period_to TEXT NOT NULL,
 created_by TEXT NOT NULL, created_at TEXT NOT NULL, closed_at TEXT,
 CHECK(period_from<=period_to)
);
CREATE TABLE audit_scope (engagement_id TEXT NOT NULL REFERENCES audit_engagements(id), control_id TEXT NOT NULL REFERENCES controls(id), PRIMARY KEY(engagement_id,control_id));
CREATE TABLE audit_identities (email TEXT PRIMARY KEY, created_by TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE audit_grants (
 id TEXT PRIMARY KEY, engagement_id TEXT NOT NULL REFERENCES audit_engagements(id), email TEXT NOT NULL REFERENCES audit_identities(email),
 expires_at TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL, revoked_at TEXT, reason TEXT NOT NULL,
 CHECK(expires_at>created_at)
);
CREATE TABLE audit_requests (
 id TEXT PRIMARY KEY, engagement_id TEXT NOT NULL REFERENCES audit_engagements(id), control_id TEXT NOT NULL REFERENCES controls(id),
 title TEXT NOT NULL, owner_person_id TEXT NOT NULL REFERENCES people(id), due_date TEXT NOT NULL,
 created_by TEXT NOT NULL, created_at TEXT NOT NULL, closed_at TEXT,
 FOREIGN KEY(engagement_id,control_id) REFERENCES audit_scope(engagement_id,control_id)
);
CREATE TABLE audit_submissions (
 id TEXT PRIMARY KEY, request_id TEXT NOT NULL REFERENCES audit_requests(id), receipt_id TEXT NOT NULL REFERENCES receipts(id),
 revision INTEGER NOT NULL CHECK(revision>0), actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, at TEXT NOT NULL,
 UNIQUE(request_id,revision), UNIQUE(id,request_id)
);
CREATE TABLE audit_comments (
 id TEXT PRIMARY KEY, request_id TEXT NOT NULL REFERENCES audit_requests(id), body TEXT NOT NULL,
 actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, actor_role TEXT NOT NULL CHECK(actor_role IN ('owner','auditor')), at TEXT NOT NULL
);
CREATE TABLE audit_decisions (
 id TEXT PRIMARY KEY, request_id TEXT NOT NULL REFERENCES audit_requests(id), submission_id TEXT NOT NULL,
 revision INTEGER NOT NULL CHECK(revision>0), state TEXT NOT NULL CHECK(state IN ('accepted','rejected','needs-more')),
 reason TEXT NOT NULL, actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, at TEXT NOT NULL,
 FOREIGN KEY(submission_id,request_id) REFERENCES audit_submissions(id,request_id), UNIQUE(request_id,revision)
);
CREATE TRIGGER audit_submissions_immutable BEFORE UPDATE ON audit_submissions BEGIN SELECT RAISE(ABORT,'immutable_audit_submission'); END;
CREATE TRIGGER audit_submissions_retained BEFORE DELETE ON audit_submissions BEGIN SELECT RAISE(ABORT,'retained_audit_submission'); END;
CREATE TRIGGER audit_decisions_immutable BEFORE UPDATE ON audit_decisions BEGIN SELECT RAISE(ABORT,'immutable_audit_decision'); END;
CREATE TRIGGER audit_decisions_retained BEFORE DELETE ON audit_decisions BEGIN SELECT RAISE(ABORT,'retained_audit_decision'); END;
CREATE TRIGGER audit_comments_immutable BEFORE UPDATE ON audit_comments BEGIN SELECT RAISE(ABORT,'immutable_audit_comment'); END;
CREATE TRIGGER audit_comments_retained BEFORE DELETE ON audit_comments BEGIN SELECT RAISE(ABORT,'retained_audit_comment'); END;
