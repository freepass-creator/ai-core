# Self-Improvement Loop v0.1

AI Core의 자기 고도화는 모델 가중치나 권한을 스스로 확장하는 방식이 아니라, **외부 지식·정책·코드·라우팅 규칙을 증거 기반으로 개선하는 폐쇄형 루프**다.

## Loop

1. Observe — 작업 결과, 실패, 재작업, 비용성 지표, 누락을 수집한다.
2. Diagnose — 실패 원인을 AIOPS / DevCenter / AI Core / Project Local 중 어디에 귀속할지 분류한다.
3. Propose — 한 번에 하나의 제한된 개선안을 만든다.
4. Sandbox Test — 합성/비운영 환경에서 기존 방식과 후보 방식을 A/B 비교한다.
5. Independent Review — 구현자와 다른 검토자가 증거와 반례를 확인한다.
6. Shadow Pilot — 실제 작업에 적용하되 운영 권한은 행사하지 않고 병렬 비교한다.
7. Outcome Check — 재작업, 누락 검출, first-pass success, 반복 컨텍스트 등 실제 결과를 비교한다.
8. Promote or Revert — 개선이 입증되면 LOCAL/DOMAIN/UNIVERSAL 후보로 승격하고, 아니면 폐기·롤백한다.

## Hard Boundaries

- AI Core는 스스로 운영 권한을 만들거나 확대하지 않는다.
- 배포, 운영 데이터 변경, 삭제, 결제, 권한 변경, 법원 제출, 물리적 위해·무기 관련 실행은 자동 고도화 대상에서 제외하고 HUMAN_GATE를 유지한다.
- 자기 수정은 새 branch/PR 후보로만 만든다. main/production 자동 적용 금지.
- 자기 평가만으로 채택하지 않는다. 최소한 재현 가능한 검증과 별도 review evidence를 요구한다.
- 테스트 개수 증가, 새 이름, 파일 증가만으로 진화 판정을 하지 않는다.
- 입력·정책·revision이 바뀌면 이전 PASS를 재사용하지 않는다.

## Scope of Self-Improvement

허용되는 자동 고도화 후보:
- Context 선택 축소/정확도 개선
- GPT_DIRECT / WORK_CODEX 라우팅 개선
- Work Packet 품질 개선
- 실패 패턴 탐지
- 요구사항↔검사 추적성
- 중복 작업 방지
- 재사용 자산 탐색 개선
- 비용/재작업 계측

자동 승격하지 않는 영역:
- 새로운 외부 권한
- 안전 경계 약화
- 승인 우회
- 운영/법률/재무 의사결정의 자동 최종 승인
- 물리적 위해를 유발할 수 있는 실행 능력

## Success Criteria

개선안은 최소 하나의 이전 실패를 재현하고, 후보가 그 실패를 막으며, 정상 케이스를 과도하게 차단하지 않는다는 증거가 있어야 한다. 가능하면 실제 shadow outcome에서 기존 대비 개선이 확인되어야 한다.
