-- VENDOR-001: supplier profile, diligence requests, expiring supplier links,
-- per-question answers, retained documents, findings and approvals.
CREATE TABLE vendor_profiles (
 vendor_id TEXT PRIMARY KEY REFERENCES vendors(id), website TEXT NOT NULL DEFAULT '', service TEXT NOT NULL DEFAULT '',
 contact_name TEXT NOT NULL DEFAULT '', contact_email TEXT NOT NULL DEFAULT '', data_types TEXT NOT NULL DEFAULT '[]',
 region TEXT NOT NULL DEFAULT 'US', annual_cost_usd INTEGER, risk_tier TEXT NOT NULL CHECK(risk_tier IN ('low','medium','high')),
 tier_basis TEXT NOT NULL DEFAULT '', renewal_date TEXT, revision INTEGER NOT NULL, updated_by TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE vendor_subprocessors (
 id TEXT PRIMARY KEY, vendor_id TEXT NOT NULL REFERENCES vendors(id), name TEXT NOT NULL, purpose TEXT NOT NULL DEFAULT '', region TEXT NOT NULL DEFAULT '',
 added_by TEXT NOT NULL, added_at TEXT NOT NULL, removed_by TEXT, removed_at TEXT
);
CREATE TABLE vendor_templates (id TEXT PRIMARY KEY, name TEXT NOT NULL, questions_json TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TRIGGER vendor_templates_immutable BEFORE UPDATE ON vendor_templates BEGIN SELECT RAISE(ABORT,'immutable_vendor_template'); END;
CREATE TRIGGER vendor_templates_retained BEFORE DELETE ON vendor_templates BEGIN SELECT RAISE(ABORT,'retained_vendor_template'); END;
-- A restored link has no digest: it is closed and cannot authenticate.
CREATE TABLE vendor_links (
 id TEXT PRIMARY KEY, vendor_id TEXT NOT NULL REFERENCES vendors(id), token_hash TEXT UNIQUE, contact_email TEXT NOT NULL DEFAULT '',
 expires_at TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL, closed_at TEXT, emailed_at TEXT
);
CREATE TABLE vendor_link_events (id TEXT PRIMARY KEY, link_id TEXT REFERENCES vendor_links(id), vendor_id TEXT REFERENCES vendors(id), action TEXT NOT NULL, outcome TEXT NOT NULL CHECK(outcome IN ('allowed','refused')), at TEXT NOT NULL);
CREATE TABLE vendor_requests (
 id TEXT PRIMARY KEY, vendor_id TEXT NOT NULL REFERENCES vendors(id), kind TEXT NOT NULL CHECK(kind IN ('soc2','soc1','iso27001','pentest','baa','dpa','contract','questionnaire','other')),
 label TEXT NOT NULL, template_id TEXT, template_name TEXT, questions_json TEXT, due_date TEXT, created_by TEXT NOT NULL, created_at TEXT NOT NULL,
 closed_at TEXT, closed_reason TEXT, closed_by TEXT
);
CREATE TABLE vendor_link_requests (link_id TEXT NOT NULL REFERENCES vendor_links(id), request_id TEXT NOT NULL REFERENCES vendor_requests(id), PRIMARY KEY(link_id,request_id));
CREATE TABLE vendor_documents (
 id TEXT PRIMARY KEY, vendor_id TEXT NOT NULL REFERENCES vendors(id), request_id TEXT REFERENCES vendor_requests(id),
 kind TEXT NOT NULL CHECK(kind IN ('soc2','soc1','iso27001','pentest','baa','dpa','contract','other')), filename TEXT NOT NULL, media_type TEXT NOT NULL, size INTEGER NOT NULL,
 sha256 TEXT NOT NULL, object_key TEXT NOT NULL UNIQUE, origin TEXT NOT NULL CHECK(origin IN ('supplier','owner')), provided_by TEXT NOT NULL, link_id TEXT REFERENCES vendor_links(id),
 effective_on TEXT, expires_on TEXT, supersedes TEXT REFERENCES vendor_documents(id), added_at TEXT NOT NULL,
 review_state TEXT NOT NULL DEFAULT 'received' CHECK(review_state IN ('received','verified','rejected')), reviewed_by TEXT, reviewed_at TEXT, review_notes TEXT
);
CREATE TRIGGER vendor_documents_bytes BEFORE UPDATE ON vendor_documents WHEN NEW.sha256<>OLD.sha256 OR NEW.object_key<>OLD.object_key OR NEW.size<>OLD.size OR NEW.filename<>OLD.filename OR NEW.origin<>OLD.origin OR NEW.provided_by<>OLD.provided_by OR NEW.added_at<>OLD.added_at OR OLD.review_state<>'received' BEGIN SELECT RAISE(ABORT,'immutable_vendor_document'); END;
CREATE TRIGGER vendor_documents_retained BEFORE DELETE ON vendor_documents BEGIN SELECT RAISE(ABORT,'retained_vendor_document'); END;
CREATE TABLE vendor_submissions (id TEXT PRIMARY KEY, request_id TEXT NOT NULL UNIQUE REFERENCES vendor_requests(id), link_id TEXT NOT NULL REFERENCES vendor_links(id), respondent_name TEXT NOT NULL, respondent_email TEXT NOT NULL, submitted_at TEXT NOT NULL);
CREATE TABLE vendor_answers (
 id TEXT PRIMARY KEY, request_id TEXT NOT NULL REFERENCES vendor_requests(id), question_id TEXT NOT NULL, answer TEXT NOT NULL CHECK(answer IN ('yes','no','na')),
 comment TEXT NOT NULL DEFAULT '', link_id TEXT NOT NULL REFERENCES vendor_links(id), answered_at TEXT NOT NULL
);
CREATE TRIGGER vendor_answers_immutable BEFORE UPDATE ON vendor_answers BEGIN SELECT RAISE(ABORT,'immutable_vendor_answer'); END;
CREATE TRIGGER vendor_answers_retained BEFORE DELETE ON vendor_answers BEGIN SELECT RAISE(ABORT,'retained_vendor_answer'); END;
CREATE TABLE vendor_findings (
 id TEXT PRIMARY KEY, vendor_id TEXT NOT NULL REFERENCES vendors(id), source_kind TEXT NOT NULL CHECK(source_kind IN ('document','answer','manual')), source_ref TEXT NOT NULL DEFAULT '',
 severity TEXT NOT NULL CHECK(severity IN ('low','medium','high','critical')), title TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '', recorded_by TEXT NOT NULL, recorded_at TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'open' CHECK(state IN ('open','resolved','accepted')), decision_reason TEXT, approver_person_id TEXT REFERENCES people(id), decided_by TEXT, decided_at TEXT
);
CREATE TABLE vendor_approvals (
 id TEXT PRIMARY KEY, vendor_id TEXT NOT NULL REFERENCES vendors(id), decision TEXT NOT NULL CHECK(decision IN ('approved','conditional','declined')), rationale TEXT NOT NULL,
 approver_person_id TEXT REFERENCES people(id), conditions TEXT NOT NULL DEFAULT '', condition_expires_on TEXT, reassess_by TEXT NOT NULL, exceptions_json TEXT NOT NULL DEFAULT '[]',
 decided_by TEXT NOT NULL, decided_at TEXT NOT NULL, condition_closed_by TEXT, condition_closed_at TEXT, condition_closed_note TEXT
);
CREATE TRIGGER vendor_approvals_immutable BEFORE UPDATE ON vendor_approvals WHEN NEW.decision<>OLD.decision OR NEW.rationale<>OLD.rationale OR NEW.conditions<>OLD.conditions OR NEW.reassess_by<>OLD.reassess_by OR NEW.decided_at<>OLD.decided_at OR OLD.condition_closed_at IS NOT NULL BEGIN SELECT RAISE(ABORT,'immutable_vendor_approval'); END;
CREATE TRIGGER vendor_approvals_retained BEFORE DELETE ON vendor_approvals BEGIN SELECT RAISE(ABORT,'retained_vendor_approval'); END;
CREATE TABLE vendor_assertions (
 id TEXT PRIMARY KEY, vendor_id TEXT NOT NULL REFERENCES vendors(id), claim TEXT NOT NULL, source_url TEXT NOT NULL DEFAULT '', recorded_by TEXT NOT NULL, recorded_at TEXT NOT NULL,
 verified_document_id TEXT REFERENCES vendor_documents(id), verified_by TEXT, verified_at TEXT
);
