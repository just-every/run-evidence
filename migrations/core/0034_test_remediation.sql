-- A custom test's own fix step, shown beside every failing item of the test
-- (catalogue tests carry theirs in the catalogue). Null when none is written.
ALTER TABLE tests ADD COLUMN remediation TEXT;
