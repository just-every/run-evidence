-- LOG-001. Every product audit entry carries the reason its actor entered and
-- the exact revision of its subject. Entries recorded before this migration
-- keep both empty; nothing rewrites a stored entry.
ALTER TABLE product_audit ADD COLUMN reason TEXT NOT NULL DEFAULT '';
ALTER TABLE product_audit ADD COLUMN revision TEXT NOT NULL DEFAULT '';
-- An uncertain delivery is resolved at most once (followup/resolve.ts).
CREATE UNIQUE INDEX product_audit_one_resolution ON product_audit(subject) WHERE action='followup.resolved';
