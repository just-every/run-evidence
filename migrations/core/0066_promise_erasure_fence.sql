-- A concurrent erasure admission cannot acquire new source derivatives.
CREATE TRIGGER promise_dependency_erasure_fence BEFORE INSERT ON promise_dependencies
WHEN json_extract(NEW.source_json,'$.kind')='exhibit' AND EXISTS(
 SELECT 1 FROM privacy_erased_exhibits e JOIN receipts r ON r.exhibit_id=e.exhibit_id
 WHERE r.id=json_extract(NEW.source_json,'$.source_id')
)
BEGIN SELECT RAISE(ABORT,'promise_exhibit_erasure_fenced'); END;
CREATE TRIGGER questionnaire_source_erasure_fence BEFORE INSERT ON questionnaire_sources
WHEN NEW.kind='exhibit' AND EXISTS(
 SELECT 1 FROM privacy_erased_exhibits e JOIN receipts r ON r.exhibit_id=e.exhibit_id
 WHERE r.id=NEW.source_id
)
BEGIN SELECT RAISE(ABORT,'promise_exhibit_erasure_fenced'); END;
