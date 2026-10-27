// These core-registry tables first travel in portable v10 archives, never in
// the program-domain extension or the table gates of older archive versions.
// Consent, approvals, dated changes and delivery evidence travel in the portable archive.
// Bearer credentials and provider verification keys are installation-local. Restores
// require fresh owner grants and keys and the existing mail and shares capability reauthorization.
export const trustColumns = {
 trust_settings:['singleton','postal_address','notice_days','public_enabled','confirmations_enabled','updated_by','updated_name','updated_at'],
 trust_categories:['slug','name','created_by','created_at'],
 trust_subscribers:['id','email','created_at','unsubscribed_at'],
 trust_subscriptions:['subscriber_id','category','state','source','reason','confirmation_id','confirmed_at','updated_at'],
 trust_consent_events:['id','subscriber_id','category','action','source','reason','actor_id','actor_name','at'],
 trust_customer_grants:['id','subscriber_id','reason','approved_by','approved_name','approved_at','expires_at','revoked_at','revoked_by'],
 trust_updates:['id','category','title','body','visibility','drafted_by','drafted_name','drafted_at','approved_by','approved_name','approved_at','notification_approved','published_at','notification_started_at'],
 trust_grant_records:['grant_id','update_id','can_read','can_submit'],
 trust_submissions:['id','grant_id','update_id','body','submitted_at'],
 trust_subprocessor_changes:['id','update_id','subprocessor_id','action','name','purpose','data_categories','location','effective_on','notice_days','created_at'],
 trust_deliveries:['id','update_id','subscriber_id','kind','recipient','state','detail','provider','provider_message_id','queued_at','attempted_at','accepted_at','outcome_at','provider_event_at'],
 trust_delivery_events:['id','delivery_id','provider','event_id','fingerprint','conflict','state','detail','occurred_at','received_at'],
} as const
export const trustTables=Object.keys(trustColumns)
export const trustLocal = {
 trust_credentials:['id','kind','subject_id','token_hash','created_at','expires_at','used_at'],
 trust_mail_webhooks:['provider','secret_ciphertext','secret_iv','updated_by','updated_at'],
} as const
