-- Engagement scope and submitted receipts classify exhibits for retention.
-- A closed engagement still retains these relationships and its active holds.
CREATE VIEW privacy_exhibit_engagements AS
 SELECT r.exhibit_id,s.engagement_id FROM receipts r
 JOIN requirements q ON q.id=r.requirement_id
 JOIN audit_scope s ON s.control_id=q.control_id
 UNION
 SELECT r.exhibit_id,q.engagement_id FROM receipts r
 JOIN audit_submissions s ON s.receipt_id=r.id
 JOIN audit_requests q ON q.id=s.request_id;

DROP TRIGGER privacy_hold_pending;
CREATE TRIGGER privacy_hold_pending BEFORE INSERT ON privacy_holds
 WHEN EXISTS(SELECT 1 FROM privacy_requests r WHERE r.state='pending' AND
  (NEW.kind='business' OR (r.kind=NEW.kind AND r.subject_id=NEW.subject_id) OR
   (NEW.kind='engagement' AND r.kind='exhibit' AND EXISTS
    (SELECT 1 FROM privacy_exhibit_engagements e WHERE e.exhibit_id=r.subject_id AND e.engagement_id=NEW.subject_id))))
 BEGIN SELECT RAISE(ABORT,'erasure_already_confirmed'); END;
