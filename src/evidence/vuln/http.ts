import {sourceFindings} from './source'
import { done, json, ownerRoutes, readInput, uuid, type Route } from '../door'
import { Refusal } from '../upload'
import { admit, attachRetest, decideRetest, finding, findings, markFixed, pentestRequirement, plan, population, populationColumns, readImport } from './storage'
import { dryRunPage, findingPage, vulnerabilitiesPage } from './view'
const id = `(${uuid})`
const both = (path: string) => new RegExp(`^/(?:app|api)${path}$`)
const cell = (v: unknown) => { const s = String(v ?? ''); return /[",\r\n]/.test(s) || /^[=+\-@]/.test(s) ? `"${(/^[=+\-@]/.test(s) ? "'" : '') + s.replaceAll('"', '""')}"` : s }
// VULN-002 owner doors: reviewed import, findings, retest-verified closure and the population export.
export function vulnHandler(clock: () => Date) {
 const routes: Route[] = [
  { method: 'GET', pattern: both('/vulnerabilities'), run: async c => {
   const list = await findings(c.env, c.now)
   if (c.isApi) return json({ findings: list, source_findings:await sourceFindings(c.env,c.now) })
   return vulnerabilitiesPage(list, await pentestRequirement(c.env), c.actor.name,await sourceFindings(c.env,c.now))
  } },
  {method:'GET',pattern:both('/vulnerabilities/source-findings'),run:async c=>json({findings:await sourceFindings(c.env,c.now)})},
  // Without confirm: a dry run that admits nothing. With confirm and both dry-run fingerprints: admit the valid rows.
  { method: 'POST', pattern: both('/vulnerabilities/import'), run: async c => {
   const upload = await readImport(c.request)
   if (upload.confirm) { const created = await admit(c.env, c.actor, upload, c.now); return done(c, '/app/vulnerabilities', created, 201) }
   const checked = plan(upload)
   if (c.isApi) return json({ dry_run: true, sha256: upload.sha256, report_sha256: upload.reportSha256, ...checked })
   return dryRunPage(checked, upload, c.actor.name)
  } },
  { method: 'GET', pattern: /^\/(?:app|api)\/vulnerabilities\/population\.csv$/, run: async c => {
   const rows = await population(c.env, c.now)
   return new Response([populationColumns.join(','), ...rows.map(r => populationColumns.map(k => cell(r[k])).join(','))].join('\r\n') + '\r\n', { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="vulnerability-remediation-population.csv"', 'cache-control': 'no-store' } })
  } },
  { method: 'GET', pattern: both(`/vulnerabilities/${id}`), run: async (c, m) => { const detail = await finding(c.env, m[1], c.now); return c.isApi ? json(detail) : findingPage(detail, c.actor.name) } },
  { method: 'POST', pattern: both(`/vulnerabilities/${id}/fixed`), run: async (c, m) => { const input = await readInput(c.request); return done(c, '/app/vulnerabilities/' + m[1], await markFixed(c.env, c.actor, m[1], String(input.note ?? '').trim().slice(0, 500), c.now)) } },
  { method: 'POST', pattern: both(`/vulnerabilities/${id}/retests`), run: async (c, m) => done(c, '/app/vulnerabilities/' + m[1], await attachRetest(c.env, c.actor, m[1], c.request, c.now), 201) },
  { method: 'POST', pattern: both(`/vulnerabilities/${id}/retests/${id}/decision`), run: async (c, m) => { const input = await readInput(c.request); return done(c, '/app/vulnerabilities/' + m[1], await decideRetest(c.env, c.actor, m[1], m[2], String(input.decision ?? ''), String(input.note ?? '').trim().slice(0, 500), c.now)) } },
  { method: 'GET', pattern: new RegExp(`^/app/vulnerabilities/${id}/retests/${id}/file$`), run: async (c, m) => {
   const doc = await c.env.DB.prepare('SELECT filename,sha256,size,object_key FROM vuln_documents WHERE id=? AND finding_id=?').bind(m[2], m[1]).first<{ filename: string; sha256: string; size: number; object_key: string }>()
   if (!doc) throw new Refusal('Retest evidence not found.', 404)
   const object = await c.env.EXHIBITS.get(doc.object_key), bytes = object ? new Uint8Array(await object.arrayBuffer()) : null
   const hash = bytes ? Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('') : ''
   if (!bytes || bytes.byteLength !== doc.size || hash !== doc.sha256) return json({ error: 'Unavailable bytes. The retest record is retained.' }, 410)
   return new Response(bytes, { headers: { 'content-type': 'application/octet-stream', 'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(doc.filename)}`, 'x-content-type-options': 'nosniff', 'cache-control': 'no-store', 'content-security-policy': "default-src 'none'; sandbox" } })
  } },
 ]
 return ownerRoutes(routes, clock)
}
