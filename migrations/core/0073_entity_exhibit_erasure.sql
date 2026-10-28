-- Entity requests retain held originals and erase only their reviewed exhibit set.
-- Admission tombstones serialize every affected original before storage deletion.
DROP TRIGGER privacy_hold_pending;
CREATE TRIGGER privacy_hold_pending BEFORE INSERT ON privacy_holds WHEN EXISTS(
 SELECT 1 FROM privacy_requests p WHERE p.state='pending' AND (
  NEW.kind='business' OR (p.kind=NEW.kind AND p.subject_id=NEW.subject_id) OR
  EXISTS(SELECT 1 FROM privacy_erased_exhibits e WHERE e.request_id=p.id AND (
   (NEW.kind='exhibit' AND NEW.subject_id=e.exhibit_id) OR
   EXISTS(SELECT 1 FROM privacy_exhibit_scopes s WHERE s.exhibit_id=e.exhibit_id AND s.kind=NEW.kind AND s.subject_id=NEW.subject_id) OR
   (NEW.kind='engagement' AND EXISTS(SELECT 1 FROM privacy_exhibit_engagements s WHERE s.exhibit_id=e.exhibit_id AND s.engagement_id=NEW.subject_id))
  ))
 )
) BEGIN SELECT RAISE(ABORT,'erasure_already_confirmed'); END;

DROP TRIGGER privacy_request_history;
CREATE TRIGGER privacy_request_history BEFORE UPDATE ON privacy_requests WHEN
 NEW.id<>OLD.id OR NEW.kind<>OLD.kind OR NEW.subject_id<>OLD.subject_id OR
 NEW.snapshot_json<>OLD.snapshot_json OR NEW.snapshot_hash<>OLD.snapshot_hash OR
 NEW.reason<>OLD.reason OR NEW.requested_by<>OLD.requested_by OR
 NEW.requested_name<>OLD.requested_name OR NEW.requested_at<>OLD.requested_at OR
 OLD.state IN ('complete','partial')
 BEGIN SELECT RAISE(ABORT,'retained_privacy_request'); END;
