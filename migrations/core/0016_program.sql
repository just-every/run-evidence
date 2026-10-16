-- Program domain. Widen control groups and requirement cadences in place: the
-- same rows and ids return before commit, so receipt references stay intact.
PRAGMA defer_foreign_keys = on;
CREATE TABLE controls_stash AS SELECT * FROM controls;
CREATE TABLE requirements_stash AS SELECT * FROM requirements;
DROP TABLE requirements;
DROP TABLE controls;
CREATE TABLE controls (id TEXT PRIMARY KEY, name TEXT NOT NULL, group_name TEXT NOT NULL CHECK(group_name IN ('Access','Data','Change','People','Vendors','Operations','Governance')), created_at TEXT NOT NULL);
CREATE TABLE requirements (id TEXT PRIMARY KEY, control_id TEXT NOT NULL REFERENCES controls(id), name TEXT NOT NULL, cadence TEXT NOT NULL CHECK(cadence IN ('daily','weekly','monthly','quarterly','semi-annual','annual')), created_at TEXT NOT NULL);
INSERT INTO controls SELECT * FROM controls_stash;
INSERT INTO requirements SELECT * FROM requirements_stash;
DROP TABLE requirements_stash;
DROP TABLE controls_stash;
CREATE INDEX requirements_control ON requirements(control_id);

-- People named as owners, contributors, approvers and reminder recipients.
CREATE TABLE people (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE, kind TEXT NOT NULL CHECK(kind IN ('employee','contractor','auditor','other')), created_at TEXT NOT NULL, created_by TEXT NOT NULL);

-- Permanent product action audit: actor, subject, outcome; never raw secrets.
CREATE TABLE product_audit (id TEXT PRIMARY KEY, actor_kind TEXT NOT NULL CHECK(actor_kind IN ('owner','token','system')), actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, action TEXT NOT NULL, subject TEXT NOT NULL, outcome TEXT NOT NULL CHECK(outcome IN ('succeeded','refused','failed','uncertain')), detail TEXT NOT NULL DEFAULT '', at TEXT NOT NULL);
CREATE INDEX product_audit_at ON product_audit(at);
CREATE TRIGGER product_audit_no_update BEFORE UPDATE ON product_audit BEGIN SELECT RAISE(ABORT,'immutable_audit'); END;
CREATE TRIGGER product_audit_no_delete BEFORE DELETE ON product_audit BEGIN SELECT RAISE(ABORT,'immutable_audit'); END;

-- Framework programs (PROGRAM-001). Scope fields are current values; every
-- change appends a full revision snapshot with actor and reason.
CREATE TABLE programs (
 id TEXT PRIMARY KEY, framework TEXT NOT NULL CHECK(framework IN ('soc2','iso27001','hipaa','pci')), edition TEXT NOT NULL,
 name TEXT NOT NULL, legal_entity TEXT NOT NULL, report_type TEXT, categories TEXT NOT NULL DEFAULT '[]',
 products TEXT NOT NULL DEFAULT '[]', teams TEXT NOT NULL DEFAULT '[]', regions TEXT NOT NULL DEFAULT '[]', systems TEXT NOT NULL DEFAULT '[]',
 audit_from TEXT NOT NULL, audit_to TEXT NOT NULL, assessor TEXT NOT NULL DEFAULT '', lead_person_id TEXT REFERENCES people(id),
 milestones TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, CHECK(audit_from <= audit_to)
);
CREATE TABLE program_revisions (id TEXT PRIMARY KEY, program_id TEXT NOT NULL REFERENCES programs(id), revision INTEGER NOT NULL, snapshot_json TEXT NOT NULL, actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, reason TEXT NOT NULL, at TEXT NOT NULL, UNIQUE(program_id,revision));
CREATE TABLE program_applicability (id TEXT PRIMARY KEY, program_id TEXT NOT NULL REFERENCES programs(id), ref TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('excluded','included')), rationale TEXT NOT NULL, actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, decided_at TEXT NOT NULL);
CREATE INDEX program_applicability_ref ON program_applicability(program_id,ref,decided_at);
CREATE TABLE program_reviews (id TEXT PRIMARY KEY, program_id TEXT NOT NULL REFERENCES programs(id), reviewer TEXT NOT NULL, notes TEXT NOT NULL, snapshot_hash TEXT NOT NULL, recorded_by TEXT NOT NULL, recorded_name TEXT NOT NULL, at TEXT NOT NULL);
CREATE TABLE edition_changes (
 id TEXT PRIMARY KEY, program_id TEXT NOT NULL REFERENCES programs(id), from_edition TEXT NOT NULL, to_edition TEXT NOT NULL, diff_json TEXT NOT NULL,
 proposed_by TEXT NOT NULL, proposed_name TEXT NOT NULL, proposed_at TEXT NOT NULL,
 decision TEXT CHECK(decision IN ('accepted','rejected')), decided_by TEXT, decided_name TEXT, decided_at TEXT, reason TEXT
);
CREATE TRIGGER edition_change_decided_once BEFORE UPDATE ON edition_changes WHEN OLD.decision IS NOT NULL BEGIN SELECT RAISE(ABORT,'decided_edition_change'); END;
CREATE UNIQUE INDEX edition_change_open ON edition_changes(program_id) WHERE decision IS NULL;
CREATE TABLE program_editions (id TEXT PRIMARY KEY, program_id TEXT NOT NULL REFERENCES programs(id), edition TEXT NOT NULL, effective_at TEXT NOT NULL, change_id TEXT REFERENCES edition_changes(id));

-- Shipped library controls adopted into this installation's controls.
CREATE TABLE library_adoptions (control_id TEXT PRIMARY KEY REFERENCES controls(id), library_id TEXT NOT NULL UNIQUE, library_revision INTEGER NOT NULL, adopted_at TEXT NOT NULL);

-- Reusable mappings and accountable ownership (PROGRAM-002).
CREATE TABLE control_mappings (id TEXT PRIMARY KEY, control_id TEXT NOT NULL REFERENCES controls(id), framework TEXT NOT NULL, edition TEXT NOT NULL, ref TEXT NOT NULL, added_by TEXT NOT NULL, added_name TEXT NOT NULL, added_at TEXT NOT NULL, reason TEXT NOT NULL, removed_by TEXT, removed_name TEXT, removed_at TEXT, removal_reason TEXT);
CREATE UNIQUE INDEX control_mapping_active ON control_mappings(control_id,framework,edition,ref) WHERE removed_at IS NULL;
CREATE TABLE control_owners (id TEXT PRIMARY KEY, control_id TEXT NOT NULL REFERENCES controls(id), owner_person_id TEXT NOT NULL REFERENCES people(id), contributors TEXT NOT NULL DEFAULT '[]', due_date TEXT, actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, reason TEXT NOT NULL, at TEXT NOT NULL);
CREATE INDEX control_owners_control ON control_owners(control_id,at);
CREATE TABLE control_scope (id TEXT PRIMARY KEY, control_id TEXT NOT NULL REFERENCES controls(id), asset TEXT NOT NULL, action TEXT NOT NULL CHECK(action IN ('added','removed')), reason TEXT NOT NULL, effective_at TEXT NOT NULL, actor_id TEXT NOT NULL, actor_name TEXT NOT NULL);
CREATE INDEX control_scope_control ON control_scope(control_id,effective_at);
CREATE TRIGGER program_revisions_immutable BEFORE UPDATE ON program_revisions BEGIN SELECT RAISE(ABORT,'immutable_revision'); END;
CREATE TRIGGER program_applicability_immutable BEFORE UPDATE ON program_applicability BEGIN SELECT RAISE(ABORT,'immutable_decision'); END;
CREATE TRIGGER control_owners_immutable BEFORE UPDATE ON control_owners BEGIN SELECT RAISE(ABORT,'immutable_assignment'); END;
CREATE TRIGGER control_scope_immutable BEFORE UPDATE ON control_scope BEGIN SELECT RAISE(ABORT,'immutable_scope'); END;
CREATE TRIGGER control_scope_retained BEFORE DELETE ON control_scope BEGIN SELECT RAISE(ABORT,'immutable_scope'); END;

-- Annual, semi-annual and anchored renewal (CADENCE-001). Schedule revisions
-- apply from effective_from; a requirement without one keeps its own cadence.
CREATE TABLE requirement_schedules (
 id TEXT PRIMARY KEY, requirement_id TEXT NOT NULL REFERENCES requirements(id),
 cadence TEXT NOT NULL CHECK(cadence IN ('daily','weekly','monthly','quarterly','semi-annual','annual')),
 anchor TEXT NOT NULL CHECK(anchor IN ('calendar','effective-date','fiscal-year','audit-window')),
 fiscal_start_month INTEGER CHECK(fiscal_start_month BETWEEN 1 AND 12), window_start TEXT, program_id TEXT REFERENCES programs(id),
 reminder_lead_days INTEGER CHECK(reminder_lead_days BETWEEN 1 AND 365), owner_person_id TEXT REFERENCES people(id),
 effective_from TEXT NOT NULL, actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, reason TEXT NOT NULL
);
CREATE INDEX requirement_schedules_requirement ON requirement_schedules(requirement_id,effective_from);
CREATE TRIGGER requirement_schedules_immutable BEFORE UPDATE ON requirement_schedules BEGIN SELECT RAISE(ABORT,'immutable_schedule'); END;
CREATE TABLE receipt_effective_dates (receipt_id TEXT PRIMARY KEY REFERENCES receipts(id), effective_date TEXT NOT NULL);
CREATE TRIGGER receipt_effective_immutable BEFORE UPDATE ON receipt_effective_dates BEGIN SELECT RAISE(ABORT,'immutable_receipt'); END;
CREATE TRIGGER receipt_effective_retained BEFORE DELETE ON receipt_effective_dates BEGIN SELECT RAISE(ABORT,'immutable_receipt'); END;
CREATE TABLE renewal_overrides (id TEXT PRIMARY KEY, requirement_id TEXT NOT NULL REFERENCES requirements(id), cycle_due TEXT NOT NULL, due_date TEXT NOT NULL, reason TEXT NOT NULL, actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, at TEXT NOT NULL);

-- Durable follow-up sends (FOLLOWUP-001): one row per obligation, cycle and kind.
CREATE TABLE followups (
 id TEXT PRIMARY KEY, kind TEXT NOT NULL, subject_id TEXT NOT NULL, cycle_key TEXT NOT NULL, recipient TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('pending','accepted','failed','uncertain','skipped')), detail TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL, attempted_at TEXT, UNIQUE(kind,subject_id,cycle_key)
);
