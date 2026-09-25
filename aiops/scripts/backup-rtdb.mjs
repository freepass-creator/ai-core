#!/usr/bin/env node
/**
 * AIOPS RTDB read-only backup engine.
 *
 * Migrated from the legacy jpkerp5 backup capability on 2026-09-20.
 * This script NEVER writes to Firebase. It reads one RTDB snapshot and writes
 * a local JSON backup plus a SHA-256 manifest under backups/rtdb/.
 *
 * Required:
 *   FIREBASE_DATABASE_URL
 *
 * Credential priority:
 *   1) FIREBASE_SERVICE_ACCOUNT_KEY = inline JSON or JSON file path
 *   2) Application Default Credentials
 *
 * Optional:
 *   FIREBASE_PROJECT_ID
 *
 * Usage:
 *   node scripts/backup-rtdb.mjs
 *   node scripts/backup-rtdb.mjs --path=contracts
 *   node scripts/backup-rtdb.mjs --path=v5/contracts --label=jpkerp5
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  initializeApp,
  getApps,
  cert,
  applicationDefault,
} from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

function parseArgs(argv) {
  const out = {};
  for (const raw of argv) {
    if (raw === '--help' || raw === '-h') {
      out.help = true;
      continue;
    }
    if (!raw.startsWith('--')) throw new Error(`지원하지 않는 인자: ${raw}`);
    const eq = raw.indexOf('=');
    const key = (eq === -1 ? raw.slice(2) : raw.slice(2, eq)).trim();
    const value = eq === -1 ? true : raw.slice(eq + 1);
    if (!key) throw new Error(`잘못된 인자: ${raw}`);
    out[key] = value;
  }
  return out;
}

function cleanNodePath(value) {
  const p = String(value || '').trim().replace(/^\/+|\/+$/g, '');
  if (p.includes('..')) throw new Error('--path 에 .. 을 사용할 수 없습니다.');
  return p;
}

function safeLabel(value) {
  const s = String(value || 'rtdb')
    .trim()
    .replace(/[^0-9A-Za-z가-힣._-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return s || 'rtdb';
}

async function resolveCredential(raw) {
  const value = String(raw || '').trim();
  if (!value) return applicationDefault();

  let parsed;
  if (value.startsWith('{')) {
    parsed = JSON.parse(value);
  } else {
    parsed = JSON.parse(await readFile(value, 'utf8'));
  }
  return cert(parsed);
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function databaseHost(databaseURL) {
  try {
    return new URL(databaseURL).host;
  } catch {
    return 'invalid-url';
  }
}

function usage() {
  console.log([
    'AIOPS RTDB read-only backup',
    '',
    'Usage:',
    '  node scripts/backup-rtdb.mjs',
    '  node scripts/backup-rtdb.mjs --path=v5/contracts --label=jpkerp5',
    '',
    'Output:',
    '  backups/rtdb/<timestamp>-<label>-<path>.json',
    '  backups/rtdb/<same>.manifest.json',
    '',
    'This command never writes to Firebase.',
  ].join('\n'));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }

  const databaseURL = String(process.env.FIREBASE_DATABASE_URL || '').trim();
  if (!databaseURL) {
    throw new Error('FIREBASE_DATABASE_URL 환경변수가 필요합니다.');
  }

  const projectId = String(process.env.FIREBASE_PROJECT_ID || '').trim() || undefined;
  const nodePath = cleanNodePath(args.path);
  const label = safeLabel(args.label || projectId || databaseHost(databaseURL));

  const credential = await resolveCredential(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  const existing = getApps()[0];
  const app = existing || initializeApp({
    credential,
    databaseURL,
    ...(projectId ? { projectId } : {}),
  });

  const db = getDatabase(app);
  const ref = db.ref(nodePath || '/');

  console.log(
    `[rtdb-backup] READ ONLY · host=${databaseHost(databaseURL)} · path=/${nodePath}`,
  );

  const snap = await ref.once('value');
  const data = snap.val();

  const payload = JSON.stringify(data, null, 2);
  const bytes = Buffer.byteLength(payload, 'utf8');
  const sha256 = crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
  const topLevelEntries =
    data && typeof data === 'object' && !Array.isArray(data)
      ? Object.keys(data).length
      : data == null
        ? 0
        : 1;

  const outDir = path.resolve('backups', 'rtdb');
  await mkdir(outDir, { recursive: true });

  const pathLabel = safeLabel(nodePath || 'root');
  const baseName = `${timestamp()}-${label}-${pathLabel}`;
  const jsonPath = path.join(outDir, `${baseName}.json`);
  const manifestPath = path.join(outDir, `${baseName}.manifest.json`);

  await writeFile(jsonPath, payload, 'utf8');

  const manifest = {
    schema_version: '1.0',
    created_at: new Date().toISOString(),
    mode: 'READ_ONLY',
    source: {
      project_id: projectId || null,
      database_host: databaseHost(databaseURL),
      path: nodePath ? `/${nodePath}` : '/',
    },
    artifact: {
      file: path.relative(process.cwd(), jsonPath).replaceAll('\\', '/'),
      bytes,
      sha256,
      top_level_entries: topLevelEntries,
    },
    safety: {
      firebase_write_performed: false,
      repository_commit_intended: false,
    },
  };

  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  console.log(
    `[rtdb-backup] OK · bytes=${bytes} · topLevel=${topLevelEntries} · sha256=${sha256}`,
  );
  console.log(
    `[rtdb-backup] files=${path.relative(process.cwd(), jsonPath)} + manifest`,
  );
}

main().catch((error) => {
  console.error('[rtdb-backup] FAIL:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
