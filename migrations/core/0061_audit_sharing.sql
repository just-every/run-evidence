-- Request-free shares retain their exact selected revision after unsharing.
CREATE TABLE audit_review_settings (
 engagement_id TEXT PRIMARY KEY REFERENCES audit_engagements(id),
 detail_level TEXT NOT NULL CHECK(detail_level IN ('Full','Restricted')),
 hidden_attributes_json TEXT NOT NULL
);
CREATE TABLE audit_evidence_shares (
 id TEXT PRIMARY KEY, engagement_id TEXT NOT NULL REFERENCES audit_engagements(id),
 kind TEXT NOT NULL CHECK(kind IN ('control','test','policy','document')),
 subject_id TEXT NOT NULL, revision TEXT NOT NULL, snapshot_json TEXT NOT NULL,
 shared_by TEXT NOT NULL, shared_at TEXT NOT NULL, reason TEXT NOT NULL,
 unshared_at TEXT, unshared_by TEXT, unshare_reason TEXT
);
CREATE UNIQUE INDEX audit_active_share ON audit_evidence_shares(engagement_id,kind,subject_id) WHERE unshared_at IS NULL;
CREATE TRIGGER audit_review_settings_immutable BEFORE UPDATE ON audit_review_settings BEGIN SELECT RAISE(ABORT,'fixed_auditor_detail'); END;
CREATE TRIGGER audit_review_settings_retained BEFORE DELETE ON audit_review_settings BEGIN SELECT RAISE(ABORT,'fixed_auditor_detail'); END;
CREATE TRIGGER audit_share_snapshot_immutable BEFORE UPDATE ON audit_evidence_shares
 WHEN NEW.id<>OLD.id OR NEW.engagement_id<>OLD.engagement_id OR NEW.kind<>OLD.kind OR NEW.subject_id<>OLD.subject_id OR NEW.revision<>OLD.revision OR NEW.snapshot_json<>OLD.snapshot_json OR NEW.shared_by<>OLD.shared_by OR NEW.shared_at<>OLD.shared_at OR NEW.reason<>OLD.reason OR OLD.unshared_at IS NOT NULL
 BEGIN SELECT RAISE(ABORT,'immutable_auditor_share'); END;
CREATE TRIGGER audit_shares_retained BEFORE DELETE ON audit_evidence_shares BEGIN SELECT RAISE(ABORT,'retained_auditor_share'); END;
