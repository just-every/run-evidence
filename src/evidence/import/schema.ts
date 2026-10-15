import { d1Schema } from './base/d1/database'
import { d1ErasureSchema } from './base/d1/erasure-schema'
import { d1StreamOriginSchema } from './base/d1/stream-origin'
import { d1StagingSchema } from './base/d1/staging-schema'
import { d1NativeStagingSchema } from './base/d1/native-staging-schema'
import { d1CustodyStateSchema } from './base/d1/custody-state-schema'
import { d1ReversalFenceSchema } from './base/d1/reversal-fence-schema'
import { d1PreparationSchema } from './base/d1/preparation-schema'
import { d1RetirementSchema } from './base/d1/retirement-schema'
export const importSchemaStatements = [...d1Schema,...d1ErasureSchema,...d1StreamOriginSchema,...d1StagingSchema,...d1NativeStagingSchema,...d1CustodyStateSchema,...d1ReversalFenceSchema,...d1PreparationSchema,...d1RetirementSchema]
// Schema arrays include additive DROP/recreate evolution. Retain only the final
// live definition, once per name, as SQLite sees after migration application.
const triggers=new Map<string,{name:string;sql:string}>()
for(const sql of importSchemaStatements){
 const create=/^CREATE TRIGGER(?: IF NOT EXISTS)?\s+(\w+)/i.exec(sql.trim())
 const drop=/^DROP TRIGGER(?: IF EXISTS)?\s+(\w+)/i.exec(sql.trim())
 if(drop)triggers.delete(drop[1])
 if(create&&!triggers.has(create[1]))triggers.set(create[1],{name:create[1],sql})
}
export const importRestoreTriggers=[...triggers.values()]
