-- Risk register (RISK-001/002) and the vendor records risks link to.
CREATE TABLE risk_methods (id TEXT PRIMARY KEY, revision INTEGER NOT NULL UNIQUE, scale INTEGER NOT NULL CHECK(scale BETWEEN 3 AND 5), likelihood_labels TEXT NOT NULL, impact_labels TEXT NOT NULL, formula TEXT NOT NULL CHECK(formula IN ('product','matrix')), matrix_json TEXT NOT NULL DEFAULT '[]', thresholds_json TEXT NOT NULL, actor_name TEXT NOT NULL, at TEXT NOT NULL);
CREATE TRIGGER risk_methods_immutable BEFORE UPDATE ON risk_methods BEGIN SELECT RAISE(ABORT,'immutable_method'); END;
CREATE TABLE vendors (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE COLLATE NOCASE, owner_person_id TEXT REFERENCES people(id), data_access TEXT NOT NULL DEFAULT '', criticality TEXT NOT NULL CHECK(criticality IN ('low','medium','high','critical')), review_due TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE risk_imports (id TEXT PRIMARY KEY, filename TEXT NOT NULL, sha256 TEXT NOT NULL, admitted INTEGER NOT NULL, refused INTEGER NOT NULL, actor_name TEXT NOT NULL, at TEXT NOT NULL);
CREATE TABLE risks (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, scenario TEXT NOT NULL, library_id TEXT,
 origin TEXT NOT NULL CHECK(origin IN ('library','import','form','api')), import_id TEXT REFERENCES risk_imports(id), source_label TEXT NOT NULL,
 owner_person_id TEXT REFERENCES people(id), assets TEXT NOT NULL DEFAULT '[]', treatment TEXT NOT NULL CHECK(treatment IN ('mitigate','accept','transfer','avoid')),
 review_due TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE risk_assessments (id TEXT PRIMARY KEY, risk_id TEXT NOT NULL REFERENCES risks(id), kind TEXT NOT NULL CHECK(kind IN ('inherent','residual')), method_revision INTEGER NOT NULL, likelihood INTEGER NOT NULL, impact INTEGER NOT NULL, score INTEGER NOT NULL, level TEXT NOT NULL, likelihood_label TEXT NOT NULL, impact_label TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '', actor_name TEXT NOT NULL, at TEXT NOT NULL);
CREATE TRIGGER risk_assessments_immutable BEFORE UPDATE ON risk_assessments BEGIN SELECT RAISE(ABORT,'immutable_assessment'); END;
CREATE TRIGGER risk_assessments_retained BEFORE DELETE ON risk_assessments BEGIN SELECT RAISE(ABORT,'immutable_assessment'); END;
CREATE TABLE risk_links (risk_id TEXT NOT NULL REFERENCES risks(id), kind TEXT NOT NULL CHECK(kind IN ('control','test','vendor','incident','asset')), target TEXT NOT NULL, added_at TEXT NOT NULL, PRIMARY KEY(risk_id,kind,target));
CREATE TABLE risk_treatments (id TEXT PRIMARY KEY, risk_id TEXT NOT NULL REFERENCES risks(id), title TEXT NOT NULL, owner_person_id TEXT REFERENCES people(id), due_date TEXT NOT NULL, verification_test_id TEXT REFERENCES tests(id), status TEXT NOT NULL CHECK(status IN ('open','done','verified')), evidence TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL);
CREATE TABLE risk_acceptances (id TEXT PRIMARY KEY, risk_id TEXT NOT NULL REFERENCES risks(id), assessment_id TEXT NOT NULL REFERENCES risk_assessments(id), rationale TEXT NOT NULL, approver_name TEXT NOT NULL, approved_by TEXT NOT NULL, approved_at TEXT NOT NULL, expires_at TEXT NOT NULL, escalated_at TEXT, CHECK(expires_at > approved_at));
