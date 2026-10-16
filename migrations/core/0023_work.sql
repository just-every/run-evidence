-- Remediation tickets in Vector and external trackers (WORK-001). Each
-- destination holds its own issue-write credential, sealed under the
-- installation key and never shared with collection. Tickets mirror tracker
-- assignee and status; a closed ticket only queues a re-test.
CREATE TABLE tracker_destinations (
 id TEXT PRIMARY KEY, provider TEXT NOT NULL CHECK(provider IN ('vector','jira','linear','github','asana')),
 label TEXT NOT NULL, api_base TEXT NOT NULL, account TEXT NOT NULL, project TEXT NOT NULL, project_name TEXT NOT NULL DEFAULT '',
 mapping_json TEXT NOT NULL DEFAULT '{}', secret_ciphertext TEXT, secret_iv TEXT, hook_ciphertext TEXT, hook_iv TEXT, hook_audience TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL CHECK(status IN ('active','revoked','needs reconnect','inactive after restore')),
 created_by TEXT NOT NULL, created_name TEXT NOT NULL, created_at TEXT NOT NULL, rotated_at TEXT, revoked_at TEXT,
 last_success_at TEXT, last_error TEXT NOT NULL DEFAULT ''
);
CREATE TABLE tickets (
 id TEXT PRIMARY KEY, obligation_id TEXT NOT NULL REFERENCES obligations(id), destination_id TEXT NOT NULL REFERENCES tracker_destinations(id),
 remote_id TEXT, remote_key TEXT, remote_url TEXT, created_at TEXT NOT NULL, created_name TEXT NOT NULL,
 sync_state TEXT NOT NULL CHECK(sync_state IN ('creating','linked','creation uncertain','mapping failed','authorization lost','remote deleted','conflict','sync failed')),
 sync_error TEXT NOT NULL DEFAULT '', remote_status TEXT NOT NULL DEFAULT '', remote_closed INTEGER NOT NULL DEFAULT 0 CHECK(remote_closed IN (0,1)),
 remote_assignee TEXT, remote_due TEXT, synced_due TEXT, last_synced_at TEXT, last_attempt_at TEXT,
 UNIQUE(obligation_id,destination_id)
);
CREATE UNIQUE INDEX tickets_remote ON tickets(destination_id,remote_id) WHERE remote_id IS NOT NULL;
CREATE TABLE ticket_events (id TEXT PRIMARY KEY, ticket_id TEXT NOT NULL REFERENCES tickets(id), kind TEXT NOT NULL, remote_value TEXT, local_value TEXT, detail TEXT NOT NULL DEFAULT '', trigger TEXT NOT NULL, at TEXT NOT NULL);
CREATE INDEX ticket_events_ticket ON ticket_events(ticket_id,at);
CREATE TRIGGER ticket_events_immutable BEFORE UPDATE ON ticket_events BEGIN SELECT RAISE(ABORT,'immutable_event'); END;
CREATE TRIGGER ticket_events_retained BEFORE DELETE ON ticket_events BEGIN SELECT RAISE(ABORT,'immutable_event'); END;
-- Remote comments already mirrored (either direction) are never mirrored twice.
CREATE TABLE ticket_comments (ticket_id TEXT NOT NULL REFERENCES tickets(id), remote_comment_id TEXT NOT NULL, direction TEXT NOT NULL CHECK(direction IN ('in','out')), at TEXT NOT NULL, PRIMARY KEY(ticket_id,remote_comment_id));
-- Inbound webhook deliveries: a redelivered or replayed event is admitted once.
CREATE TABLE tracker_deliveries (destination_id TEXT NOT NULL REFERENCES tracker_destinations(id), delivery_id TEXT NOT NULL, ticket_ref TEXT NOT NULL DEFAULT '', outcome TEXT NOT NULL, received_at TEXT NOT NULL, PRIMARY KEY(destination_id,delivery_id));
