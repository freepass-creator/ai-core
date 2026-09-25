/** Reconcile only complete source documents. Unknown remote fields require review, never deletion. */
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
export function extraFields(remote, source, prefix = '') {
  if (Array.isArray(remote)) {
    if (!Array.isArray(source)) return [prefix || '(array)'];
    return remote.flatMap((value, i) => i >= source.length
      ? [`${prefix}[${i}]`]
      : extraFields(value, source[i], `${prefix}[${i}]`));
  }
  if (!remote || typeof remote !== 'object') return [];
  if (!source || typeof source !== 'object' || Array.isArray(source)) return [prefix || '(document)'];
  return Object.keys(remote).flatMap(k => !Object.hasOwn(source, k)
    ? [prefix ? `${prefix}.${k}` : k]
    : extraFields(remote[k], source[k], prefix ? `${prefix}.${k}` : k));
}
export async function reconcileBatch(db, rows, authorize) {
  if (typeof authorize !== 'function') throw new Error('Write authorization required');
  const refs = rows.map(([col, key]) => db.collection(col).doc(key));
  await db.runTransaction(async tx => {
    const snapshots = await tx.getAll(...refs);
    for (let i = 0; i < rows.length; i++) {
      const val = rows[i][2];
      const old = snapshots[i].exists ? snapshots[i].data() : {};
      if (extraFields(old, val).length) throw new Error(`HOLD: 원천에 없는 서버 필드 (${rows[i][0]})`);
    }
    await authorize();
    for (let i = 0; i < rows.length; i++) {
      const val = rows[i][2];
      if (!snapshots[i].exists || canonical(snapshots[i].data()) !== canonical(val)) tx.set(refs[i], val);
    }
  });
}
