-- LIFECYCLE-002 ownership handover. A reassignment is appended, never changed:
-- the departed holder, the successor, the reason and who moved it stay in the
-- item's history. The handover window is owner-set in business days.
CREATE TABLE handover_events (
 id TEXT PRIMARY KEY, person_id TEXT NOT NULL REFERENCES people(id), kind TEXT NOT NULL, item_id TEXT NOT NULL, role TEXT NOT NULL, label TEXT NOT NULL,
 to_person_id TEXT NOT NULL REFERENCES people(id), reason TEXT NOT NULL, bulk INTEGER NOT NULL DEFAULT 0 CHECK(bulk IN (0,1)), actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, at TEXT NOT NULL
);
CREATE INDEX handover_events_item ON handover_events(kind,item_id,at);
CREATE TRIGGER handover_events_immutable BEFORE UPDATE ON handover_events BEGIN SELECT RAISE(ABORT,'immutable_handover'); END;
CREATE TABLE handover_settings (singleton INTEGER PRIMARY KEY CHECK(singleton=1), window_days INTEGER NOT NULL CHECK(window_days BETWEEN 1 AND 30), updated_by TEXT NOT NULL, updated_at TEXT NOT NULL);
