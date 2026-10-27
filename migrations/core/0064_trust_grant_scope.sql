CREATE TABLE trust_grant_records (
 grant_id TEXT NOT NULL REFERENCES trust_customer_grants(id),
 update_id TEXT NOT NULL REFERENCES trust_updates(id),
 can_read INTEGER NOT NULL CHECK(can_read=1),
 can_submit INTEGER NOT NULL CHECK(can_submit IN (0,1)),
 PRIMARY KEY(grant_id,update_id)
);
CREATE TABLE trust_submissions (
 id TEXT PRIMARY KEY,grant_id TEXT NOT NULL REFERENCES trust_customer_grants(id),
 update_id TEXT NOT NULL REFERENCES trust_updates(id),body TEXT NOT NULL,submitted_at TEXT NOT NULL,
 FOREIGN KEY(grant_id,update_id) REFERENCES trust_grant_records(grant_id,update_id)
);
CREATE TRIGGER trust_grant_scope_immutable BEFORE UPDATE ON trust_grant_records BEGIN SELECT RAISE(ABORT,'immutable_trust_scope'); END;
CREATE TRIGGER trust_submission_immutable BEFORE UPDATE ON trust_submissions BEGIN SELECT RAISE(ABORT,'immutable_trust_submission'); END;
-- Existing broad grants have no named scope. Owners issue new links explicitly.
UPDATE trust_customer_grants SET revoked_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),revoked_by='named-scope-migration' WHERE revoked_at IS NULL;
