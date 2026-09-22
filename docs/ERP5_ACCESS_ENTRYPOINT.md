# ERP5 작업 진입점

ERP5 업무에서 이름을 저장소명으로 추측하지 않는다.

- 활성 코드·워크플로·배포 정본: `freepass-creator/freepasserp4`
- 로컬 기본 경로: `C:\dev\freepasserp4`
- 데이터 런타임: Firebase Firestore 프로젝트 `freepasserp5`
- 사용 금지: `freepass-creator/jpkerp5`는 RETIRE 대상이며 현재 ERP5 구현 정본이 아니다.

로컬 체크아웃이 없을 때만 실행한다.

```powershell
gh auth status
gh repo view freepass-creator/freepasserp4
gh repo clone freepass-creator/freepasserp4 C:\dev\freepasserp4
cd C:\dev\freepasserp4
node .ai-core/session-bootstrap.mjs
```

이미 `C:\dev\freepasserp4`가 있으면 다시 클론하거나 덮어쓰지 않는다. 먼저 아래를 실행한다.

```powershell
git -C C:\dev\freepasserp4 status --short --branch
node C:\dev\freepasserp4\.ai-core\session-bootstrap.mjs
```

작업 트리가 깨끗하고 부트스트랩이 원격보다 뒤처졌다고 판정한 경우에만 다음을 실행한다.

```powershell
node C:\dev\freepasserp4\.ai-core\session-bootstrap.mjs --sync
```

소스 저장소 접근과 Firebase 데이터 접근은 별개다. 클론 성공은 Firestore 권한을 만들지 않는다. 운영 데이터 조회·갱신은 저장소에 기록된 기존 인증 경로와 승인 경계를 확인하고, 자격 증명을 새로 만들거나 Git에 저장하지 않는다. Firestore parity가 부족하면 HOLD로 남기며 RTDB fallback을 복구하지 않는다.
