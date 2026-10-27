-- WORK-001: retain tickets, immutable events, comments and foreign keys while
-- adding explicit human field-write outcomes. No external action is replayed.
PRAGMA defer_foreign_keys = on;
CREATE TABLE tickets_stash AS SELECT * FROM tickets;
DROP TABLE tickets;
CREATE TABLE tickets (
 id TEXT PRIMARY KEY, obligation_id TEXT NOT NULL REFERENCES obligations(id), destination_id TEXT NOT NULL REFERENCES tracker_destinations(id),
 remote_id TEXT, remote_key TEXT, remote_url TEXT, created_at TEXT NOT NULL, created_name TEXT NOT NULL,
 sync_state TEXT NOT NULL CHECK(sync_state IN ('creating','linked','creation uncertain','mapping failed','authorization lost','remote deleted','conflict','sync failed','writing fields','field conflict','field write uncertain','field write failed')),
 sync_error TEXT NOT NULL DEFAULT '', remote_status TEXT NOT NULL DEFAULT '', remote_closed INTEGER NOT NULL DEFAULT 0 CHECK(remote_closed IN (0,1)),
 remote_assignee TEXT, remote_due TEXT, synced_due TEXT, last_synced_at TEXT, last_attempt_at TEXT, group_id TEXT,
 UNIQUE(obligation_id,destination_id)
);
INSERT INTO tickets SELECT * FROM tickets_stash ORDER BY rowid;
DROP TABLE tickets_stash;
CREATE INDEX tickets_remote_lookup ON tickets(destination_id,remote_id) WHERE remote_id IS NOT NULL;
CREATE TRIGGER portable_generation_tickets_insert AFTER INSERT ON "tickets" BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
CREATE TRIGGER portable_generation_tickets_update AFTER UPDATE ON "tickets" BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
CREATE TRIGGER portable_generation_tickets_delete AFTER DELETE ON "tickets" BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
