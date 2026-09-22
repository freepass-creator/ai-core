# 개발센터 SSOT 검증파트

사용자 지정: 2026-09-09. 개발센터 하위 파트로 편입하며 Codex가 파트장을 맡는다.

- 상위 조직: C:\dev\devcenter. 센터 PM은 기존대로 Claude Code.
- 파트장: Codex. SSOT 검증 업무 배분, 반례 재현, 검사기 유지보수, 이견 통합과 근거 보고를 책임진다.
- 검사기 정본: C:\dev\devcenter\ssot. 사용자 최신 지시(2026-09-09)에 따라 엔진·검수·작업 파일 전체를 이곳으로 이동했다. 이전 도구\ssot-hub 이동안은 대체되었으며 별도 사본을 만들지 않는다.
- 업무 정본(대수·미수·계약 등)과 대상 프로젝트의 코드·원자는 센터로 복제하지도 이동하지도 않는다. `C:\dev\aiops` 등 제자리가 정본이다.
- 업무 절차 정본: C:\dev\devcenter\ssot\AGENTS.md 및 knowledge\SSOT-PLAYBOOK.md. 이 문서는 소속·책임·진입점만 정의한다.
- 담당: 확정 범위와 출처/버전 점검, 중복 정본·연동 불일치 조사, 승인 원자의 구현 누락·미승인 유입 검토, 검수 의견과 재현 근거 기록.
- 현재 자동 검사는 등록된 로컬 CSV 범위다. 원자↔구현 자동 대조와 실제 ERP/Google/DB 연결은 아직 미구현/미검증이며 조직 편입이 그 완료를 뜻하지 않는다.
- 사용자가 확정한 원자·범위가 기준이다. 파트장/PM 임명은 정본을 임의 확정하거나 대상 프로젝트·운영 데이터·권한을 변경하는 포괄 승인이 아니다.
- 보고 경로: 사용자 및 개발센터 PM이 확인할 수 있도록 검사기 reviews에 증거/의견을 남기고 이 센터 파트에서 연결한다. 자동 발송·주기 감시를 새로 켜지 않는다.

## 진입점

- 검사기 운영 규칙: C:\dev\devcenter\ssot\AGENTS.md
- 검사기 설명: C:\dev\devcenter\ssot\README.md
- 현재 검수 상태: C:\dev\devcenter\ssot\four-ai-review-gate.json
- 검수 기록: C:\dev\devcenter\ssot\reviews

조직 소속과 개발 규격 원본의 통합 결정은 별개다. 기존 candidate 규격을 자동 authoritative로 승격하지 않는다.

## 검수 기준 및 이견 처리

검수 참여·정족수·실패 처리 기준의 유일한 정본은 C:\dev\devcenter\ssot\AGENTS.md다. 이 파트 정의에는 수치를 재정의하지 않는다. 센터의 기존 전원 검토 완료 조항과 충돌할 때 SSOT 파트는 해당 AGENTS.md의 사용자 지정 기준을 우선하며, 사용자의 직접 지시 없이 PM/파트장이 이 예외를 변경할 수 없다. 다른 파트의 기준은 그대로다.
PM과 파트장 또는 검토자 사이의 중요한 이견은 원본·재현 증거로 해소한다. 그래도 해소되지 않으면 사용자에게 판단을 요청하고 그때까지 HOLD로 남긴다. 직책이나 다수결로 확정하지 않는다.

## 점검 기록

- 프리패스 첫 점검(2026-09-09): C:\dev\devcenter\ssot\reviews\2026-09-09-freepass-initial\REVIEW.md. 구조 전환 검토 HOLD이며 운영 데이터 검증 완료가 아니다.

- 프리패스 원자 방식 의견: C:\dev\devcenter\ssot\reviews\2026-09-09-freepass-opinion\opinion.md. 원자 설계 유지, 수집/갱신/발행 경계 검증 권고.

- 프리패스 상세 검토 정본(5건): C:\dev\freepasserp4\docs\SSOT-OPINION-2026-09-09.md. source hash/교차검토는 C:\dev\devcenter\ssot\reviews\2026-09-09-freepass-detailed.
