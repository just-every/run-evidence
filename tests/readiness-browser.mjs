// An independent installation keeps existing owner journeys' empty/start states intact.
process.env.EVIDENCE_BROWSER_CLAUSE = 'READINESS-001'
await import('./browser.mjs')
