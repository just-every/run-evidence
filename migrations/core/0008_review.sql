-- Review grants store only a SHA-256 digest of the one-time bearer token.
CREATE TABLE review_folders (
 id TEXT PRIMARY KEY,
 reviewer_label TEXT NOT NULL,
 period_from TEXT NOT NULL,
 period_to TEXT NOT NULL,
 expires_at TEXT NOT NULL,
 created_at TEXT NOT NULL,
 closed_at TEXT,
 token_hash TEXT UNIQUE,
 CHECK(period_from <= period_to)
);
CREATE TABLE review_folder_controls (
 folder_id TEXT NOT NULL REFERENCES review_folders(id),
 control_id TEXT NOT NULL REFERENCES controls(id),
 PRIMARY KEY(folder_id,control_id)
);
CREATE TABLE review_events (
 id TEXT PRIMARY KEY,
 folder_id TEXT REFERENCES review_folders(id),
 exhibit_id TEXT REFERENCES exhibits(id),
 action TEXT NOT NULL CHECK(action IN ('page','list','receipt','download','unknown')),
 outcome TEXT NOT NULL CHECK(outcome IN ('allowed','refused')),
 occurred_at TEXT NOT NULL
);
CREATE INDEX review_events_folder ON review_events(folder_id,occurred_at);
CREATE TRIGGER review_folder_no_reopen BEFORE UPDATE ON review_folders
 WHEN OLD.closed_at IS NOT NULL AND (NEW.closed_at IS NULL OR NEW.closed_at != OLD.closed_at OR NEW.token_hash IS NOT OLD.token_hash)
 BEGIN SELECT RAISE(ABORT, 'closed_review_folder'); END;
