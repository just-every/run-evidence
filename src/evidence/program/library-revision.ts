import type { Bindings } from '../../auth.server'
// LIBRARY-004: every installation starts at shipped library revision 1 and
// moves only when the owner accepts a later revision (library_acceptances).
export const acceptedLibraryRevision = async (env: Pick<Bindings, 'DB'>) => Number((await env.DB.prepare('SELECT MAX(revision) AS n FROM library_acceptances').first<{ n: number | null }>())?.n ?? 1)
