-- WORK-002 ticket granularity. A whole-test ticket is one remote ticket shared
-- by every failing item of a test, each item keeping its own ticket row so
-- closing the remote ticket re-tests every item. Settings are per test, with
-- a default for new tests.
DROP INDEX tickets_remote;
CREATE INDEX tickets_remote_lookup ON tickets(destination_id,remote_id) WHERE remote_id IS NOT NULL;
ALTER TABLE tickets ADD COLUMN group_id TEXT;
CREATE TABLE ticket_settings (test_id TEXT PRIMARY KEY REFERENCES tests(id), destination_id TEXT NOT NULL REFERENCES tracker_destinations(id), granularity TEXT NOT NULL CHECK(granularity IN ('item','test')), auto_create INTEGER NOT NULL CHECK(auto_create IN (0,1)), follow_up TEXT NOT NULL CHECK(follow_up IN ('reopen','new')), updated_by TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE ticket_defaults (singleton INTEGER PRIMARY KEY CHECK(singleton=1), destination_id TEXT REFERENCES tracker_destinations(id), granularity TEXT NOT NULL CHECK(granularity IN ('item','test')), auto_create INTEGER NOT NULL CHECK(auto_create IN (0,1)), follow_up TEXT NOT NULL CHECK(follow_up IN ('reopen','new')), updated_by TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE ticket_groups (
 id TEXT PRIMARY KEY, test_id TEXT NOT NULL REFERENCES tests(id), destination_id TEXT NOT NULL REFERENCES tracker_destinations(id), remote_id TEXT, remote_key TEXT, remote_url TEXT,
 created_at TEXT NOT NULL, created_name TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('open','resolved','followed up')), item_list TEXT NOT NULL DEFAULT '', handled_close_at TEXT, due_written TEXT
);
