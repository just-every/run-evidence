-- FOLLOWUP-001 channels and rules. Slack bot tokens and Teams workflow URLs are
-- credentials: sealed under the installation key, never archived. Without a
-- settings row, sends are immediate and the digest uses its defaults.
ALTER TABLE followups ADD COLUMN channel TEXT NOT NULL DEFAULT 'email';
CREATE TABLE followup_settings (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1), timezone TEXT NOT NULL, calendar_enabled INTEGER NOT NULL CHECK(calendar_enabled IN (0,1)),
 business_days TEXT NOT NULL, holidays TEXT NOT NULL DEFAULT '[]', quiet_start TEXT NOT NULL, quiet_end TEXT NOT NULL,
 digest_enabled INTEGER NOT NULL CHECK(digest_enabled IN (0,1)), digest_day INTEGER NOT NULL CHECK(digest_day BETWEEN 0 AND 6), digest_time TEXT NOT NULL,
 repeat_days INTEGER NOT NULL CHECK(repeat_days BETWEEN 0 AND 30), escalate_after_days INTEGER NOT NULL CHECK(escalate_after_days BETWEEN 0 AND 60), escalation_person_id TEXT REFERENCES people(id),
 updated_by TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE followup_channels (
 id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('slack','teams')), label TEXT NOT NULL, account TEXT NOT NULL, target TEXT NOT NULL DEFAULT '',
 secret_ciphertext TEXT, secret_iv TEXT, status TEXT NOT NULL CHECK(status IN ('active','revoked','needs reconnect','inactive after restore')),
 created_by TEXT NOT NULL, created_name TEXT NOT NULL, created_at TEXT NOT NULL, rotated_at TEXT, revoked_at TEXT, last_success_at TEXT, last_error TEXT NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX followup_channel_kind ON followup_channels(kind) WHERE status='active';
CREATE TABLE notify_preferences (person_id TEXT PRIMARY KEY REFERENCES people(id), via TEXT NOT NULL CHECK(via IN ('email','slack','teams')), all_clear INTEGER NOT NULL DEFAULT 0 CHECK(all_clear IN (0,1)), updated_by TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE followup_pauses (id TEXT PRIMARY KEY, subject_id TEXT NOT NULL, reason TEXT NOT NULL, paused_by TEXT NOT NULL, paused_at TEXT NOT NULL, resumed_by TEXT, resumed_at TEXT);
CREATE UNIQUE INDEX followup_pause_active ON followup_pauses(subject_id) WHERE resumed_at IS NULL;
