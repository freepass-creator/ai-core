# A Session Repository Coverage — 2026-09-19

상태: **A-SESSION OPERATING INDEX / NOT CANONICAL**

## 목적

A 세션이 연결된 GitHub 저장소를 매번 처음부터 다시 읽지 않도록, 각 저장소의 **관측 HEAD · 감사 깊이 · 독립증거 여부 · 발견 후보/Backport**를 고정한다.

다음 감사의 기본 규칙:

1. 현재 HEAD가 `observed_head`와 같으면 전체 재감사하지 않는다.
   - **AI Core 자기 자신은 예외**: 이 registry를 갱신하면 AI Core HEAD도 바뀌므로 stored HEAD를 두지 않고 감사 시작 시 current HEAD를 읽는다.
2. HEAD가 바뀌면 그 revision delta와 영향받는 계약부터 본다.
3. Git revision이 같아도 production/runtime/external evidence가 바뀌면 다시 본다.
4. clone/fork/copied-module 계보는 별도 Repo라는 이유만으로 CROSS_PROJECT 증거가 되지 않는다.
5. spec/brief만 있고 실행 코드가 없으면 구현 증거로 승격하지 않는다.

## 현재 분포

- CORE_BASELINE: 1
- DEEP_EVIDENCE: 22
- SAMPLED_NO_PROMOTION: 9
- LINEAGE_OVERLAP: 3
- MINIMAL_NO_TECH_ASSET: 1

총 **36개 Repo**.

Machine-readable 정본은 `docs/research/a-session-repo-coverage.v1.json`.

## 다음 사용법

```text
Repo current HEAD
→ coverage.observed_head 비교
→ 동일 + runtime 변화 없음 = SKIP
→ 변경 = commit delta 조사
→ 기존 Promotion Matrix 후보와 의미 비교
→ evidence level / backport / contradiction만 갱신
→ 새 observed_head 기록
```

이 문서는 A 세션의 조사 인덱스이며 B/C/D 정본을 변경하지 않는다.
