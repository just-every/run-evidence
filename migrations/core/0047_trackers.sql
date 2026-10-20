-- WORK-001: preserve every destination, credential and ticket reference while widening provider admission.
PRAGMA defer_foreign_keys = on;
CREATE TABLE tracker_destinations_stash AS SELECT * FROM tracker_destinations;
DROP TABLE tracker_destinations;
CREATE TABLE tracker_destinations (
 id TEXT PRIMARY KEY, provider TEXT NOT NULL CHECK(provider IN ('vector','jira','linear','github','asana','gitlab','azure-boards','shortcut','clickup','monday','basecamp','freshservice','youtrack')),
 label TEXT NOT NULL, api_base TEXT NOT NULL, account TEXT NOT NULL, project TEXT NOT NULL, project_name TEXT NOT NULL DEFAULT '',
 mapping_json TEXT NOT NULL DEFAULT '{}', secret_ciphertext TEXT, secret_iv TEXT, hook_ciphertext TEXT, hook_iv TEXT, hook_audience TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL CHECK(status IN ('active','revoked','needs reconnect','inactive after restore')),
 created_by TEXT NOT NULL, created_name TEXT NOT NULL, created_at TEXT NOT NULL, rotated_at TEXT, revoked_at TEXT,
 last_success_at TEXT, last_error TEXT NOT NULL DEFAULT ''
);
INSERT INTO tracker_destinations SELECT * FROM tracker_destinations_stash ORDER BY rowid;
DROP TABLE tracker_destinations_stash;
CREATE TRIGGER portable_generation_tracker_destinations_insert AFTER INSERT ON "tracker_destinations" BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
CREATE TRIGGER portable_generation_tracker_destinations_update AFTER UPDATE ON "tracker_destinations" BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
CREATE TRIGGER portable_generation_tracker_destinations_delete AFTER DELETE ON "tracker_destinations" BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
