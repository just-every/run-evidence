import {AsyncLocalStorage} from 'node:async_hooks'
const current=new AsyncLocalStorage<()=>Date>()
// Use the trusted server clock at completion, rather than reusing the dispatch
// snapshot as a receipt time. The clock is never supplied by provider payloads.
export const withCollectionClock=<T>(clock:()=>Date,work:()=>T):T=>current.getStore()?work():current.run(clock,work)
export const collectionReceiptTime=(fallback:Date)=>current.getStore()?.()??fallback
