-- Retain custody imports, but fence new submissions once erasure is confirmed.
CREATE TRIGGER audit_submission_erasure_fence BEFORE INSERT ON audit_submissions WHEN NOT EXISTS(SELECT 1 FROM custody_admission) AND EXISTS(
 SELECT 1 FROM privacy_erased_exhibits e JOIN receipts r ON r.exhibit_id=e.exhibit_id WHERE r.id=NEW.receipt_id
) BEGIN SELECT RAISE(ABORT,'erasure_already_confirmed'); END;
