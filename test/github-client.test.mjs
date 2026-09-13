import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGitHubContentsFetcher,
  createGitHubRevisionFetcher,
  GitHubReadError
} from '../src/github-client.mjs';

test('GitHub client performs a read-only GET and decodes file content', async () => {
  const calls = [];
  const fetchFile = createGitHubContentsFetcher({
    token: 'test-token',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          type: 'file',
          path: 'docs/규칙.md',
          sha: 'blob-sha',
          encoding: 'base64',
          content: Buffer.from('정본 내용').toString('base64')
        })
      };
    }
  });

  const result = await fetchFile({ repo: 'freepass-creator/aiops', path: 'docs/규칙.md' });
  assert.equal(result.content, '정본 내용');
  assert.equal(result.sha, 'blob-sha');
  assert.equal(calls[0].options.method, 'GET');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer test-token');
  assert.match(calls[0].url, /docs\/%EA%B7%9C%EC%B9%99\.md/);
});

test('directory revision is stable regardless of response order', async () => {
  const entries = [
    { type: 'file', path: 'x/b', sha: '2' },
    { type: 'file', path: 'x/a', sha: '1' }
  ];
  const makeFetcher = items => createGitHubContentsFetcher({
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => items })
  });
  const first = await makeFetcher(entries)({ repo: 'owner/repo', path: 'x' });
  const second = await makeFetcher([...entries].reverse())({ repo: 'owner/repo', path: 'x' });
  assert.equal(first.sha, second.sha);
  assert.equal(first.revision_kind, 'directory_manifest_sha256');
});

test('GitHub errors do not include the access token', async () => {
  const fetchFile = createGitHubContentsFetcher({
    token: 'never-print-this',
    fetchImpl: async () => ({ ok: false, status: 403, json: async () => ({}) })
  });
  await assert.rejects(
    () => fetchFile({ repo: 'owner/repo', path: 'x' }),
    error => {
      assert.ok(error instanceof GitHubReadError);
      assert.equal(error.code, 'HTTP_403');
      assert.doesNotMatch(error.message, /never-print-this/);
      return true;
    }
  );
});

test('revision client pins a branch name to a commit SHA', async () => {
  const fetchRevision = createGitHubRevisionFetcher({
    token: 'test-token',
    fetchImpl: async (url, options) => {
      assert.match(url, /\/commits\/feature%2Flive-context/);
      assert.equal(options.method, 'GET');
      return { ok: true, status: 200, json: async () => ({ sha: 'commit-sha' }) };
    }
  });
  const result = await fetchRevision({
    repo: 'freepass-creator/ai-core',
    ref: 'feature/live-context'
  });
  assert.equal(result.sha, 'commit-sha');
  assert.equal(result.revision_kind, 'git_commit_sha');
});
