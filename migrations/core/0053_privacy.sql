-- Owner-reviewed holds and exact-snapshot erasure. The receipt tombstone keeps
-- opaque custody facts; no ordinary edit acquires this exception.
CREATE TABLE privacy_holds(id TEXT PRIMARY KEY,kind TEXT NOT NULL,subject_id TEXT NOT NULL,reason TEXT NOT NULL,authorized_by TEXT NOT NULL,authorized_name TEXT NOT NULL,review_on TEXT NOT NULL,created_at TEXT NOT NULL,released_at TEXT,released_by TEXT,release_reason TEXT);
CREATE TABLE privacy_requests(id TEXT PRIMARY KEY,kind TEXT NOT NULL,subject_id TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,reason TEXT NOT NULL,requested_by TEXT NOT NULL,requested_name TEXT NOT NULL,requested_at TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'preview',confirmed_at TEXT,completed_at TEXT,counts_json TEXT NOT NULL DEFAULT '{}');
CREATE TABLE privacy_erased_exhibits(exhibit_id TEXT PRIMARY KEY REFERENCES exhibits(id),request_id TEXT NOT NULL REFERENCES privacy_requests(id),recorded_at TEXT NOT NULL);
DROP TRIGGER exhibits_no_update;
CREATE TRIGGER exhibits_no_update BEFORE UPDATE ON exhibits WHEN NOT (EXISTS(SELECT 1 FROM privacy_erased_exhibits p JOIN privacy_requests r ON r.id=p.request_id WHERE p.exhibit_id=OLD.id AND r.state='pending') AND NEW.id=OLD.id AND NEW.object_key=OLD.object_key AND NEW.size=OLD.size AND NEW.filename='Erased exhibit' AND NEW.media_type='application/octet-stream') BEGIN SELECT RAISE(ABORT,'immutable_exhibit'); END;
DROP TRIGGER receipts_no_update;
CREATE TRIGGER receipts_no_update BEFORE UPDATE ON receipts WHEN NOT (EXISTS(SELECT 1 FROM privacy_erased_exhibits p JOIN privacy_requests r ON r.id=p.request_id WHERE p.exhibit_id=OLD.exhibit_id AND r.state='pending') AND NEW.id=OLD.id AND NEW.requirement_id=OLD.requirement_id AND NEW.exhibit_id=OLD.exhibit_id AND NEW.origin=OLD.origin AND NEW.source='Erased exhibit' AND NEW.covered_from=OLD.covered_from AND NEW.covered_to=OLD.covered_to AND NEW.added_by=OLD.added_by AND NEW.added_by_name=OLD.added_by_name AND NEW.added_at=OLD.added_at AND NEW.sha256=OLD.sha256 AND NEW.supersedes IS OLD.supersedes) BEGIN SELECT RAISE(ABORT,'immutable_receipt'); END;
CREATE TRIGGER privacy_hold_history BEFORE UPDATE ON privacy_holds WHEN OLD.released_at IS NOT NULL OR NEW.id<>OLD.id OR NEW.kind<>OLD.kind OR NEW.subject_id<>OLD.subject_id OR NEW.reason<>OLD.reason OR NEW.authorized_by<>OLD.authorized_by OR NEW.authorized_name<>OLD.authorized_name OR NEW.review_on<>OLD.review_on OR NEW.created_at<>OLD.created_at OR NEW.released_at IS NULL BEGIN SELECT RAISE(ABORT,'retained_privacy_hold'); END;
CREATE TRIGGER privacy_hold_retained BEFORE DELETE ON privacy_holds BEGIN SELECT RAISE(ABORT,'retained_privacy_hold'); END;
CREATE TRIGGER privacy_request_history BEFORE UPDATE ON privacy_requests WHEN NEW.id<>OLD.id OR NEW.kind<>OLD.kind OR NEW.subject_id<>OLD.subject_id OR NEW.snapshot_json<>OLD.snapshot_json OR NEW.snapshot_hash<>OLD.snapshot_hash OR NEW.reason<>OLD.reason OR NEW.requested_by<>OLD.requested_by OR NEW.requested_name<>OLD.requested_name OR NEW.requested_at<>OLD.requested_at OR OLD.state='complete' BEGIN SELECT RAISE(ABORT,'retained_privacy_request'); END;
CREATE TRIGGER privacy_request_retained BEFORE DELETE ON privacy_requests BEGIN SELECT RAISE(ABORT,'retained_privacy_request'); END;
CREATE TRIGGER privacy_tombstone_immutable BEFORE UPDATE ON privacy_erased_exhibits BEGIN SELECT RAISE(ABORT,'retained_erasure'); END;
CREATE TRIGGER privacy_tombstone_retained BEFORE DELETE ON privacy_erased_exhibits BEGIN SELECT RAISE(ABORT,'retained_erasure'); END;

CREATE TABLE privacy_guard(singleton INTEGER PRIMARY KEY CHECK(singleton=1),allowed INTEGER NOT NULL CHECK(allowed=1));
CREATE TRIGGER privacy_hold_pending BEFORE INSERT ON privacy_holds WHEN EXISTS(SELECT 1 FROM privacy_requests WHERE state='pending' AND (NEW.kind='business' OR (kind=NEW.kind AND subject_id=NEW.subject_id))) BEGIN SELECT RAISE(ABORT,'erasure_already_confirmed'); END;

CREATE TRIGGER generation_privacy_holds_insert AFTER INSERT ON privacy_holds BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
CREATE TRIGGER generation_privacy_holds_update AFTER UPDATE ON privacy_holds BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
CREATE TRIGGER generation_privacy_holds_delete AFTER DELETE ON privacy_holds BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
CREATE TRIGGER generation_privacy_requests_insert AFTER INSERT ON privacy_requests BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
CREATE TRIGGER generation_privacy_requests_update AFTER UPDATE ON privacy_requests BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
CREATE TRIGGER generation_privacy_requests_delete AFTER DELETE ON privacy_requests BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
CREATE TRIGGER generation_privacy_erased_exhibits_insert AFTER INSERT ON privacy_erased_exhibits BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
CREATE TRIGGER generation_privacy_erased_exhibits_update AFTER UPDATE ON privacy_erased_exhibits BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
CREATE TRIGGER generation_privacy_erased_exhibits_delete AFTER DELETE ON privacy_erased_exhibits BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
