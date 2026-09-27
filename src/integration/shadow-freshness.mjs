/** 그림자(shadow)가 아직 원본을 비추고 있는지 판정한다.
 *
 * ★왜 필요한가 (2026-09-23 반례 검토에서 나온 구멍)
 *   `shared-services/` 의 파일들은 aiops 를 «비추는 그림자»다 — 권한은 aiops 에 있고(`source_runtime_authority: AIOPS`),
 *   ai-core 는 실행 권한이 없다(`ai_core_runtime_authority: false`). 그래서 그림자는 «원본과 같아야» 뜻이 있다.
 *
 *   그런데 지금 검사들은 고정 당시의 값만 본다:
 *     · 사본의 git blob sha 를 다시 계산해 «고정된 sha» 와 비교한다 → 사본이 변조되지 않았음은 증명한다.
 *     · 그러나 그 sha 는 시험 파일 안에 «글자»로 박혀 있다. 원본이 그 뒤로 바뀌어도 시험은 영원히 초록이다.
 *   즉 **원본이 움직인 순간을 잡을 장치가 없다.** 그림자는 조용히 옛 그림이 된다.
 *
 *   ai-core 는 이미 프로젝트 head 를 관측한다(`registry/projects.json`). 그 관측값과 그림자가 고정한 revision 을
 *   맞대면 «원본이 움직였는지»는 알 수 있다. 움직였다면 그림자가 여전히 유효한지는 «다시 확인한 기록»이 있어야 한다.
 *
 * 판정 셋:
 *   PINNED      — 관측된 head 와 고정 revision 이 같다. 그림자는 최신이다.
 *   REVALIDATED — head 가 움직였고, 그 head 에서 대상 blob 들이 그대로임을 기록으로 확인했다.
 *   HOLD        — head 가 움직였는데 확인 기록이 없거나, 기록이 다른 head 의 것이거나, blob 이 실제로 바뀌었다.
 *
 * 네트워크를 쓰지 않는다. 읽은 기록만으로 판정한다 — 기록을 만드는 일은 scripts 쪽이 한다.
 */

export const 판정 = { 최신: 'PINNED', 재확인됨: 'REVALIDATED', 보류: 'HOLD' };

const revision = (값) => (typeof 값 === 'string' && /^[0-9a-f]{40}$/.test(값) ? 값 : null);

/**
 * @param {object} 내력   shared-services/PROVENANCE.json
 * @param {string} 관측head  registry 가 관측한 원본 프로젝트의 head revision
 */
export function 그림자신선도(내력, 관측head) {
  const 이유 = [];
  const 고정 = revision(내력?.source_revision);
  const 지금 = revision(관측head);

  if (!고정) 이유.push('PINNED_REVISION_INVALID');
  if (!지금) 이유.push('OBSERVED_HEAD_INVALID');
  if (이유.length) return { state: 판정.보류, 이유, 고정, 지금 };

  if (고정 === 지금) return { state: 판정.최신, 이유: [], 고정, 지금 };

  /** 원본이 움직였다. 그러면 «그 head 에서 다시 본 기록» 이 있어야 한다. */
  const 재확인 = 내력?.revalidation;
  if (!재확인) return { state: 판정.보류, 이유: ['SOURCE_MOVED_WITHOUT_REVALIDATION'], 고정, 지금 };
  if (revision(재확인.checked_head) !== 지금) {
    return { state: 판정.보류, 이유: ['REVALIDATION_HEAD_MISMATCH'], 고정, 지금, 확인한head: 재확인.checked_head ?? null };
  }

  const 항목 = Array.isArray(내력.entries) ? 내력.entries : [];
  const 확인표 = new Map((재확인.entries ?? []).map((e) => [e.source_path, e]));
  const 바뀐것 = [];
  const 확인안된것 = [];
  for (const e of 항목) {
    const 본것 = 확인표.get(e.source_path);
    if (!본것) { 확인안된것.push(e.source_path); continue; }
    if (revision(본것.source_blob_sha_at_checked_head) === null) { 확인안된것.push(e.source_path); continue; }
    if (본것.source_blob_sha_at_checked_head !== e.source_blob_sha) 바뀐것.push(e.source_path);
  }

  if (확인안된것.length) return { state: 판정.보류, 이유: ['REVALIDATION_INCOMPLETE'], 고정, 지금, 확인안된것 };
  if (바뀐것.length) return { state: 판정.보류, 이유: ['SOURCE_DRIFTED'], 고정, 지금, 바뀐것 };

  return { state: 판정.재확인됨, 이유: [], 고정, 지금, 확인한head: 재확인.checked_head };
}

/** 여러 그림자를 한 번에 본다. 하나라도 보류면 전체가 보류다. */
export function 모든그림자(묶음) {
  const 결과 = 묶음.map(({ 이름, 내력, 관측head }) => ({ 이름, ...그림자신선도(내력, 관측head) }));
  return { 결과, 보류: 결과.filter((r) => r.state === 판정.보류) };
}
