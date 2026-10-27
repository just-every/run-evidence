-- The dedicated reviewed workflow may redact actor labels, preserving every
-- opaque reference and action fact. Ordinary edits remain immutable.
DROP TRIGGER product_audit_no_update;
CREATE TRIGGER product_audit_no_update BEFORE UPDATE ON product_audit WHEN NOT (
 NEW.actor_name='Anonymous actor' AND NEW.id IS OLD.id AND NEW.actor_kind IS OLD.actor_kind AND NEW.actor_id IS OLD.actor_id AND NEW.action IS OLD.action AND NEW.subject IS OLD.subject AND NEW.outcome IS OLD.outcome AND NEW.detail IS OLD.detail AND NEW.at IS OLD.at AND NEW.reason IS OLD.reason AND NEW.revision IS OLD.revision AND EXISTS(
 SELECT 1 FROM privacy_requests p,json_each(p.snapshot_json,'$.profile.actor_ids') a
 WHERE p.kind='person' AND p.state IN ('pending','partial') AND json_extract(p.snapshot_json,'$.profile.action')='anonymize' AND a.value=OLD.actor_id
 )) BEGIN SELECT RAISE(ABORT,'immutable_audit'); END;
CREATE TRIGGER privacy_actor_label_insert AFTER INSERT ON product_audit
WHEN NEW.actor_name<>'Anonymous actor' AND EXISTS(
 SELECT 1 FROM privacy_requests p,json_each(p.snapshot_json,'$.profile.actor_ids') a
 WHERE p.kind='person' AND p.state IN ('pending','partial') AND json_extract(p.snapshot_json,'$.profile.action')='anonymize' AND a.value=NEW.actor_id
) BEGIN UPDATE product_audit SET actor_name='Anonymous actor' WHERE id=NEW.id; END;
