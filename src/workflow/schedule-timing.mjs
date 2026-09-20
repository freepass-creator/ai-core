function ms(value, code) {
  const parsed=Date.parse(value);
  if (!Number.isFinite(parsed)) { const e=new Error(code); e.code=code; throw e; }
  return parsed;
}

export function assessScheduleTiming({ expected_at, dispatch_at=null, assessed_at, late_after_ms, missed_after_ms }) {
  if (!Number.isInteger(late_after_ms) || late_after_ms < 0) throw new Error('LATE_THRESHOLD_REQUIRED');
  if (!Number.isInteger(missed_after_ms) || missed_after_ms < 1) throw new Error('MISSED_THRESHOLD_REQUIRED');
  if (missed_after_ms < late_after_ms) throw new Error('MISSED_THRESHOLD_BEFORE_LATE_THRESHOLD');
  const expected=ms(expected_at,'EXPECTED_AT_INVALID');
  const assessed=ms(assessed_at,'ASSESSED_AT_INVALID');
  if (dispatch_at != null) {
    const dispatch=ms(dispatch_at,'DISPATCH_AT_INVALID');
    const lateness=Math.max(0,dispatch-expected);
    return {
      classification:lateness > late_after_ms ? 'LATE' : 'ON_TIME',
      lateness_ms:lateness,
      basis:'DISPATCH_OBSERVED'
    };
  }
  const elapsed=Math.max(0,assessed-expected);
  if (elapsed >= missed_after_ms) {
    return {classification:'MISSED',lateness_ms:elapsed,basis:'NO_DISPATCH_BY_MISS_THRESHOLD'};
  }
  return {classification:'UNKNOWN',lateness_ms:elapsed,basis:'WAITING_FOR_DISPATCH'};
}
