-- ACCESS-001 owner-configured campaigns repeat every N whole months (1 to 24),
-- stored as "every-N-months". Widen the cadence check in place: the same rows
-- and ids return before commit, so items and recurrence links stay intact.
PRAGMA defer_foreign_keys = on;
CREATE TABLE access_reviews_stash AS SELECT * FROM access_reviews;
DROP TABLE access_reviews;
CREATE TABLE access_reviews (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, cadence TEXT NOT NULL CHECK(cadence IN ('quarterly','semi-annual','annual','one-off') OR cadence GLOB 'every-[1-9]-months' OR cadence GLOB 'every-1[0-9]-months' OR cadence GLOB 'every-2[0-4]-months'),
 period_from TEXT NOT NULL, period_to TEXT NOT NULL, due_date TEXT NOT NULL, sources_json TEXT NOT NULL, reviewers_json TEXT NOT NULL,
 created_by TEXT NOT NULL, created_name TEXT NOT NULL, created_at TEXT NOT NULL, completed_at TEXT, previous_id TEXT REFERENCES access_reviews(id)
);
INSERT INTO access_reviews SELECT * FROM access_reviews_stash ORDER BY rowid;
DROP TABLE access_reviews_stash;
CREATE TRIGGER portable_generation_access_reviews_insert AFTER INSERT ON "access_reviews" BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
CREATE TRIGGER portable_generation_access_reviews_update AFTER UPDATE ON "access_reviews" BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
CREATE TRIGGER portable_generation_access_reviews_delete AFTER DELETE ON "access_reviews" BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
