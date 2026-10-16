-- Resources, continuous control tests and immutable observations (TEST-001,
-- API-001, COLLECTION-001). Pushed records are source-reported; collector reads
-- are source-observed; the two never merge.
CREATE TABLE resource_types (type TEXT PRIMARY KEY, schema_json TEXT NOT NULL, declared_by TEXT NOT NULL, declared_at TEXT NOT NULL);
CREATE TABLE resources (
 id TEXT PRIMARY KEY, type TEXT NOT NULL, unique_id TEXT NOT NULL, display_name TEXT NOT NULL,
 source_kind TEXT NOT NULL CHECK(source_kind IN ('source-reported','source-observed')), source_ref TEXT NOT NULL, source_label TEXT NOT NULL,
 attributes_json TEXT NOT NULL, attributes_hash TEXT NOT NULL, first_seen_at TEXT NOT NULL, updated_at TEXT NOT NULL, removed_at TEXT,
 -- Last successful source read (collectors only); a stale read makes tests unknown.
 observed_at TEXT,
 UNIQUE(type,unique_id)
);
CREATE TABLE resource_versions (id TEXT PRIMARY KEY, resource_id TEXT NOT NULL REFERENCES resources(id), change TEXT NOT NULL CHECK(change IN ('created','updated','removed','restored')), attributes_json TEXT NOT NULL, source_ref TEXT NOT NULL, at TEXT NOT NULL);
CREATE INDEX resource_versions_resource ON resource_versions(resource_id,at);
CREATE TRIGGER resource_versions_immutable BEFORE UPDATE ON resource_versions BEGIN SELECT RAISE(ABORT,'immutable_history'); END;
CREATE TRIGGER resource_versions_retained BEFORE DELETE ON resource_versions BEGIN SELECT RAISE(ABORT,'immutable_history'); END;

CREATE TABLE tests (
 id TEXT PRIMARY KEY, catalogue_id TEXT UNIQUE, name TEXT NOT NULL, resource_type TEXT NOT NULL,
 criteria_json TEXT NOT NULL, cadence TEXT NOT NULL CHECK(cadence IN ('hourly','daily')),
 category TEXT NOT NULL CHECK(category IN ('cloud','identity','code','device','vulnerability','security issue','personnel','policy','vendor')),
 severity TEXT NOT NULL CHECK(severity IN ('critical','high','medium','low')),
 origin TEXT NOT NULL CHECK(origin IN ('catalogue','custom','api')), defined_by TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 1, enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)), created_at TEXT NOT NULL
);
CREATE TABLE test_controls (test_id TEXT NOT NULL REFERENCES tests(id), control_id TEXT NOT NULL REFERENCES controls(id), PRIMARY KEY(test_id,control_id));
CREATE TABLE test_revisions (id TEXT PRIMARY KEY, test_id TEXT NOT NULL REFERENCES tests(id), revision INTEGER NOT NULL, criteria_json TEXT NOT NULL, excluded_json TEXT NOT NULL DEFAULT '[]', cadence TEXT NOT NULL, actor TEXT NOT NULL, reason TEXT NOT NULL, at TEXT NOT NULL, UNIQUE(test_id,revision));
CREATE TRIGGER test_revisions_immutable BEFORE UPDATE ON test_revisions BEGIN SELECT RAISE(ABORT,'immutable_revision'); END;
CREATE TABLE test_runs (
 id TEXT PRIMARY KEY, test_id TEXT NOT NULL REFERENCES tests(id), revision INTEGER NOT NULL,
 trigger TEXT NOT NULL CHECK(trigger IN ('schedule','source-change','manual','retest')),
 started_at TEXT NOT NULL, finished_at TEXT, outcome TEXT CHECK(outcome IN ('complete','failed')),
 population INTEGER NOT NULL DEFAULT 0, passed INTEGER NOT NULL DEFAULT 0, failed INTEGER NOT NULL DEFAULT 0, unknown INTEGER NOT NULL DEFAULT 0, not_applicable INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX test_runs_test ON test_runs(test_id,started_at);
CREATE TABLE observations (
 id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES test_runs(id), test_id TEXT NOT NULL REFERENCES tests(id), revision INTEGER NOT NULL,
 resource_id TEXT NOT NULL REFERENCES resources(id), result TEXT NOT NULL CHECK(result IN ('pass','fail','unknown','not applicable')),
 expected_json TEXT NOT NULL, actual_json TEXT NOT NULL, reason TEXT NOT NULL DEFAULT '',
 source_kind TEXT NOT NULL, source_ref TEXT NOT NULL, observed_at TEXT NOT NULL, exception_id TEXT,
 -- The interval this observation stands for: since the test's previous run.
 interval_from TEXT
);
CREATE INDEX observations_item ON observations(test_id,resource_id,observed_at);
CREATE TRIGGER observations_immutable BEFORE UPDATE ON observations BEGIN SELECT RAISE(ABORT,'immutable_observation'); END;
CREATE TRIGGER observations_retained BEFORE DELETE ON observations BEGIN SELECT RAISE(ABORT,'immutable_observation'); END;
CREATE TABLE test_exceptions (id TEXT PRIMARY KEY, test_id TEXT NOT NULL REFERENCES tests(id), resource_id TEXT REFERENCES resources(id), reason TEXT NOT NULL, approved_by TEXT NOT NULL, approved_name TEXT NOT NULL, approved_at TEXT NOT NULL, expires_at TEXT NOT NULL, revoked_at TEXT, CHECK(expires_at > approved_at));
