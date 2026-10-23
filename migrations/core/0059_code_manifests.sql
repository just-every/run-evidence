CREATE TABLE code_manifest_grants (
 id TEXT PRIMARY KEY, connection_id TEXT NOT NULL REFERENCES connections(id),
 sequence INTEGER NOT NULL, decision TEXT NOT NULL CHECK(decision IN ('grant','revoke')), credential_binding TEXT NOT NULL,
 reason TEXT NOT NULL, actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, at TEXT NOT NULL, UNIQUE(connection_id,sequence)
);
CREATE INDEX code_manifest_grants_connection ON code_manifest_grants(connection_id,at);
CREATE TABLE code_manifest_snapshots (
 id TEXT PRIMARY KEY, connection_id TEXT NOT NULL REFERENCES connections(id), repository TEXT NOT NULL,
 source_revision TEXT NOT NULL, manifest_path TEXT NOT NULL, sha256 TEXT NOT NULL,
 size INTEGER NOT NULL CHECK(size BETWEEN 1 AND 131072), object_key TEXT NOT NULL UNIQUE,
 source_url TEXT NOT NULL, read_at TEXT NOT NULL, grant_id TEXT NOT NULL REFERENCES code_manifest_grants(id),
 UNIQUE(connection_id,repository,source_revision,manifest_path,sha256)
);
CREATE INDEX code_manifest_snapshots_connection ON code_manifest_snapshots(connection_id,read_at);
CREATE TRIGGER code_manifest_grants_immutable_update BEFORE UPDATE ON code_manifest_grants BEGIN SELECT RAISE(ABORT,'Source manifest grants are retained decisions'); END;
CREATE TRIGGER code_manifest_grants_immutable_delete BEFORE DELETE ON code_manifest_grants BEGIN SELECT RAISE(ABORT,'Source manifest grants are retained decisions'); END;
CREATE TRIGGER code_manifest_snapshots_immutable_update BEFORE UPDATE ON code_manifest_snapshots BEGIN SELECT RAISE(ABORT,'Source manifest snapshots are immutable'); END;
CREATE TRIGGER code_manifest_snapshots_immutable_delete BEFORE DELETE ON code_manifest_snapshots BEGIN SELECT RAISE(ABORT,'Source manifest snapshots are immutable'); END;
CREATE TRIGGER portable_generation_code_manifest_grants_insert AFTER INSERT ON code_manifest_grants BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
CREATE TRIGGER portable_generation_code_manifest_snapshots_insert AFTER INSERT ON code_manifest_snapshots BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
