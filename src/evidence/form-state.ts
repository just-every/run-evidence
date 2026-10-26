import { auditStatement, type Input, type OwnerContext } from './door'
import { boundedBody, Refusal } from './upload'

export interface RefusedForm { values: Record<string, string>; error: string; status: number }
export const scalarValues = (input: Input | FormData): Record<string, string> => Object.fromEntries(
 (input instanceof FormData ? [...input.entries()] : Object.entries(input)).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
)
// Keep a bounded UI envelope so a refused file can still return its scalar fields.
// The upload operation continues to enforce its original file and request limits.
export async function retainedMultipart(request: Request, limit: number, originalLimit = limit) {
 if (!request.headers.get('content-type')?.startsWith('multipart/form-data;')) throw new Refusal('Use a file upload form.')
 const bytes = await boundedBody(request, limit)
 const form = await new Response(bytes, { headers: { 'content-type': request.headers.get('content-type')! } }).formData().catch(() => { throw bytes.byteLength > originalLimit ? new Refusal('Upload exceeds the size limit.', 413) : new Refusal('Invalid upload form.') })
 return { form, request: new Request(request, { body: bytes }) }
}
export async function auditFormRefusal(c: Pick<OwnerContext, 'env' | 'actor' | 'request' | 'url' | 'now'>, error: Refusal) {
 await auditStatement(c.env, c.actor, 'door.refused', `${c.request.method} ${c.url.pathname}`, c.now, 'refused', `${error.status}: ${error.message}`).run().catch(() => console.error('Evidence audit write failed'))
}
