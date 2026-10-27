// PROGRAM-003 portable-archive tables, carried by the v10 archive. Older v10
// archives list none of them and restore with no program documents.
export const documentColumns = {
 program_documents:['id','program_id','kind','owner_person_id','review_months','created_by','created_at'],
 program_document_revisions:['id','document_id','revision','origin','reason','inputs_json','owner_text_json','content_json','facts_json','facts_hash','actor_name','at'],
 program_document_approvals:['revision_id','document_id','approver_person_id','approved_by','approved_at','effective_date','review_due','note'],
 program_document_exhibits:['id','document_id','label','filename','media_type','size','sha256','object_key','uploaded_by','uploaded_at'],
 iso_internal_audits:['id','program_id','title','auditor_name','independence','scope','performed_on','summary','recorded_by','recorded_at'],
 iso_audit_findings:['id','audit_id','kind','ref','description','corrective_action','owner_person_id','due_date','state','closed_by','closed_at','closure_note','recorded_at'],
 iso_management_reviews:['id','program_id','held_on','attendees','inputs_json','decisions','actions_json','recorded_by','recorded_at'],
} as const
export const documentTables = Object.keys(documentColumns)
