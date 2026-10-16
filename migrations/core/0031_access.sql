-- ACCESS-001 access-review campaigns over a frozen population. Decisions are
-- appended, never changed; a revocation closes only on a fresh source read or
-- a newer uploaded list that no longer has the account.
CREATE TABLE access_reviews (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, cadence TEXT NOT NULL CHECK(cadence IN ('quarterly','semi-annual','annual','one-off')),
 period_from TEXT NOT NULL, period_to TEXT NOT NULL, due_date TEXT NOT NULL, sources_json TEXT NOT NULL, reviewers_json TEXT NOT NULL,
 created_by TEXT NOT NULL, created_name TEXT NOT NULL, created_at TEXT NOT NULL, completed_at TEXT, previous_id TEXT REFERENCES access_reviews(id)
);
CREATE TABLE access_review_items (
 id TEXT PRIMARY KEY, review_id TEXT NOT NULL REFERENCES access_reviews(id), source TEXT NOT NULL, source_label TEXT NOT NULL, provenance TEXT NOT NULL CHECK(provenance IN ('source-observed','manually-asserted')),
 subject_ref TEXT NOT NULL, account_key TEXT NOT NULL, display_name TEXT NOT NULL, attributes_json TEXT NOT NULL, reviewer_person_id TEXT REFERENCES people(id), supplemental INTEGER NOT NULL DEFAULT 0, added_at TEXT NOT NULL,
 UNIQUE(review_id,source,account_key)
);
CREATE TRIGGER access_review_items_frozen BEFORE UPDATE ON access_review_items BEGIN SELECT RAISE(ABORT,'frozen_population'); END;
CREATE TABLE access_decisions (id TEXT PRIMARY KEY, item_id TEXT NOT NULL REFERENCES access_review_items(id), decision TEXT NOT NULL CHECK(decision IN ('retain','revoke','change','excluded')), reason TEXT NOT NULL, decided_by_person TEXT, decided_by_name TEXT NOT NULL, decided_by_email TEXT NOT NULL, at TEXT NOT NULL);
CREATE TRIGGER access_decisions_immutable BEFORE UPDATE ON access_decisions BEGIN SELECT RAISE(ABORT,'immutable_decision'); END;
CREATE TABLE access_delegations (item_id TEXT PRIMARY KEY REFERENCES access_review_items(id), to_person_id TEXT NOT NULL REFERENCES people(id), reason TEXT NOT NULL, by_name TEXT NOT NULL, at TEXT NOT NULL);
CREATE TABLE access_revocations (item_id TEXT PRIMARY KEY REFERENCES access_review_items(id), state TEXT NOT NULL CHECK(state IN ('requested','unresolved','verified')), requested_at TEXT NOT NULL, checked_at TEXT, verified_at TEXT, evidence TEXT NOT NULL DEFAULT '');
