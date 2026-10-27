-- An engagement hold follows every submitted exhibit. A pending erasure has
-- already fenced its bytes, so later holds and submissions cannot attach to it.
DROP TRIGGER privacy_hold_pending;
CREATE TRIGGER privacy_hold_pending BEFORE INSERT ON privacy_holds WHEN EXISTS(
 SELECT 1 FROM privacy_requests p WHERE p.state='pending' AND (
  NEW.kind='business' OR (p.kind=NEW.kind AND p.subject_id=NEW.subject_id) OR
  (NEW.kind='engagement' AND p.kind='exhibit' AND EXISTS(
   SELECT 1 FROM audit_submissions s JOIN audit_requests q ON q.id=s.request_id JOIN receipts r ON r.id=s.receipt_id
   WHERE q.engagement_id=NEW.subject_id AND r.exhibit_id=p.subject_id
  ))
 )
) BEGIN SELECT RAISE(ABORT,'erasure_already_confirmed'); END;
CREATE TRIGGER audit_submission_erasure_fence BEFORE INSERT ON audit_submissions WHEN NOT EXISTS(SELECT 1 FROM custody_admission) AND EXISTS(
 SELECT 1 FROM privacy_erased_exhibits e JOIN receipts r ON r.exhibit_id=e.exhibit_id WHERE r.id=NEW.receipt_id
) BEGIN SELECT RAISE(ABORT,'erasure_already_confirmed'); END;
