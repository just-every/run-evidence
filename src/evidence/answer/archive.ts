export const answerColumns={
 questionnaires:['id','program_id','name','filename','media_type','size','sha256','object_key','format','mapping_json','questions_json','created_by','created_at'],
 questionnaire_sources:['id','kind','source_id','quote','registered_by','registered_at'],
 questionnaire_drafts:['id','questionnaire_id','revision','snapshot_json','snapshot_hash','created_by','created_at'],
 questionnaire_approvals:['draft_id','snapshot_hash','reviewer_person_id','recipient','expires_on','reason','approved_by','approved_at'],
} as const
export const answerTables=Object.keys(answerColumns)
