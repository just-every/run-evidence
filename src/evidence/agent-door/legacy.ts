import type { Bindings } from '../../auth.server'
import type { TokenGrant } from '../agent/types'
import { evidenceDoor } from './index'
import { scopes, specialist } from './native'

// Existing native CLI credentials retain their three narrow operations. Their
// HTTP compatibility door enters the same policy, pause, approval and audit path.
export async function invokeLegacy(env: Bindings, token: TokenGrant, name: string, args: Record<string, unknown>, clock: () => Date) {
 return evidenceDoor(env, clock).invoke(name, args, { person: { id: token.created_by }, agent: { id: token.id, name: token.label, specialist }, clientId: token.id, scopes: [...scopes] })
}
