-- PROGRAM-004: the extended and regulated programs run on the same program table. Its framework CHECK listed only the
-- four core programs and SQLite cannot drop a CHECK in place, so the table is rebuilt without it: the application admits
-- only shipped frameworks. Rows keep their ids and order; foreign keys from program_revisions, applicability, documents and
-- the other children are deferred to commit; the rows are set aside and put back after the rename so every id resolves again.
PRAGMA defer_foreign_keys = on;
CREATE TABLE programs_keep AS SELECT rowid AS kept_rowid,id,framework,edition,name,legal_entity,report_type,categories,products,teams,regions,systems,audit_from,audit_to,assessor,lead_person_id,milestones,created_at,updated_at FROM programs;
CREATE TABLE programs_rebuilt (
 id TEXT PRIMARY KEY, framework TEXT NOT NULL, edition TEXT NOT NULL,
 name TEXT NOT NULL, legal_entity TEXT NOT NULL, report_type TEXT, categories TEXT NOT NULL DEFAULT '[]',
 products TEXT NOT NULL DEFAULT '[]', teams TEXT NOT NULL DEFAULT '[]', regions TEXT NOT NULL DEFAULT '[]', systems TEXT NOT NULL DEFAULT '[]',
 audit_from TEXT NOT NULL, audit_to TEXT NOT NULL, assessor TEXT NOT NULL DEFAULT '', lead_person_id TEXT REFERENCES people(id),
 milestones TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, CHECK(audit_from <= audit_to)
);
DROP TABLE programs;
ALTER TABLE programs_rebuilt RENAME TO programs;
INSERT INTO programs(rowid,id,framework,edition,name,legal_entity,report_type,categories,products,teams,regions,systems,audit_from,audit_to,assessor,lead_person_id,milestones,created_at,updated_at)
 SELECT kept_rowid,id,framework,edition,name,legal_entity,report_type,categories,products,teams,regions,systems,audit_from,audit_to,assessor,lead_person_id,milestones,created_at,updated_at FROM programs_keep;
DROP TABLE programs_keep;
CREATE TRIGGER portable_generation_programs_insert AFTER INSERT ON "programs" BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
CREATE TRIGGER portable_generation_programs_update AFTER UPDATE ON "programs" BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
CREATE TRIGGER portable_generation_programs_delete AFTER DELETE ON "programs" BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
