// VENDOR-001 portable-archive tables, carried by the v10 archive. Older v10
// archives list none of them and restore with no diligence records. Supplier
// link digests never travel: a restored link is closed and cannot authenticate.
export const vendorColumns = {
 vendor_profiles:['vendor_id','website','service','contact_name','contact_email','data_types','region','annual_cost_usd','risk_tier','tier_basis','renewal_date','revision','updated_by','updated_at'],
 vendor_subprocessors:['id','vendor_id','name','purpose','region','added_by','added_at','removed_by','removed_at'],
 vendor_templates:['id','name','questions_json','created_by','created_at'],
 vendor_links:['id','vendor_id','contact_email','expires_at','created_by','created_at','closed_at','emailed_at'],
 vendor_link_events:['id','link_id','vendor_id','action','outcome','at'],
 vendor_requests:['id','vendor_id','kind','label','template_id','template_name','questions_json','due_date','created_by','created_at','closed_at','closed_reason','closed_by'],
 vendor_link_requests:['link_id','request_id'],
 vendor_documents:['id','vendor_id','request_id','kind','filename','media_type','size','sha256','object_key','origin','provided_by','link_id','effective_on','expires_on','supersedes','added_at','review_state','reviewed_by','reviewed_at','review_notes'],
 vendor_submissions:['id','request_id','link_id','respondent_name','respondent_email','submitted_at'],
 vendor_answers:['id','request_id','question_id','answer','comment','link_id','answered_at'],
 vendor_findings:['id','vendor_id','source_kind','source_ref','severity','title','detail','recorded_by','recorded_at','state','decision_reason','approver_person_id','decided_by','decided_at'],
 vendor_approvals:['id','vendor_id','decision','rationale','approver_person_id','conditions','condition_expires_on','reassess_by','exceptions_json','decided_by','decided_at','condition_closed_by','condition_closed_at','condition_closed_note'],
 vendor_assertions:['id','vendor_id','claim','source_url','recorded_by','recorded_at','verified_document_id','verified_by','verified_at'],
} as const
export const vendorTables = Object.keys(vendorColumns)

export const vendorReviewColumns = {vendor_bridge_letters:['document_id'],vendor_review_settings:['vendor_id','bridge_months'],vendor_document_reviews:['id','document_id','vendor_id','revision','snapshot_json','snapshot_hash','reason','proposed_by','proposed_at'],vendor_review_decisions:['review_id','snapshot_hash','decision','reviewer_person_id','actor_id','actor_name','reason','decided_at'],vendor_cuecs:['id','vendor_id','document_id','review_id','field_id','body','control_id','accepted_unaddressed','decided_at']} as const
export const vendorReviewTables=Object.keys(vendorReviewColumns)
