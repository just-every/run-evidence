import { execFile } from 'node:child_process'
import { realpath } from 'node:fs/promises'
import { promisify } from 'node:util'

const execute = promisify(execFile)

// Ignore inherited repository/config overrides and never give Git the bearer.
function gitEnvironment() {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    !key.startsWith('GIT_') && key !== 'EVIDENCE_COLLECTOR_TOKEN'))
  return {
    ...env,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_OPTIONAL_LOCKS: '0',
    GIT_TERMINAL_PROMPT: '0',
    GIT_NO_LAZY_FETCH: '1',
    GIT_NO_REPLACE_OBJECTS: '1',
  }
}

export async function collectGit(repository) {
  try {
    const cwd = await realpath(repository)
    const options = { cwd, env: gitEnvironment(), encoding: 'utf8', timeout: 15000, maxBuffer: 8 * 1024 * 1024 }
    const git = async (args) => (await execute('git', [
      '--no-pager', '--no-optional-locks', '-c', 'core.fsmonitor=false',
      '-c', 'core.hooksPath=/dev/null', '-c', 'protocol.allow=never', ...args,
    ], options)).stdout.trimEnd()

    const bareValue = await git(['rev-parse', '--is-bare-repository'])
    if (!['true', 'false'].includes(bareValue)) throw new Error()
    const bare = bareValue === 'true'
    // A mistaken directory must not silently observe a parent repository.
    const root = await git(bare
      ? ['rev-parse', '--absolute-git-dir']
      : ['rev-parse', '--show-toplevel'])
    if (await realpath(root) !== cwd) throw new Error()

    const refs = await git(['for-each-ref', '--format=%(objectname)%00%(objecttype)%00%(refname)', 'refs/heads/'])
    const branches = refs ? refs.split('\n').map((line) => {
      const [sha, type, ref, extra] = line.split('\0')
      if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(sha) || type !== 'commit' || !ref?.startsWith('refs/heads/') || extra !== undefined) throw new Error()
      return { sha, ref }
    }) : []

    let head = null
    let latestCommitAt = null
    try {
      const sha = await git(['rev-parse', '--verify', '--quiet', 'HEAD^{commit}'])
      if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(sha)) throw new Error()
      const timestamp = await git(['show', '--no-patch', '--format=%cI', '--no-show-signature', sha, '--'])
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/.test(timestamp) || !Number.isFinite(Date.parse(timestamp))) throw new Error()
      head = sha
      latestCommitAt = timestamp
    } catch {
      // Only an unborn local branch is a legitimate empty HEAD.
      const unborn = await git(['symbolic-ref', '--quiet', 'HEAD'])
      if (!unborn.startsWith('refs/heads/') || branches.some(({ ref }) => ref === unborn)) throw new Error()
    }

    return { branches: branches.length, heads: new Set(branches.map(({ sha }) => sha)).size, head, latest_commit_at: latestCommitAt, bare }
  } catch {
    // Git diagnostics can contain local paths, remote URLs and other private data.
    throw new Error('repository_unreadable')
  }
}
