import type {Bindings} from '../../auth.server'
import type {Method} from './storage'
export const shippedMethod: Method = { revision: 1, scale: 5, likelihood_labels: ['Rare', 'Unlikely', 'Possible', 'Likely', 'Almost certain'], impact_labels: ['Negligible', 'Minor', 'Moderate', 'Major', 'Severe'], likelihood_definitions: ['Exceptional circumstances', 'Not expected in normal operations', 'Could occur in normal operations', 'Expected without additional safeguards', 'Repeated or imminent'], impact_definitions: ['Minimal disruption', 'Limited recoverable disruption', 'Material service or data impact', 'Major business or sensitive-data impact', 'Severe business-wide harm'], formula: 'product', matrix: [], thresholds: [{ level: 'Low', max: 4 }, { level: 'Medium', max: 9 }, { level: 'High', max: 16 }, { level: 'Critical', max: 25 }] }

// Capture the exact implicit default before its first assessment. Legacy archives
// and upgrades never had definitions, so they explicitly retain an empty list.
export function retainDefaultMethod(env: Pick<Bindings, 'DB'>, recorded = true) {
 const m = shippedMethod
 return env.DB.prepare('INSERT OR IGNORE INTO risk_methods(id,revision,scale,likelihood_labels,impact_labels,formula,matrix_json,thresholds_json,actor_name,at,likelihood_definitions,impact_definitions) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind('shipped-method-1',m.revision,m.scale,JSON.stringify(m.likelihood_labels),JSON.stringify(m.impact_labels),m.formula,JSON.stringify(m.matrix),JSON.stringify(m.thresholds),'Evidence (shipped default)','',JSON.stringify(recorded ? m.likelihood_definitions : []),JSON.stringify(recorded ? m.impact_definitions : []))
}
