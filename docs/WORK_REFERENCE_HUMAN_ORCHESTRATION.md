# Work Forward Reference — Human Orchestration

Work/Codex가 현재 구현을 진행할 때 이 문서를 **차세대 참조**로만 사용한다. 현재 Work Packet, 프로젝트 AGENTS/README, 승인 규칙이 우선한다.

## 목표
Chat이 사용자와 상호작용할 때 전체 대화를 그대로 넘기지 않고 다음 Plan Slice를 GitHub에 남긴다.

```json
{
  "user_intent":"",
  "desired_outcome":"",
  "domain_pack":"",
  "known_constraints":[],
  "questions_resolved":[],
  "unresolved_high_value_questions":[],
  "source_revisions":[],
  "allowed_scope":[],
  "forbidden_scope":[],
  "done_when":[],
  "verification_plan":[],
  "return_contract":[]
}
```

## Work가 해야 할 일
- 위 Slice와 현재 source revisions를 기준으로 구현/실행한다.
- source, done_when, blocker가 달라졌으면 stale plan으로 보고 그대로 진행하지 않는다.
- 사용자의 선호 판단이 필요한 누락은 임의 결정하지 않고 `QUESTION_REQUIRED`로 반환한다.
- 외부 사실로 확인 가능한 누락은 가능한 범위에서 source를 확인하고 evidence를 남긴다.
- 전체 과거 대화를 다시 해석하여 새로운 요구를 만들지 않는다.
- 결과에는 end SHA, 실제 실행 명령, 성공/실패/생략, unresolved, 후속 필요를 남긴다.

## 도메인별 최소 관점
- Legal: 절차/기한, 사실·주장·증거, 공식 근거 최신성, 선택지/리스크, 제출 권한.
- Document: 내용 SSOT, 독자/목적, DocsHub template, content/layout/PDF 검증.
- Travel: 날짜/인원/예산·편의 선호, 예약 의존성, 이동, 대안.
- Workshop: 목표 Outcome, 참석자, 사전자료, agenda, action items, follow-up.
- Development: project revision, existing assets, build/test/debug, regression, handoff.

Work는 이 문서를 근거로 자동 scope expansion이나 production action을 수행하지 않는다.
