-- PROGRAM-003: framework-required program documents, their immutable revisions
-- and approvals, attached exhibits, and the ISO 27001 clause 9 records.
CREATE TABLE program_documents (
 id TEXT PRIMARY KEY, program_id TEXT NOT NULL REFERENCES programs(id), kind TEXT NOT NULL, owner_person_id TEXT REFERENCES people(id),
 review_months INTEGER NOT NULL DEFAULT 12 CHECK(review_months BETWEEN 1 AND 12), created_by TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(program_id,kind)
);
CREATE TABLE program_document_revisions (
 id TEXT PRIMARY KEY, document_id TEXT NOT NULL REFERENCES program_documents(id), revision INTEGER NOT NULL, origin TEXT NOT NULL CHECK(origin IN ('generated','edited','reconciled')),
 reason TEXT NOT NULL DEFAULT '', inputs_json TEXT NOT NULL, owner_text_json TEXT NOT NULL, content_json TEXT NOT NULL, facts_json TEXT NOT NULL, facts_hash TEXT NOT NULL,
 actor_name TEXT NOT NULL, at TEXT NOT NULL, UNIQUE(document_id,revision)
);
CREATE TRIGGER program_document_revisions_immutable BEFORE UPDATE ON program_document_revisions BEGIN SELECT RAISE(ABORT,'immutable_document_revision'); END;
CREATE TRIGGER program_document_revisions_retained BEFORE DELETE ON program_document_revisions BEGIN SELECT RAISE(ABORT,'retained_document_revision'); END;
CREATE TABLE program_document_approvals (
 revision_id TEXT PRIMARY KEY REFERENCES program_document_revisions(id), document_id TEXT NOT NULL REFERENCES program_documents(id), approver_person_id TEXT NOT NULL REFERENCES people(id),
 approved_by TEXT NOT NULL, approved_at TEXT NOT NULL, effective_date TEXT NOT NULL, review_due TEXT NOT NULL, note TEXT NOT NULL DEFAULT ''
);
CREATE TRIGGER program_document_approvals_immutable BEFORE UPDATE ON program_document_approvals BEGIN SELECT RAISE(ABORT,'immutable_document_approval'); END;
CREATE TRIGGER program_document_approvals_retained BEFORE DELETE ON program_document_approvals BEGIN SELECT RAISE(ABORT,'retained_document_approval'); END;
CREATE TABLE program_document_exhibits (
 id TEXT PRIMARY KEY, document_id TEXT NOT NULL REFERENCES program_documents(id), label TEXT NOT NULL CHECK(label IN ('data-flow diagram','network diagram','other')), filename TEXT NOT NULL,
 media_type TEXT NOT NULL, size INTEGER NOT NULL, sha256 TEXT NOT NULL, object_key TEXT NOT NULL UNIQUE, uploaded_by TEXT NOT NULL, uploaded_at TEXT NOT NULL
);
CREATE TRIGGER program_document_exhibits_immutable BEFORE UPDATE ON program_document_exhibits BEGIN SELECT RAISE(ABORT,'immutable_document_exhibit'); END;
CREATE TRIGGER program_document_exhibits_retained BEFORE DELETE ON program_document_exhibits BEGIN SELECT RAISE(ABORT,'retained_document_exhibit'); END;
CREATE TABLE iso_internal_audits (
 id TEXT PRIMARY KEY, program_id TEXT NOT NULL REFERENCES programs(id), title TEXT NOT NULL, auditor_name TEXT NOT NULL, independence TEXT NOT NULL, scope TEXT NOT NULL,
 performed_on TEXT NOT NULL, summary TEXT NOT NULL DEFAULT '', recorded_by TEXT NOT NULL, recorded_at TEXT NOT NULL
);
CREATE TABLE iso_audit_findings (
 id TEXT PRIMARY KEY, audit_id TEXT NOT NULL REFERENCES iso_internal_audits(id), kind TEXT NOT NULL CHECK(kind IN ('nonconformity','observation','opportunity')), ref TEXT NOT NULL DEFAULT '',
 description TEXT NOT NULL, corrective_action TEXT NOT NULL DEFAULT '', owner_person_id TEXT REFERENCES people(id), due_date TEXT, state TEXT NOT NULL DEFAULT 'open' CHECK(state IN ('open','closed')),
 closed_by TEXT, closed_at TEXT, closure_note TEXT, recorded_at TEXT NOT NULL
);
CREATE TABLE iso_management_reviews (
 id TEXT PRIMARY KEY, program_id TEXT NOT NULL REFERENCES programs(id), held_on TEXT NOT NULL, attendees TEXT NOT NULL, inputs_json TEXT NOT NULL, decisions TEXT NOT NULL,
 actions_json TEXT NOT NULL, recorded_by TEXT NOT NULL, recorded_at TEXT NOT NULL
);
CREATE TRIGGER iso_management_reviews_immutable BEFORE UPDATE ON iso_management_reviews BEGIN SELECT RAISE(ABORT,'immutable_management_review'); END;
CREATE TRIGGER iso_management_reviews_retained BEFORE DELETE ON iso_management_reviews BEGIN SELECT RAISE(ABORT,'retained_management_review'); END;
