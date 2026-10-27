CREATE TABLE tailoring_proposals(id TEXT PRIMARY KEY,framework_id TEXT NOT NULL REFERENCES custom_frameworks(id),requirement_id TEXT NOT NULL REFERENCES custom_framework_requirements(id),snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,created_by TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE tailoring_decisions(proposal_id TEXT PRIMARY KEY REFERENCES tailoring_proposals(id),snapshot_hash TEXT NOT NULL,decision TEXT NOT NULL CHECK(decision IN ('approved','rejected')),approver_person_id TEXT NOT NULL REFERENCES people(id),actor_id TEXT NOT NULL,actor_name TEXT NOT NULL,reason TEXT NOT NULL,policy_revision_id TEXT REFERENCES policy_revisions(id),risk_id TEXT REFERENCES risks(id),decided_at TEXT NOT NULL);
CREATE TABLE tailored_obligations(id TEXT PRIMARY KEY,proposal_id TEXT NOT NULL UNIQUE REFERENCES tailoring_proposals(id),program_id TEXT NOT NULL REFERENCES programs(id),control_id TEXT NOT NULL REFERENCES controls(id),kind TEXT NOT NULL,body TEXT NOT NULL,source_ref TEXT NOT NULL,deadline TEXT,assumptions TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TRIGGER tailoring_proposals_update BEFORE UPDATE ON tailoring_proposals BEGIN SELECT RAISE(ABORT,'immutable_tailoring_proposal'); END;
CREATE TRIGGER tailoring_proposals_delete BEFORE DELETE ON tailoring_proposals BEGIN SELECT RAISE(ABORT,'retained_tailoring_proposal'); END;
CREATE TRIGGER tailoring_decisions_update BEFORE UPDATE ON tailoring_decisions BEGIN SELECT RAISE(ABORT,'immutable_tailoring_decision'); END;
CREATE TRIGGER tailoring_decisions_delete BEFORE DELETE ON tailoring_decisions BEGIN SELECT RAISE(ABORT,'retained_tailoring_decision'); END;

CREATE TRIGGER generation_tailoring_proposals_insert AFTER INSERT ON tailoring_proposals BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
CREATE TRIGGER generation_tailoring_proposals_update AFTER UPDATE ON tailoring_proposals BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
CREATE TRIGGER generation_tailoring_proposals_delete AFTER DELETE ON tailoring_proposals BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
CREATE TRIGGER generation_tailoring_decisions_insert AFTER INSERT ON tailoring_decisions BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
CREATE TRIGGER generation_tailoring_decisions_update AFTER UPDATE ON tailoring_decisions BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
CREATE TRIGGER generation_tailoring_decisions_delete AFTER DELETE ON tailoring_decisions BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
CREATE TRIGGER generation_tailored_obligations_insert AFTER INSERT ON tailored_obligations BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
CREATE TRIGGER generation_tailored_obligations_update AFTER UPDATE ON tailored_obligations BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
CREATE TRIGGER generation_tailored_obligations_delete AFTER DELETE ON tailored_obligations BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;

CREATE TABLE tailoring_guard(singleton INTEGER PRIMARY KEY CHECK(singleton=1),allowed INTEGER NOT NULL CONSTRAINT tailoring_snapshot_current CHECK(allowed=1));
