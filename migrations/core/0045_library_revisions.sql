-- LIBRARY-001. The owner's acceptance of each later shipped library revision,
-- and the library revision every test run was evaluated under. Both are
-- append-only. Runs recorded before this migration were evaluated under
-- revision 1, the only revision shipped until then.
CREATE TABLE library_acceptances (
 id TEXT PRIMARY KEY, revision INTEGER NOT NULL UNIQUE CHECK(revision > 1), from_revision INTEGER NOT NULL CHECK(from_revision >= 1 AND from_revision < revision),
 changes_json TEXT NOT NULL, actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, reason TEXT NOT NULL, at TEXT NOT NULL
);
CREATE TRIGGER library_acceptances_immutable BEFORE UPDATE ON library_acceptances BEGIN SELECT RAISE(ABORT,'immutable_library_acceptance'); END;
CREATE TRIGGER library_acceptances_retained BEFORE DELETE ON library_acceptances BEGIN SELECT RAISE(ABORT,'immutable_library_acceptance'); END;
CREATE TABLE run_library_revisions (
 run_id TEXT PRIMARY KEY REFERENCES test_runs(id), library_revision INTEGER NOT NULL CHECK(library_revision >= 1)
);
INSERT INTO run_library_revisions(run_id,library_revision) SELECT id,1 FROM test_runs;
CREATE TRIGGER run_library_revisions_immutable BEFORE UPDATE ON run_library_revisions BEGIN SELECT RAISE(ABORT,'immutable_run_library_revision'); END;
CREATE TRIGGER run_library_revisions_retained BEFORE DELETE ON run_library_revisions BEGIN SELECT RAISE(ABORT,'immutable_run_library_revision'); END;
CREATE TRIGGER portable_generation_library_acceptances_insert AFTER INSERT ON library_acceptances BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
CREATE TRIGGER portable_generation_library_acceptances_update AFTER UPDATE ON library_acceptances BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
CREATE TRIGGER portable_generation_library_acceptances_delete AFTER DELETE ON library_acceptances BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
CREATE TRIGGER portable_generation_run_library_revisions_insert AFTER INSERT ON run_library_revisions BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
CREATE TRIGGER portable_generation_run_library_revisions_update AFTER UPDATE ON run_library_revisions BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
CREATE TRIGGER portable_generation_run_library_revisions_delete AFTER DELETE ON run_library_revisions BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
