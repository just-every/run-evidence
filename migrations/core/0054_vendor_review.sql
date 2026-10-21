CREATE TABLE vendor_bridge_letters(document_id TEXT PRIMARY KEY REFERENCES vendor_documents(id));
CREATE TABLE vendor_review_settings(vendor_id TEXT PRIMARY KEY REFERENCES vendors(id),bridge_months INTEGER NOT NULL DEFAULT 3 CHECK(bridge_months BETWEEN 1 AND 24));
CREATE TABLE vendor_document_reviews(id TEXT PRIMARY KEY,document_id TEXT NOT NULL REFERENCES vendor_documents(id),vendor_id TEXT NOT NULL REFERENCES vendors(id),revision INTEGER NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,reason TEXT NOT NULL,proposed_by TEXT NOT NULL,proposed_at TEXT NOT NULL,UNIQUE(document_id,revision));
CREATE TABLE vendor_review_decisions(review_id TEXT PRIMARY KEY REFERENCES vendor_document_reviews(id),snapshot_hash TEXT NOT NULL,decision TEXT NOT NULL CHECK(decision IN ('approved','rejected')),reviewer_person_id TEXT NOT NULL REFERENCES people(id),actor_id TEXT NOT NULL,actor_name TEXT NOT NULL,reason TEXT NOT NULL,decided_at TEXT NOT NULL);
CREATE TABLE vendor_cuecs(id TEXT PRIMARY KEY,vendor_id TEXT NOT NULL REFERENCES vendors(id),document_id TEXT NOT NULL REFERENCES vendor_documents(id),review_id TEXT NOT NULL REFERENCES vendor_document_reviews(id),field_id TEXT NOT NULL,body TEXT NOT NULL,control_id TEXT REFERENCES controls(id),accepted_unaddressed INTEGER NOT NULL DEFAULT 0,decided_at TEXT NOT NULL);
CREATE TRIGGER vendor_document_reviews_update BEFORE UPDATE ON vendor_document_reviews BEGIN SELECT RAISE(ABORT,'immutable_vendor_review'); END;
CREATE TRIGGER vendor_document_reviews_delete BEFORE DELETE ON vendor_document_reviews BEGIN SELECT RAISE(ABORT,'retained_vendor_review'); END;
CREATE TRIGGER vendor_review_decisions_update BEFORE UPDATE ON vendor_review_decisions BEGIN SELECT RAISE(ABORT,'immutable_vendor_review_decision'); END;
CREATE TRIGGER vendor_review_decisions_delete BEFORE DELETE ON vendor_review_decisions BEGIN SELECT RAISE(ABORT,'retained_vendor_review_decision'); END;
CREATE TRIGGER vendor_cuecs_update BEFORE UPDATE ON vendor_cuecs BEGIN SELECT RAISE(ABORT,'immutable_vendor_cuec'); END;
CREATE TRIGGER vendor_cuecs_delete BEFORE DELETE ON vendor_cuecs BEGIN SELECT RAISE(ABORT,'retained_vendor_cuec'); END;

CREATE TRIGGER generation_vendor_review_settings_insert AFTER INSERT ON vendor_review_settings BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
CREATE TRIGGER generation_vendor_review_settings_update AFTER UPDATE ON vendor_review_settings BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
CREATE TRIGGER generation_vendor_review_settings_delete AFTER DELETE ON vendor_review_settings BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
CREATE TRIGGER generation_vendor_document_reviews_insert AFTER INSERT ON vendor_document_reviews BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
CREATE TRIGGER generation_vendor_document_reviews_update AFTER UPDATE ON vendor_document_reviews BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
CREATE TRIGGER generation_vendor_document_reviews_delete AFTER DELETE ON vendor_document_reviews BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
CREATE TRIGGER generation_vendor_review_decisions_insert AFTER INSERT ON vendor_review_decisions BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
CREATE TRIGGER generation_vendor_review_decisions_update AFTER UPDATE ON vendor_review_decisions BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
CREATE TRIGGER generation_vendor_review_decisions_delete AFTER DELETE ON vendor_review_decisions BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
CREATE TRIGGER generation_vendor_cuecs_insert AFTER INSERT ON vendor_cuecs BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
CREATE TRIGGER generation_vendor_cuecs_update AFTER UPDATE ON vendor_cuecs BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
CREATE TRIGGER generation_vendor_cuecs_delete AFTER DELETE ON vendor_cuecs BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;

CREATE TRIGGER generation_vendor_bridge_letters_insert AFTER INSERT ON vendor_bridge_letters BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
