-- POPULATION-001 labelled CSV populations. Each upload is a manually-asserted
-- exhibit kept with its digest; its rows never change and never count as a
-- source read. Matches to People are reviewable decisions.
CREATE TABLE population_uploads (
 id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('roster','accounts','devices')), source_system TEXT NOT NULL, as_of TEXT NOT NULL, refresh_days INTEGER NOT NULL CHECK(refresh_days BETWEEN 1 AND 366),
 filename TEXT NOT NULL, sha256 TEXT NOT NULL, size INTEGER NOT NULL, object_key TEXT NOT NULL UNIQUE, mapping_json TEXT NOT NULL,
 uploaded_by TEXT NOT NULL, uploaded_name TEXT NOT NULL, uploaded_at TEXT NOT NULL, row_count INTEGER NOT NULL, previous_id TEXT REFERENCES population_uploads(id)
);
CREATE TRIGGER population_uploads_immutable BEFORE UPDATE ON population_uploads BEGIN SELECT RAISE(ABORT,'immutable_population'); END;
CREATE TRIGGER population_uploads_retained BEFORE DELETE ON population_uploads BEGIN SELECT RAISE(ABORT,'immutable_population'); END;
CREATE TABLE population_rows (id TEXT PRIMARY KEY, upload_id TEXT NOT NULL REFERENCES population_uploads(id), row_number INTEGER NOT NULL, row_key TEXT NOT NULL, attributes_json TEXT NOT NULL, UNIQUE(upload_id,row_key));
CREATE TRIGGER population_rows_immutable BEFORE UPDATE ON population_rows BEGIN SELECT RAISE(ABORT,'immutable_population'); END;
CREATE TRIGGER population_rows_retained BEFORE DELETE ON population_rows BEGIN SELECT RAISE(ABORT,'immutable_population'); END;
CREATE TABLE population_matches (row_id TEXT PRIMARY KEY REFERENCES population_rows(id), person_id TEXT REFERENCES people(id), state TEXT NOT NULL CHECK(state IN ('proposed','ambiguous','approved','rejected')), basis TEXT NOT NULL, candidates_json TEXT NOT NULL DEFAULT '[]', decided_by TEXT, decided_at TEXT);
