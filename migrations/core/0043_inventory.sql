-- INVENTORY-001. These are presentation decisions only. No resource, People,
-- identity match, authentication, or test-population row is changed here.
CREATE TABLE inventory_decisions (
 id TEXT PRIMARY KEY, source_key TEXT NOT NULL, canonical_key TEXT NOT NULL,
 revision INTEGER NOT NULL, owner_person_id TEXT REFERENCES people(id),
 criticality TEXT NOT NULL CHECK(criticality IN ('unknown','low','medium','high','critical')),
 scope TEXT NOT NULL CHECK(scope IN ('included','excluded')),
 lifecycle TEXT NOT NULL CHECK(lifecycle IN ('active','retired')),
 reason TEXT NOT NULL, actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, at TEXT NOT NULL,
 UNIQUE(source_key,revision)
);
CREATE INDEX inventory_decisions_source ON inventory_decisions(source_key,revision);
CREATE TRIGGER inventory_decisions_immutable BEFORE UPDATE ON inventory_decisions BEGIN SELECT RAISE(ABORT,'immutable_inventory_decision'); END;
CREATE TRIGGER inventory_decisions_retained BEFORE DELETE ON inventory_decisions BEGIN SELECT RAISE(ABORT,'immutable_inventory_decision'); END;
CREATE TABLE inventory_group_events (
 id TEXT PRIMARY KEY, operation_id TEXT NOT NULL, source_key TEXT NOT NULL,
 canonical_key TEXT NOT NULL, previous_canonical_key TEXT NOT NULL, revision INTEGER NOT NULL,
 action TEXT NOT NULL CHECK(action IN ('group','ungroup')), reason TEXT NOT NULL,
 actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, at TEXT NOT NULL,
 UNIQUE(source_key,revision)
);
CREATE INDEX inventory_group_events_source ON inventory_group_events(source_key,revision);
CREATE TRIGGER inventory_group_events_immutable BEFORE UPDATE ON inventory_group_events BEGIN SELECT RAISE(ABORT,'immutable_inventory_group'); END;
CREATE TRIGGER inventory_group_events_retained BEFORE DELETE ON inventory_group_events BEGIN SELECT RAISE(ABORT,'immutable_inventory_group'); END;
CREATE TRIGGER portable_generation_inventory_decisions_insert AFTER INSERT ON inventory_decisions BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
CREATE TRIGGER portable_generation_inventory_decisions_update AFTER UPDATE ON inventory_decisions BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
CREATE TRIGGER portable_generation_inventory_decisions_delete AFTER DELETE ON inventory_decisions BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
CREATE TRIGGER portable_generation_inventory_group_events_insert AFTER INSERT ON inventory_group_events BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
CREATE TRIGGER portable_generation_inventory_group_events_update AFTER UPDATE ON inventory_group_events BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
CREATE TRIGGER portable_generation_inventory_group_events_delete AFTER DELETE ON inventory_group_events BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
