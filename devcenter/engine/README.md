# engine — Development Center Control Plane

**7개 Hub 공통 Control Plane의 실행기 자리. 제8의 Hub가 아니다.** operations의 절차를 실행하고 run 상태를 관리한다. 아직 구현되지 않았다.

## 관련 실행 진입점

아래는 도구를 찾는 안내다. 공통 실행기와 각 도구의 기능·소유를 합치지 않는다.

- SSOT 검사기: [SSOT 파트](../ssot/PART.md), 실제 구현은 `C:/dev/devcenter/ssot`.
- 규격 검색: 루트 [scripts/standards-find.mjs](../../scripts/standards-find.mjs). 시작 템플릿 생성기가 아니다.
- 자동 커밋 기능은 ai-ops scripts/dev/commit-checked.ps1 에 큰파일 차단만 흡수

```powershell
python C:\dev\devcenter\ssot\ssot_audit.py C:\dev\devcenter\registry.json
```

이전 `도구/ssot-hub` 이동안은 폐기됐다. 검사기를 이곳에 복제하지 않는다. 이동 검증 기록은 로컬 `ssot/reviews/2026-09-09-relocation`에 있다. 업무용 도구는 `C:/dev/aiops`, 프로젝트 전용 스크립트는 각 원본 프로젝트에 유지한다.
