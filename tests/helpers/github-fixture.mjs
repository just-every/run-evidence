// Network-edge fake of GitHub REST 2022-11-28; production reads and D1/R2 are real.
// Shapes: https://docs.github.com/en/rest/repos/repos#get-a-repository
// https://docs.github.com/en/rest/branches/branch-protection#get-branch-protection
export function githubFixture(apiBase = 'https://api.github.com') {
 const github = { tokens: new Set(['synthetic-evidence-1']), throttleUntil: 0, methods: [], requests: [], overrides: new Map(), hidden: new Set(), org: { login: 'northstar', two_factor_requirement_enabled: false }, repos: {
 'northstar/web': { private: true, protection: { reviews: 1, checks: ['ci'] }, dependabot: 0, secrets: 0 },
 'northstar/site': { private: false, protection: null, dependabot: 2, secrets: 0 },
 'northstar/tools': { private: true, protection: null, dependabot: 0, secrets: 0 },
} }
const reply = (status, body, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'x-ratelimit-remaining': '4999', ...headers } })
 async function outbound(request) {
 const url = new URL(request.url)
 if (url.origin !== apiBase) return null
 github.methods.push(request.method); github.requests.push(url.pathname + url.search)
 const override = github.overrides.get(url.pathname + url.search) ?? github.overrides.get(url.pathname)
 if (override) return reply(override.status ?? 200, override.body, override.headers)
 const now = Date.parse(github.clock)
 if (github.throttleUntil > now) return reply(403, { message: 'API rate limit exceeded' }, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(Math.floor(github.throttleUntil / 1000)) })
 if (!github.tokens.has((request.headers.get('authorization') ?? '').replace('Bearer ', ''))) return reply(401, { message: 'Bad credentials' })
 const path = url.pathname
 if (path === '/orgs/northstar/members') return reply(200, [])
 if (path === '/orgs/northstar') return reply(200, github.org)
 if (path === '/orgs/northstar/repos') {
  const names = Object.keys(github.repos), page = Number(url.searchParams.get('page') ?? 1), slice = names.slice((page - 1) * 2, page * 2)
  return reply(200, slice.map(full_name => ({ full_name })), page * 2 < names.length ? { link: `<${apiBase}/orgs/northstar/repos?per_page=100&type=all&page=${page + 1}>; rel="next"` } : {})
 }
 const match = /^\/repos\/(northstar\/[a-z]+)(\/.*)?$/.exec(path), repo = match && github.repos[match[1]]
 if (!repo || github.hidden.has(match[1])) return reply(404, { message: 'Not Found' })
 if (!match[2]) return reply(200, { full_name: match[1], private: repo.private, archived: false, default_branch: 'main' })
 if (match[2] === '/pulls' || match[2] === '/deployments') return reply(200, [])
 if (match[2] === '/branches/main/protection') return repo.protection ? reply(200, { required_pull_request_reviews: { required_approving_review_count: repo.protection.reviews }, required_status_checks: { contexts: repo.protection.checks }, enforce_admins: { enabled: true } }) : reply(404, { message: 'Branch not protected' })
 if (match[2] === '/dependabot/alerts') return reply(200, Array.from({ length: repo.dependabot }, (_, i) => ({ number: i + 1, state: 'open' })))
 if (match[2] === '/secret-scanning/alerts') return reply(200, Array.from({ length: repo.secrets }, (_, i) => ({ number: i + 1, state: 'open' })))
 return reply(404, { message: 'Not Found' })
}
 return { github, outbound }
}
