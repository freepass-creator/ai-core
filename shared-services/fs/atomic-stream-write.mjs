/** 기존 목적지를 건드리지 않고, 완전 수신한 뒤에만 교체하는 bounded stream writer. */
import { closeSync, mkdirSync, openSync, renameSync, unlinkSync, writeSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

export async function writeStreamAtomically(destination, body, { maxBytes = null } = {}) {
  mkdirSync(dirname(destination), { recursive: true });
  const staging = `${destination}.download-${randomUUID()}.tmp`;
  let handle = null;
  let completed = false;
  let total = 0;
  try {
    handle = openSync(staging, 'wx');
    for await (const chunk of body ?? []) {
      total += chunk.byteLength;
      if (Number.isFinite(maxBytes) && maxBytes >= 0 && total > maxBytes) throw new Error('다운로드 크기 상한 초과');
      writeSync(handle, chunk);
    }
    closeSync(handle);
    handle = null;
    // rename이 실패하면 기존 destination은 그대로 두고 staging만 정리한다.
    renameSync(staging, destination);
    completed = true;
    return total;
  } finally {
    if (handle !== null) closeSync(handle);
    if (!completed) {
      try { unlinkSync(staging); } catch { /* 이 호출의 고유 staging 파일만 정리 시도 */ }
    }
  }
}
