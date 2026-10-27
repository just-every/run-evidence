import { frameworks, frameworkIds } from '../library'
import { escape } from '../view'
import type { RefusedForm } from '../form-state'

export function mappingForm(control: string, selected: string, refused?: RefusedForm) {
 const choices = frameworkIds.flatMap(framework => frameworks[framework].editions.map(edition => ({ framework, edition, key: framework + '|' + edition.id })))
 const requested = refused ? refused.values.framework + '|' + refused.values.edition : selected
 const chosen = choices.find(c => c.key === requested) ?? choices[0]
 const target = `/app/controls/${control}`, pick = chosen.edition.requirements.find(r => r.ref === refused?.values.ref)?.ref
 return `<form method="get" action="${target}#control-mappings"><label>Framework and edition<select name="mapping_edition" aria-label="Framework and edition">${choices.map(c => `<option value="${escape(c.key)}"${c.key === chosen.key ? ' selected' : ''}>${escape(frameworks[c.framework].name + ' · ' + c.edition.label)}</option>`).join('')}</select></label><button class="button-secondary">Choose edition</button></form><form method="post" action="${target}/mappings">${refused ? `<p role="alert">${escape(refused.error)} Entered edition: ${escape(refused.values.edition)}. Entered reference: ${escape(refused.values.ref)}.${choices.some(c => c.key === requested) ? '' : ' The entered edition is unavailable; choose a shipped edition above.'}</p>` : ''}<input type="hidden" name="framework" value="${chosen.framework}"><input type="hidden" name="edition" value="${escape(chosen.edition.id)}"><p>${escape(frameworks[chosen.framework].name + ' · ' + chosen.edition.label)}</p><label>Requirement reference<select name="ref" required aria-label="Requirement reference">${chosen.edition.requirements.map(r => `<option value="${escape(r.ref)}"${pick === r.ref ? ' selected' : ''}>${escape(r.ref + ' · ' + r.title)}</option>`).join('')}</select></label><label>Reason<input name="reason" required maxlength="500" value="${escape(refused?.values.reason ?? '')}"></label><button>Add custom mapping</button></form>`
}
