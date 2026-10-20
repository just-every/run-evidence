import { json, ownerRoutes } from '../door'
import { operationOutcomes } from './outcomes'
// No new authority: this read uses the same owner/origin door as product audit.
export const operationsHandler = (clock: () => Date) => ownerRoutes([
 { method: 'GET', pattern: /^\/api\/operations$/, run: async c => json(await operationOutcomes(c.env)) },
], clock)
