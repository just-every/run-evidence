-- Classification is append-only so changing a label cannot bypass a hold.
CREATE TABLE privacy_exhibit_scopes (
 exhibit_id TEXT NOT NULL REFERENCES exhibits(id), kind TEXT NOT NULL CHECK(kind IN ('person','vendor','engagement')),
 subject_id TEXT NOT NULL, reason TEXT NOT NULL, classified_by TEXT NOT NULL, classified_name TEXT NOT NULL, classified_at TEXT NOT NULL,
 PRIMARY KEY(exhibit_id,kind,subject_id)
);
CREATE INDEX privacy_scope_subject ON privacy_exhibit_scopes(kind,subject_id);
CREATE TRIGGER privacy_scope_immutable BEFORE UPDATE ON privacy_exhibit_scopes BEGIN SELECT RAISE(ABORT,'retained_privacy_classification'); END;
CREATE TRIGGER privacy_scope_retained BEFORE DELETE ON privacy_exhibit_scopes BEGIN SELECT RAISE(ABORT,'retained_privacy_classification'); END;
CREATE TRIGGER privacy_scope_erasure_fence BEFORE INSERT ON privacy_exhibit_scopes
WHEN NOT EXISTS(SELECT 1 FROM custody_admission) AND EXISTS(SELECT 1 FROM privacy_erased_exhibits WHERE exhibit_id=NEW.exhibit_id)
BEGIN SELECT RAISE(ABORT,'erasure_already_confirmed'); END;
DROP TRIGGER privacy_hold_pending;
CREATE TRIGGER privacy_hold_pending BEFORE INSERT ON privacy_holds WHEN EXISTS(
 SELECT 1 FROM privacy_requests p WHERE p.state='pending' AND (
  NEW.kind='business' OR (p.kind=NEW.kind AND p.subject_id=NEW.subject_id) OR
  (p.kind='exhibit' AND EXISTS(SELECT 1 FROM privacy_exhibit_scopes s WHERE s.exhibit_id=p.subject_id AND s.kind=NEW.kind AND s.subject_id=NEW.subject_id)) OR
  (NEW.kind='engagement' AND p.kind='exhibit' AND EXISTS(
   SELECT 1 FROM privacy_exhibit_engagements e WHERE e.engagement_id=NEW.subject_id AND e.exhibit_id=p.subject_id
  ))
 )
) BEGIN SELECT RAISE(ABORT,'erasure_already_confirmed'); END;
CREATE TRIGGER generation_privacy_scope_insert AFTER INSERT ON privacy_exhibit_scopes BEGIN UPDATE portable_state SET generation=generation+1 WHERE singleton=1; END;
