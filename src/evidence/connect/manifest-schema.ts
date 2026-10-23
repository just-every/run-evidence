export const codeManifestColumns = {
 code_manifest_grants: ['id','connection_id','sequence','decision','credential_binding','reason','actor_id','actor_name','at'],
 code_manifest_snapshots: ['id','connection_id','repository','source_revision','manifest_path','sha256','size','object_key','source_url','read_at','grant_id'],
} as const
export const codeManifestTables = Object.keys(codeManifestColumns)
