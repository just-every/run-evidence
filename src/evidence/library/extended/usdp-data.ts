// US Data Privacy (USDP): the comprehensive state privacy laws enacted as of 22 October 2026, their effective dates and applicability thresholds, and the
// consolidated obligations they share. Citations name each state's act; counsel confirms section-level citations and which states apply.
export interface Figures { annual_revenue_usd: number; small_business: boolean; sale_revenue_percent: number; sensitive_data: boolean; consumers: Record<string, number> }
export interface StateLaw { code: string; name: string; act: string; effective: string; threshold: string; applies: (f: Figures, consumers: number) => boolean }
const n = (v: number) => v.toLocaleString('en-US')
// Consumers whose personal data the business processes in the state (or buys, sells or shares, where the state counts those); sale revenue percent is the share of gross revenue from selling personal data.
const either = (consumers: number, saleConsumers: number, pct: number, strict: boolean) => ({ text: `${n(consumers)} consumers, or ${n(saleConsumers)} consumers and ${strict ? 'more than' : 'at least'} ${pct}% of gross revenue from selling personal data`, test: (f: Figures, c: number) => c >= consumers || (c >= saleConsumers && (strict ? f.sale_revenue_percent > pct : f.sale_revenue_percent >= pct)) })
const anySale = (consumers: number, saleConsumers: number) => ({ text: `${n(consumers)} consumers, or ${n(saleConsumers)} consumers and any revenue from selling personal data`, test: (f: Figures, c: number) => c >= consumers || (c >= saleConsumers && f.sale_revenue_percent > 0) })
const law = (code: string, name: string, act: string, effective: string, t: { text: string; test: (f: Figures, c: number) => boolean }, doing = true): StateLaw => ({ code, name, act, effective, threshold: t.text + (doing ? '' : ''), applies: (f, c) => c > 0 && t.test(f, c) })
export const states: StateLaw[] = [
 law('CA', 'California', 'California Consumer Privacy Act, Cal. Civ. Code § 1798.100 et seq., as amended by the CPRA', '2020-01-01', { text: '$26,625,000 annual gross revenue (as adjusted for 2025), or 100,000 consumers or households, or 50% of revenue from selling or sharing personal information', test: (f, c) => f.annual_revenue_usd > 26_625_000 || c >= 100_000 || f.sale_revenue_percent >= 50 }),
 law('VA', 'Virginia', 'Virginia Consumer Data Protection Act, Va. Code § 59.1-575 et seq.', '2023-01-01', either(100_000, 25_000, 50, true)),
 law('CO', 'Colorado', 'Colorado Privacy Act, C.R.S. § 6-1-1301 et seq.', '2023-07-01', anySale(100_000, 25_000)),
 law('CT', 'Connecticut', 'Connecticut Data Privacy Act, Conn. Gen. Stat. § 42-515 et seq.', '2023-07-01', either(100_000, 25_000, 25, true)),
 law('UT', 'Utah', 'Utah Consumer Privacy Act, Utah Code § 13-61-101 et seq.', '2023-12-31', { text: '$25,000,000 annual revenue and either 100,000 consumers, or 25,000 consumers and more than 50% of gross revenue from selling personal data', test: (f, c) => f.annual_revenue_usd >= 25_000_000 && (c >= 100_000 || (c >= 25_000 && f.sale_revenue_percent > 50)) }),
 law('TX', 'Texas', 'Texas Data Privacy and Security Act, Tex. Bus. & Com. Code ch. 541', '2024-07-01', { text: 'no numeric threshold: doing business in Texas, processing or selling personal data, and not a small business as defined by the SBA', test: f => !f.small_business }),
 law('OR', 'Oregon', 'Oregon Consumer Privacy Act, ORS 646A.570 to 646A.589', '2024-07-01', either(100_000, 25_000, 25, false)),
 law('MT', 'Montana', 'Montana Consumer Data Privacy Act, Mont. Code Ann. § 30-14-2801 et seq.', '2024-10-01', either(50_000, 25_000, 25, false)),
 law('IA', 'Iowa', 'Iowa Consumer Data Protection Act, Iowa Code ch. 715D', '2025-01-01', either(100_000, 25_000, 50, true)),
 law('DE', 'Delaware', 'Delaware Personal Data Privacy Act, 6 Del. C. ch. 12D', '2025-01-01', either(35_000, 10_000, 20, true)),
 law('NH', 'New Hampshire', 'New Hampshire privacy law, RSA 507-H', '2025-01-01', either(35_000, 10_000, 25, false)),
 law('NJ', 'New Jersey', 'New Jersey Data Privacy Act, N.J.S.A. 56:8-166.4 et seq.', '2025-01-15', anySale(100_000, 25_000)),
 law('NE', 'Nebraska', 'Nebraska Data Privacy Act, Neb. Rev. Stat. § 87-1101 et seq.', '2025-01-01', { text: 'no numeric threshold: doing business in Nebraska, processing or selling personal data, and not a small business as defined by the SBA', test: f => !f.small_business }),
 law('TN', 'Tennessee', 'Tennessee Information Protection Act, Tenn. Code Ann. § 47-18-3301 et seq.', '2025-07-01', { text: '$25,000,000 annual revenue and either 175,000 consumers, or 25,000 consumers and more than 50% of gross revenue from selling personal data', test: (f, c) => f.annual_revenue_usd > 25_000_000 && (c >= 175_000 || (c >= 25_000 && f.sale_revenue_percent > 50)) }),
 law('MN', 'Minnesota', 'Minnesota Consumer Data Privacy Act, Minn. Stat. ch. 325M', '2025-07-31', either(100_000, 25_000, 25, true)),
 law('MD', 'Maryland', 'Maryland Online Data Privacy Act, Md. Code, Com. Law § 14-4601 et seq.', '2025-10-01', either(35_000, 10_000, 20, true)),
 law('IN', 'Indiana', 'Indiana Consumer Data Protection Act, Ind. Code art. 24-15', '2026-01-01', either(100_000, 25_000, 50, true)),
 law('KY', 'Kentucky', 'Kentucky Consumer Data Protection Act, Ky. Rev. Stat. § 367.3611 et seq.', '2026-01-01', either(100_000, 25_000, 50, true)),
 law('RI', 'Rhode Island', 'Rhode Island Data Transparency and Privacy Protection Act, R.I. Gen. Laws § 6-48.1-1 et seq.', '2026-01-01', either(35_000, 10_000, 20, true)),
]
// Revision 4 of the library carries Connecticut's SB 1295 amendment (effective 1 July 2026). An installation evaluates the thresholds of its accepted library revision.
const amended = new Map<number, StateLaw[]>([[4, [law('CT', 'Connecticut', 'Connecticut Data Privacy Act, Conn. Gen. Stat. § 42-515 et seq., as amended by SB 1295 (effective 1 July 2026)', '2023-07-01', { text: '35,000 consumers, or processing sensitive data, or selling personal data', test: (f, c) => c >= 35_000 || f.sensitive_data || f.sale_revenue_percent > 0 })]]])
export const statesAt = (revision: number): StateLaw[] => states.map(s => [...amended].filter(([r]) => r <= revision).flatMap(([, laws]) => laws).findLast(l => l.code === s.code) ?? s)
// The consolidated control set: one obligation per row, generated for each state that applies and imposes it.
const all = states.map(s => s.code)
const without = (...codes: string[]) => all.filter(c => !codes.includes(c))
export const obligations: { id: string; title: string; states: string[]; control: string[] }[] = [
 { id: 'NOTICE', title: 'Privacy notice describing categories, purposes, rights and recipients', states: all, control: ['PRV-01'] },
 { id: 'ACCESS', title: 'Right to know and access personal data', states: all, control: ['PRV-02'] },
 { id: 'DELETE', title: 'Right to delete personal data', states: all, control: ['PRV-02'] },
 { id: 'CORRECT', title: 'Right to correct inaccurate personal data', states: without('UT', 'IA'), control: ['PRV-02'] },
 { id: 'PORTABILITY', title: 'Right to a portable copy of personal data', states: all, control: ['PRV-02'] },
 { id: 'OPTOUT-SALE', title: 'Opt out of the sale of personal data', states: all, control: ['PRV-03'] },
 { id: 'OPTOUT-TARGETED', title: 'Opt out of targeted advertising and cross-context sharing', states: all, control: ['PRV-03'] },
 { id: 'OPTOUT-PROFILING', title: 'Opt out of profiling in decisions with legal or similarly significant effects', states: without('UT', 'IA'), control: ['PRV-12'] },
 { id: 'SENSITIVE', title: 'Sensitive data: consent, or notice and the right to limit', states: all, control: ['PRV-04'] },
 { id: 'UOOS', title: 'Honor universal opt-out signals', states: ['CA', 'CO', 'CT', 'TX', 'OR', 'MT', 'DE', 'NH', 'NJ', 'NE', 'MN', 'MD'], control: ['PRV-03'] },
 { id: 'ASSESSMENT', title: 'Data protection assessments for high-risk processing', states: without('UT', 'IA'), control: ['PRV-05'] },
 { id: 'MINIMIZE', title: 'Data minimization, purpose limitation and retention', states: without('UT'), control: ['PRV-07'] },
 { id: 'PROCESSOR', title: 'Contracts with processors that bind them to instructions and safeguards', states: all, control: ['PRV-08'] },
 { id: 'NONDISCRIMINATION', title: 'No retaliation for exercising privacy rights', states: all, control: ['PRV-13'] },
 { id: 'APPEAL', title: 'Appeal of a denied rights request', states: without('CA', 'UT', 'IA'), control: ['PRV-09'] },
 { id: 'CHILDREN', title: 'Children\'s and teens\' personal data protections', states: all, control: ['PRV-04'] },
 { id: 'SECURITY', title: 'Reasonable data security practices', states: all, control: ['DAT-02', 'DAT-03', 'AC-01'] },
]
