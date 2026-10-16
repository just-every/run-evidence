-- Remediation obligations, SLA policies and automatic re-tests (REMEDY-001/002).
CREATE TABLE sla_policies (id TEXT PRIMARY KEY, category TEXT NOT NULL, severity TEXT NOT NULL CHECK(severity IN ('critical','high','medium','low')), days INTEGER NOT NULL CHECK(days BETWEEN 1 AND 365), effective_at TEXT NOT NULL, actor_id TEXT NOT NULL, actor_name TEXT NOT NULL);
CREATE TRIGGER sla_policies_immutable BEFORE UPDATE ON sla_policies BEGIN SELECT RAISE(ABORT,'immutable_policy'); END;
CREATE TABLE obligations (
 id TEXT PRIMARY KEY, test_id TEXT NOT NULL REFERENCES tests(id), resource_id TEXT NOT NULL REFERENCES resources(id),
 severity TEXT NOT NULL, category TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('open','awaiting verification','verified','risk accepted')),
 clock_started_at TEXT NOT NULL, sla_days INTEGER NOT NULL, sla_policy_id TEXT, opened_observation_id TEXT NOT NULL REFERENCES observations(id),
 owner_person_id TEXT REFERENCES people(id), next_action TEXT NOT NULL DEFAULT '', target_date TEXT,
 accepted_until TEXT, accepted_by TEXT, closed_at TEXT, verified_observation_id TEXT REFERENCES observations(id), cycles INTEGER NOT NULL DEFAULT 1,
 UNIQUE(test_id,resource_id)
);
CREATE TABLE obligation_events (id TEXT PRIMARY KEY, obligation_id TEXT NOT NULL REFERENCES obligations(id), kind TEXT NOT NULL, actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, body TEXT NOT NULL DEFAULT '', observation_id TEXT, at TEXT NOT NULL);
CREATE INDEX obligation_events_obligation ON obligation_events(obligation_id,at);
CREATE TRIGGER obligation_events_immutable BEFORE UPDATE ON obligation_events BEGIN SELECT RAISE(ABORT,'immutable_event'); END;
CREATE TRIGGER obligation_events_retained BEFORE DELETE ON obligation_events BEGIN SELECT RAISE(ABORT,'immutable_event'); END;
CREATE TABLE retests (id TEXT PRIMARY KEY, obligation_id TEXT NOT NULL REFERENCES obligations(id), reason TEXT NOT NULL, queued_at TEXT NOT NULL, run_id TEXT REFERENCES test_runs(id), done_at TEXT);
CREATE UNIQUE INDEX retests_pending ON retests(obligation_id) WHERE done_at IS NULL;
