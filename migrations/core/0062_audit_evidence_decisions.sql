-- Independent continuous-evidence review never updates a test or request.
CREATE TABLE audit_evidence_decisions (
 id TEXT PRIMARY KEY, share_id TEXT NOT NULL REFERENCES audit_evidence_shares(id),
 revision INTEGER NOT NULL CHECK(revision>0),
 state TEXT NOT NULL CHECK(state IN ('accepted','flagged','not-applicable')),
 reason TEXT NOT NULL, actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, at TEXT NOT NULL,
 UNIQUE(share_id,revision), UNIQUE(id,share_id)
);
CREATE TABLE audit_evidence_replies (
 id TEXT PRIMARY KEY, share_id TEXT NOT NULL REFERENCES audit_evidence_shares(id),
 decision_id TEXT NOT NULL, revision INTEGER NOT NULL CHECK(revision>0),
 body TEXT NOT NULL, actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, at TEXT NOT NULL,
 FOREIGN KEY(decision_id,share_id) REFERENCES audit_evidence_decisions(id,share_id),
 UNIQUE(share_id,revision)
);
CREATE TRIGGER audit_evidence_decisions_immutable BEFORE UPDATE ON audit_evidence_decisions BEGIN SELECT RAISE(ABORT,'immutable_evidence_decision'); END;
CREATE TRIGGER audit_evidence_decisions_retained BEFORE DELETE ON audit_evidence_decisions BEGIN SELECT RAISE(ABORT,'retained_evidence_decision'); END;
CREATE TRIGGER audit_evidence_replies_immutable BEFORE UPDATE ON audit_evidence_replies BEGIN SELECT RAISE(ABORT,'immutable_evidence_reply'); END;
CREATE TRIGGER audit_evidence_replies_retained BEFORE DELETE ON audit_evidence_replies BEGIN SELECT RAISE(ABORT,'retained_evidence_reply'); END;
