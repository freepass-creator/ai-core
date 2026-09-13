import { createHash } from 'node:crypto';

export class GitHubReadError extends Error {
  constructor(code, status = null) {
    super(`GitHub read failed: ${code}`);
    this.name = 'GitHubReadError';
    this.code = code;
    this.status = status;
  }
}

function assertRepository(repo) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo ?? '')) {
    throw new GitHubReadError('INVALID_REPOSITORY');
  }
}

function encodeRepositoryPath(path) {
  const normalized = String(path ?? '').replace(/^\/+|\/+$/g, '');
  if (!normalized) throw new GitHubReadError('INVALID_PATH');
  return normalized.split('/').map(encodeURIComponent).join('/');
}

function directoryRevision(entries) {
  const manifest = entries
    .map(entry => `${entry.type ?? 'unknown'}:${entry.path ?? entry.name}:${entry.sha ?? ''}`)
    .sort()
    .join('\n');
  return `sha256:${createHash('sha256').update(manifest).digest('hex')}`;
}

export function createGitHubContentsFetcher({
  token,
  apiBase = 'https://api.github.com',
  fetchImpl = globalThis.fetch
} = {}) {
  if (typeof fetchImpl !== 'function') throw new GitHubReadError('FETCH_UNAVAILABLE');

  return async function fetchFile({ repo, path, ref = 'main' }) {
    assertRepository(repo);
    const encodedPath = encodeRepositoryPath(path);
    const headers = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'freepass-ai-core-readonly'
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const url = `${apiBase.replace(/\/$/, '')}/repos/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`;
    const response = await fetchImpl(url, { method: 'GET', headers });

    if (response.status === 404) throw new GitHubReadError('NOT_FOUND', 404);
    if (!response.ok) throw new GitHubReadError(`HTTP_${response.status}`, response.status);

    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new GitHubReadError('INVALID_JSON_RESPONSE', response.status);
    }

    if (Array.isArray(payload)) {
      return {
        repo,
        path,
        ref,
        kind: 'directory',
        sha: directoryRevision(payload),
        revision_kind: 'directory_manifest_sha256',
        content: null
      };
    }

    if (payload?.type !== 'file' || payload.encoding !== 'base64' || !payload.sha) {
      throw new GitHubReadError('UNSUPPORTED_CONTENT_RESPONSE', response.status);
    }

    return {
      repo,
      path: payload.path ?? path,
      ref,
      kind: 'file',
      sha: payload.sha,
      revision_kind: 'git_blob_sha',
      content: Buffer.from(payload.content ?? '', 'base64').toString('utf8')
    };
  };
}

export function createGitHubRevisionFetcher({
  token,
  apiBase = 'https://api.github.com',
  fetchImpl = globalThis.fetch
} = {}) {
  if (typeof fetchImpl !== 'function') throw new GitHubReadError('FETCH_UNAVAILABLE');

  return async function fetchRevision({ repo, ref = 'main' }) {
    assertRepository(repo);
    const headers = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'freepass-ai-core-readonly'
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const url = `${apiBase.replace(/\/$/, '')}/repos/${repo}/commits/${encodeURIComponent(ref)}`;
    const response = await fetchImpl(url, { method: 'GET', headers });
    if (response.status === 404) throw new GitHubReadError('NOT_FOUND', 404);
    if (!response.ok) throw new GitHubReadError(`HTTP_${response.status}`, response.status);

    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new GitHubReadError('INVALID_JSON_RESPONSE', response.status);
    }
    if (!payload?.sha) throw new GitHubReadError('REVISION_MISSING', response.status);
    return { repo, ref, sha: payload.sha, revision_kind: 'git_commit_sha' };
  };
}
