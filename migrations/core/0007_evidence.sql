-- Initial Evidence domain. Facts append from here; no prior business records.
CREATE TABLE controls (id TEXT PRIMARY KEY, name TEXT NOT NULL, group_name TEXT NOT NULL CHECK(group_name IN ('Access','Data','Change','People','Vendors')), created_at TEXT NOT NULL);
CREATE TABLE requirements (id TEXT PRIMARY KEY, control_id TEXT NOT NULL REFERENCES controls(id), name TEXT NOT NULL, cadence TEXT NOT NULL CHECK(cadence IN ('daily','weekly','monthly','quarterly')), created_at TEXT NOT NULL);
CREATE TABLE exhibits (id TEXT PRIMARY KEY, object_key TEXT NOT NULL UNIQUE, filename TEXT NOT NULL, size INTEGER NOT NULL, media_type TEXT NOT NULL);
CREATE TABLE receipts (id TEXT PRIMARY KEY, requirement_id TEXT NOT NULL REFERENCES requirements(id), exhibit_id TEXT NOT NULL UNIQUE REFERENCES exhibits(id), origin TEXT NOT NULL CHECK(origin IN ('source-observed','manually-asserted','imported')), source TEXT NOT NULL, covered_from TEXT NOT NULL, covered_to TEXT NOT NULL, added_by TEXT NOT NULL REFERENCES oa_operators(id), added_by_name TEXT NOT NULL, added_at TEXT NOT NULL, sha256 TEXT NOT NULL, supersedes TEXT UNIQUE REFERENCES receipts(id), CHECK(covered_from <= covered_to));
CREATE INDEX receipts_requirement ON receipts(requirement_id);
CREATE TRIGGER receipts_no_update BEFORE UPDATE ON receipts BEGIN SELECT RAISE(ABORT, 'immutable_receipt'); END;
CREATE TRIGGER receipts_no_delete BEFORE DELETE ON receipts BEGIN SELECT RAISE(ABORT, 'immutable_receipt'); END;
CREATE TRIGGER exhibits_no_update BEFORE UPDATE ON exhibits BEGIN SELECT RAISE(ABORT, 'immutable_exhibit'); END;
CREATE TRIGGER exhibits_no_delete BEFORE DELETE ON exhibits BEGIN SELECT RAISE(ABORT, 'immutable_exhibit'); END;
