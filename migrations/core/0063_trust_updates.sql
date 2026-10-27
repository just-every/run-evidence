-- TRUST-003. Credentials are deliberately local; all consent and notice evidence is portable.
CREATE TABLE trust_settings (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1), postal_address TEXT NOT NULL,
 notice_days INTEGER NOT NULL CHECK(notice_days BETWEEN 0 AND 365),
 public_enabled INTEGER NOT NULL CHECK(public_enabled IN (0,1)),
 confirmations_enabled INTEGER NOT NULL CHECK(confirmations_enabled IN (0,1)),
 updated_by TEXT NOT NULL, updated_name TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE trust_categories (slug TEXT PRIMARY KEY,name TEXT NOT NULL,created_by TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE trust_subscribers (
 id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL,unsubscribed_at TEXT
);
CREATE TABLE trust_subscriptions (
 subscriber_id TEXT NOT NULL REFERENCES trust_subscribers(id),category TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('pending','active','unsubscribed')),
 source TEXT NOT NULL CHECK(source IN ('double-opt-in','owner-added','customer-grant')),
 reason TEXT NOT NULL,confirmation_id TEXT,confirmed_at TEXT,updated_at TEXT NOT NULL,
 PRIMARY KEY(subscriber_id,category)
);
CREATE TABLE trust_consent_events (
 id TEXT PRIMARY KEY,subscriber_id TEXT NOT NULL REFERENCES trust_subscribers(id),category TEXT,
 action TEXT NOT NULL,source TEXT NOT NULL,reason TEXT NOT NULL,
 actor_id TEXT NOT NULL,actor_name TEXT NOT NULL,at TEXT NOT NULL
);
CREATE TABLE trust_customer_grants (
 id TEXT PRIMARY KEY,subscriber_id TEXT NOT NULL REFERENCES trust_subscribers(id),
 reason TEXT NOT NULL,approved_by TEXT NOT NULL,approved_name TEXT NOT NULL,
 approved_at TEXT NOT NULL,expires_at TEXT NOT NULL,revoked_at TEXT,revoked_by TEXT
);
CREATE TABLE trust_updates (
 id TEXT PRIMARY KEY,category TEXT NOT NULL,title TEXT NOT NULL,body TEXT NOT NULL,
 visibility TEXT NOT NULL CHECK(visibility IN ('public','customers')),
 drafted_by TEXT NOT NULL,drafted_name TEXT NOT NULL,drafted_at TEXT NOT NULL,
 approved_by TEXT,approved_name TEXT,approved_at TEXT,
 notification_approved INTEGER NOT NULL DEFAULT 0 CHECK(notification_approved IN (0,1)),
 published_at TEXT,notification_started_at TEXT,
 CHECK((approved_by IS NULL AND approved_name IS NULL AND approved_at IS NULL) OR (approved_by IS NOT NULL AND approved_name IS NOT NULL AND approved_at IS NOT NULL)),
 CHECK(published_at IS NULL OR approved_at IS NOT NULL)
);
CREATE TABLE trust_subprocessor_changes (
 id TEXT PRIMARY KEY,update_id TEXT NOT NULL UNIQUE REFERENCES trust_updates(id),
 subprocessor_id TEXT NOT NULL,action TEXT NOT NULL CHECK(action IN ('add','change','remove')),
 name TEXT NOT NULL,purpose TEXT NOT NULL,data_categories TEXT NOT NULL,location TEXT NOT NULL,
 effective_on TEXT NOT NULL,notice_days INTEGER NOT NULL CHECK(notice_days BETWEEN 0 AND 365),created_at TEXT NOT NULL
);
CREATE TABLE trust_deliveries (
 id TEXT PRIMARY KEY,update_id TEXT REFERENCES trust_updates(id),subscriber_id TEXT NOT NULL REFERENCES trust_subscribers(id),
 kind TEXT NOT NULL CHECK(kind IN ('confirmation','update')),recipient TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('pending','delivered','bounced','failed','uncertain')),
 detail TEXT NOT NULL,provider TEXT NOT NULL,provider_message_id TEXT,
 queued_at TEXT NOT NULL,attempted_at TEXT,accepted_at TEXT,outcome_at TEXT,provider_event_at INTEGER,
 UNIQUE(update_id,subscriber_id)
);
CREATE INDEX trust_delivery_queue ON trust_deliveries(state,attempted_at,queued_at);
CREATE INDEX trust_delivery_provider ON trust_deliveries(provider,provider_message_id,recipient);
CREATE TABLE trust_delivery_events (
 id TEXT PRIMARY KEY,delivery_id TEXT NOT NULL REFERENCES trust_deliveries(id),provider TEXT NOT NULL,
 event_id TEXT NOT NULL,fingerprint TEXT NOT NULL,conflict INTEGER NOT NULL DEFAULT 0 CHECK(conflict=0),
 state TEXT NOT NULL CHECK(state IN ('pending','delivered','bounced','failed','uncertain')),
 detail TEXT NOT NULL,occurred_at INTEGER NOT NULL,received_at TEXT NOT NULL,
 UNIQUE(provider,event_id,delivery_id)
);
CREATE TABLE trust_credentials (
 id TEXT PRIMARY KEY,kind TEXT NOT NULL CHECK(kind IN ('confirmation','unsubscribe','customer')),
 subject_id TEXT NOT NULL,token_hash TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL,expires_at TEXT,used_at TEXT
);
CREATE TRIGGER trust_consents_immutable BEFORE UPDATE ON trust_consent_events BEGIN SELECT RAISE(ABORT,'immutable_trust_consent'); END;
CREATE TRIGGER trust_delivery_events_immutable BEFORE UPDATE ON trust_delivery_events WHEN NEW.conflict=0 BEGIN SELECT RAISE(ABORT,'immutable_trust_delivery_event'); END;
CREATE TRIGGER trust_update_content_approved BEFORE UPDATE OF category,title,body,visibility,drafted_by,drafted_name,drafted_at ON trust_updates WHEN OLD.approved_at IS NOT NULL BEGIN SELECT RAISE(ABORT,'approved_trust_content'); END;
CREATE TRIGGER trust_change_immutable BEFORE UPDATE ON trust_subprocessor_changes BEGIN SELECT RAISE(ABORT,'immutable_trust_change'); END;
CREATE TABLE trust_mail_webhooks (
 provider TEXT PRIMARY KEY CHECK(provider IN ('resend','sendgrid')),
 secret_ciphertext TEXT NOT NULL,secret_iv TEXT NOT NULL,updated_by TEXT NOT NULL,updated_at TEXT NOT NULL
);
