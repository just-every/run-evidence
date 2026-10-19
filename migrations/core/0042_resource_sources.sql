-- INVENTORY-001: qualify source identity by its connection without changing retained resource IDs.
PRAGMA defer_foreign_keys=ON;
CREATE TABLE resources_scoped (
 id TEXT PRIMARY KEY, type TEXT NOT NULL, unique_id TEXT NOT NULL, display_name TEXT NOT NULL,
 source_kind TEXT NOT NULL CHECK(source_kind IN ('source-reported','source-observed')), source_ref TEXT NOT NULL, source_label TEXT NOT NULL,
 attributes_json TEXT NOT NULL, attributes_hash TEXT NOT NULL, first_seen_at TEXT NOT NULL, updated_at TEXT NOT NULL, removed_at TEXT,
 -- Last successful source read (collectors only); a stale read makes tests unknown.
 observed_at TEXT,
 UNIQUE(type,source_ref,unique_id)
);
INSERT INTO resources_scoped SELECT * FROM resources;
DROP TABLE resources;
ALTER TABLE resources_scoped RENAME TO resources;
-- Rebuilding a referenced table leaves SQLite's deferred-violation counter
-- nonzero even after every parent ID returns. Check the actual final graph
-- before returning to immediate enforcement; never bypass a real violation.
-- https://sqlite.org/forum/info/64fb781a226df95c0f4edc474e590214c28ae1b4b5ddeee8f7ec4ad77286796c
CREATE TABLE resource_source_integrity(violations INTEGER NOT NULL CHECK(violations=0));
INSERT INTO resource_source_integrity SELECT count(*) FROM pragma_foreign_key_check;
DROP TABLE resource_source_integrity;
PRAGMA defer_foreign_keys=OFF;
CREATE TRIGGER portable_generation_resources_insert AFTER INSERT ON resources BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
CREATE TRIGGER portable_generation_resources_update AFTER UPDATE ON resources BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
CREATE TRIGGER portable_generation_resources_delete AFTER DELETE ON resources BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
