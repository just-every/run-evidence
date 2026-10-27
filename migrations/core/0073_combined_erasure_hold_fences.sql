-- Preserve engagement control scope while adding explicit entity classifications.
DROP TRIGGER privacy_hold_pending;
CREATE TRIGGER privacy_hold_pending BEFORE INSERT ON privacy_holds WHEN EXISTS(
 SELECT 1 FROM privacy_requests p WHERE p.state='pending' AND (
  NEW.kind='business' OR (p.kind=NEW.kind AND p.subject_id=NEW.subject_id) OR
  (p.kind='exhibit' AND EXISTS(SELECT 1 FROM privacy_exhibit_scopes s WHERE s.exhibit_id=p.subject_id AND s.kind=NEW.kind AND s.subject_id=NEW.subject_id)) OR
  (NEW.kind='engagement' AND p.kind='exhibit' AND EXISTS(SELECT 1 FROM privacy_exhibit_engagements e WHERE e.exhibit_id=p.subject_id AND e.engagement_id=NEW.subject_id))
 )
) BEGIN SELECT RAISE(ABORT,'erasure_already_confirmed'); END;
CREATE TRIGGER IF NOT EXISTS audit_submission_erasure_fence BEFORE INSERT ON audit_submissions WHEN NOT EXISTS(SELECT 1 FROM custody_admission) AND EXISTS(
 SELECT 1 FROM privacy_erased_exhibits e JOIN receipts r ON r.exhibit_id=e.exhibit_id WHERE r.id=NEW.receipt_id
) BEGIN SELECT RAISE(ABORT,'erasure_already_confirmed'); END;
