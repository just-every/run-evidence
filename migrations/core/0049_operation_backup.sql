-- OPS-001: include execution metadata in the complete archive's snapshot fence.
CREATE TRIGGER portable_generation_operation_steps_insert AFTER INSERT ON operation_steps BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
CREATE TRIGGER portable_generation_operation_steps_update AFTER UPDATE ON operation_steps BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;

-- A destination-local completion marker, never a claim about an external copy.
CREATE TABLE operation_recovery (singleton INTEGER PRIMARY KEY CHECK(singleton=1),restored_at TEXT NOT NULL);
