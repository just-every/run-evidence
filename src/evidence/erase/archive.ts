export const privacyColumns = {
 privacy_holds:['id','kind','subject_id','reason','authorized_by','authorized_name','review_on','created_at','released_at','released_by','release_reason'],
 privacy_requests:['id','kind','subject_id','snapshot_json','snapshot_hash','reason','requested_by','requested_name','requested_at','state','confirmed_at','completed_at','counts_json'],
 privacy_erased_exhibits:['exhibit_id','request_id','recorded_at'],
} as const
export const privacyTables = Object.keys(privacyColumns)
