import type { Bindings } from '../../auth.server'
import { Refusal } from '../upload'
import { auditStatement, oneOf, text, type Actor, type Input } from '../door'
export interface Person { id: string; name: string; email: string; kind: string; created_at: string }
export const personKinds = ['employee','contractor','auditor','other'] as const
export const people = async (env: Bindings) => (await env.DB.prepare('SELECT id,name,email,kind,created_at FROM people ORDER BY name,id').all<Person>()).results
export const person = (env: Bindings, id: string) => env.DB.prepare('SELECT id,name,email,kind,created_at FROM people WHERE id=?').bind(id).first<Person>()
export async function requirePerson(env: Bindings, id: unknown, label = 'person') {
 if (typeof id !== 'string' || !id) throw new Refusal(`Choose a ${label} from People.`)
 const found = await person(env, id); if (!found || found.email===id+'@erased.invalid') throw new Refusal(`Choose a ${label} from People.`)
 return found
}
export async function addPerson(env: Bindings, actor: Actor, input: Input, now: Date) {
 const name = text(input, 'name', 200), email = text(input, 'email', 254).toLowerCase(), kind = oneOf(input, 'kind', personKinds)
 if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Refusal('Enter a real email address.')
 if (await env.DB.prepare('SELECT 1 FROM people WHERE email=?').bind(email).first()) throw new Refusal('That email already belongs to a person.', 409)
 const id = crypto.randomUUID(), role = text(input, 'role', 60, true).toLowerCase() || null
 await env.DB.batch([
  env.DB.prepare('INSERT INTO people(id,name,email,kind,created_at,created_by,role) VALUES(?,?,?,?,?,?,?)').bind(id, name, email, kind, now.toISOString(), actor.id, role),
  auditStatement(env, actor, 'person.added', 'person:' + id, now),
 ])
 return { id, name, email, kind, role }
}
