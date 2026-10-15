-- Receipt attribution is provenance, never an authentication grant. Move the
-- immutable facts without changing one value; future uploads copy native identity.
CREATE TABLE receipt_actors (id TEXT PRIMARY KEY, display_name TEXT NOT NULL);
INSERT INTO receipt_actors SELECT DISTINCT o.id,o.display_name FROM oa_operators o JOIN receipts r ON r.added_by=o.id;
DROP TRIGGER receipts_no_update;
DROP TRIGGER receipts_no_delete;
CREATE TABLE custody_receipts (id TEXT PRIMARY KEY, requirement_id TEXT NOT NULL REFERENCES requirements(id), exhibit_id TEXT NOT NULL UNIQUE REFERENCES exhibits(id), origin TEXT NOT NULL CHECK(origin IN ('source-observed','manually-asserted','imported')), source TEXT NOT NULL, covered_from TEXT NOT NULL, covered_to TEXT NOT NULL, added_by TEXT NOT NULL REFERENCES receipt_actors(id), added_by_name TEXT NOT NULL, added_at TEXT NOT NULL, sha256 TEXT NOT NULL, supersedes TEXT UNIQUE REFERENCES custody_receipts(id), CHECK(covered_from <= covered_to));
INSERT INTO custody_receipts SELECT * FROM receipts;
DROP TABLE receipts;
ALTER TABLE custody_receipts RENAME TO receipts;
CREATE INDEX receipts_requirement ON receipts(requirement_id);
CREATE TRIGGER receipts_no_update BEFORE UPDATE ON receipts BEGIN SELECT RAISE(ABORT, 'immutable_receipt'); END;
CREATE TRIGGER receipts_no_delete BEFORE DELETE ON receipts BEGIN SELECT RAISE(ABORT, 'immutable_receipt'); END;
CREATE TRIGGER receipts_native_actor BEFORE INSERT ON receipts BEGIN INSERT OR IGNORE INTO receipt_actors SELECT id,display_name FROM oa_operators WHERE id=NEW.added_by; END;
-- Used only inside the restore transaction; zero is impossible by construction.
CREATE TABLE custody_admission (singleton INTEGER PRIMARY KEY CHECK(singleton=1), empty_check INTEGER NOT NULL CHECK(empty_check=1));
