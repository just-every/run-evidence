import { baseRow } from './relationships'
import { fail } from './format'
import { blobColumn,portableTables,registry,schema,quote,staged,type Store } from './registry'
export async function createStages(env:Store,id:string) {
 const statements=portableTables.map(t=>{
  let sql=schema[t].sql.replace(/^CREATE TABLE(?: IF NOT EXISTS)?\s+(?:"[^"]+"|\w+)/i,'CREATE TABLE '+staged(id,t))
  sql=sql.replace(/,\s*FOREIGN KEY\s*\([^)]*\)\s*REFERENCES\s*(?:"[^"]+"|\w+)\s*\([^)]*\)(?:\s+ON\s+(?:DELETE|UPDATE)\s+(?:CASCADE|RESTRICT|SET NULL|NO ACTION))*/gi,'')
  sql=sql.replace(/\s+REFERENCES\s*(?:"[^"]+"|\w+)\s*\([^)]*\)(?:\s+ON\s+(?:DELETE|UPDATE)\s+(?:CASCADE|RESTRICT|SET NULL|NO ACTION))*/gi,'')
  return env.DB.prepare(sql)
 })
 for(let i=0;i<statements.length;i+=20)await env.DB.batch(statements.slice(i,i+20))
}
export async function dropStages(env:Store,id:string) {for(let i=0;i<portableTables.length;i+=20)await env.DB.batch(portableTables.slice(i,i+20).map(t=>env.DB.prepare('DROP TABLE IF EXISTS '+staged(id,t))))}
// cols are the columns the archive's own registry lists for the table; staged
// columns it predates take their schema default.
export async function stageRows(env:Store,id:string,table:string,rows:unknown,cols:readonly string[]=registry[table]) {
 if(!Array.isArray(rows)||!rows.length||rows.length>128)fail('Invalid archive row page.')
 if(!cols)fail('Unknown archive table.')
 for(const row of rows){if(!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).length!==cols.length||cols.some(c=>!Object.hasOwn(row,c)))fail('Unaccounted archive columns.');baseRow(table,row);for(const c of cols){const v=row[c];if(v!==null&&typeof v!=='string'&&!(typeof v==='number'&&Number.isFinite(v)))fail('Invalid portable value.');if(blobColumn(table,c)&&v!==null&&(typeof v!=='string'||! /^(?:[0-9A-F]{2})*$/.test(v)))fail('Invalid portable BLOB encoding.')}}
 // D1's JSON expansion admits a bounded page in one statement. Blob values
 // use SQLite unhex, preserving NULL separately from the empty byte string.
 const expressions=cols.map(c=>{const v=`json_extract(value,'$.${c}')`;return blobColumn(table,c)?`unhex(${v})`:v})
 await env.DB.prepare(`INSERT INTO ${staged(id,table)}(${cols.map(quote).join(',')}) SELECT ${expressions.join(',')} FROM json_each(?)`).bind(JSON.stringify(rows)).run()
}
export async function validateForeignKeys(env:Store,id:string) {
 for(const table of portableTables){const groups=new Map<number,typeof schema[string]['foreignKeys']>();for(const f of schema[table].foreignKeys){const a=groups.get(f.id)??[];a.push(f);groups.set(f.id,a)}
  for(const keys of groups.values()){
   if(!registry[keys[0].table])fail('A portable record references installation-local identity.')
   const target=keys[0].table
   const joins=keys.map(k=>`p.${quote(k.to)} IS c.${quote(k.from)}`).join(' AND '),nonnull=keys.map(k=>`c.${quote(k.from)} IS NOT NULL`).join(' AND ')
   if(await env.DB.prepare(`SELECT 1 FROM ${staged(id,table)} c WHERE ${nonnull} AND NOT EXISTS(SELECT 1 FROM ${staged(id,target)} p WHERE ${joins}) LIMIT 1`).first())fail(`Invalid ${table} relationship.`)
  }
 }
}
