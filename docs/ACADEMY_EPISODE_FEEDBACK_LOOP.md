# Academy Episode Feedback Loop

Status: `CURRENT / MINIMAL EXECUTABLE BRIDGE`

## 목적

AI Core 사관학교의 다음 단계는 규칙을 더 많이 쓰는 것이 아니라 **현장 Episode의 결과가 다음 AI 교육으로 돌아오는 것**이다.

이 문서는 새 Evolution Engine을 만들지 않는다. 기존 Episode 기록과
`docs/AI_CORE_EVOLUTION_BRIDGE.md`, `scripts/evaluate-self-evolution.mjs` 사이에
가장 얇은 실행 연결만 둔다.

```
현장 Episode
  → academy:feedback
  → 비식별 Feedback Packet
  → Lesson Candidate
  → 기존 Evolution Bridge의 작은 검증
  → LOCAL / DOMAIN / UNIVERSAL 채택 또는 HOLD
```

## 실행

```powershell
npm run academy:feedback -- docs/episodes/<episode>.json
```

출력은 JSON 한 건이다. `feedback_status=READY`는 **피드백 패킷을 만들기에 필요한 증거가 갖춰졌다는 뜻**이지
업무 성공, 규칙 채택, merge, 배포 또는 외부 실행 승인이 아니다.

항상 다음이 `false`다.

- `auto_adopted`
- `execution_authorized`

## Episode에 추가할 수 있는 최소 관측

기존 Episode 구조를 유지한다. 평행 원장을 만들지 않는다.
재사용 가능한 교훈이 보일 때만 선택적으로 `lesson_observations`를 추가한다.

```json
{
  "lesson_observations": [
    {
      "kind": "USER_CORRECTION",
      "sanitized_summary": "비식별·비민감 요약",
      "evidence_ref": "commit/issue/receipt pointer",
      "proposed_change": "다음 AI의 어떤 행동을 바꿀지",
      "prediction": "바꾸면 다음 실전에서 무엇이 줄거나 없어져야 하는지",
      "target_scope": "LOCAL"
    }
  ]
}
```

허용 `kind`:

- `USER_CORRECTION`
- `FAILURE`
- `REWORK`
- `FALSE_COMPLETION`
- `SUCCESS_PATTERN`

`target_scope`는 `LOCAL | DOMAIN | UNIVERSAL_CANDIDATE`다.
한 건의 성공이나 지적만으로 DOMAIN/UNIVERSAL 채택을 의미하지 않는다.

## READY 조건

최소한 다음이 관측돼야 한다.

- Episode가 `CLOSED`
- project id와 subject revision 존재
- 사용자 목적 요약 존재
- proof revision이 subject와 결속됨
- 독립 검토가 `CONFIRMED`
- 실제 outcome이 관측됨
- 사관학교 핵심 metrics와 safety count가 숫자로 관측됨

하나라도 빠지면 `HOLD`지만, 이미 확인된 사실은 패킷에 남겨 다음 AI가 다시 조사하지 않게 한다.

## 사용자 지적의 취급

`user_correction_count > 0`인데 구조화된 `USER_CORRECTION` 관측이 없으면
사관학교는 그 지적을 임의로 추론해서 교훈으로 만들지 않는다.
`USER_CORRECTION_DETAIL_MISSING`으로 HOLD한다.

즉:

```
대표 지적
→ 비식별 사실 요약 + 증거 포인터
→ 원인/행동 변경/예측
→ Lesson Candidate
→ 후속 실제 Episode로 검증
```

이다.

## 개인정보·민감정보

Feedback Packet은 대화 전문, 고객정보, 인증정보를 복사하지 않는다.
`sanitized_summary`와 원본의 승인된 evidence pointer만 남긴다.
현재 변환기는 입력 객체 전체를 출력하지 않으며, 알려지지 않은 raw transcript 필드도 전달하지 않는다.

## 기존 Self-Evolution과의 경계

이 변환기는 **관측을 다음 단계로 넘기는 역할만** 한다.

- 원인 가설의 타당성
- counterexample
- baseline/trial 비교
- 채택 여부

는 기존 `SELF_EVOLUTION.md`와 `evaluate-self-evolution.mjs`의 경계를 그대로 따른다.
