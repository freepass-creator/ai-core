# Work Reference — Development Continuity

상태: RESEARCH_CANDIDATE. 현재 Work Packet과 프로젝트 정본이 우선한다.

Work/Codex가 개발 작업을 이어받을 때 전체 대화 대신 다음 continuity contract를 참고한다.

## 입력

- episode_id / episode revision
- current requirement_set_digest
- USER_CONFIRMED 요구와 AI_INFERRED 요구 구분
- current source/project revision
- selected requirement IDs + dependency slice
- allowed/forbidden write scope
- blockers/unknowns
- required proof

## 실행 중 규칙

1. source revision 또는 requirement digest가 바뀌면 기존 계획을 그대로 계속하지 않는다.
2. AI 추정을 사용자 확정 요구로 바꾸지 않는다.
3. 같은 branch/path의 write ownership 충돌이 있으면 수정 전에 보고한다.
4. superseded requirement를 현재 완료조건으로 사용하지 않는다.
5. 검증 결과는 현재 requirement digest와 implementation revision에 묶는다.

## 반환

- implementation commit/revision
- requirement coverage
- actual commands/checks
- PASS/FAIL/SKIP/UNKNOWN
- proof refs
- newly discovered constraints
- stale/blocked reasons
- recommended next episode state

이 문서는 Work에게 추가 권한을 부여하지 않는다. merge/deploy/live mutation은 기존 authority gate를 따른다.
