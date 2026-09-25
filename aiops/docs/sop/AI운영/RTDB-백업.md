# RTDB 백업 — AIOPS 공통 기능

- 상태: **코드 이관 완료 / 스케줄 전환 전**
- 이관일: 2026-09-20
- 원출처: `freepass-creator/jpkerp5/scripts/backup-rtdb.mjs`
- 현 소유자: `freepass-creator/aiops`
- 실행 등급: **읽기 전용 백업**
- 중요: 이 문서는 **새 예약 실행을 만들라는 승인**이 아니다.

## 왜 AIOPS로 옮겼나

RTDB 전체 스냅샷 백업은 특정 ERP의 업무 규칙이 아니라 공통 운영 인프라다.

구 `jpkerp5`에는 다음 두 자동화가 남아 있다.

1. Vercel 일일 RIMS 면허검증 cron
2. GitHub Actions 일일 RTDB 백업 workflow

저장소 퇴역 전에 범용 백업 엔진의 코드 소유권을 현행 AIOPS로 먼저 옮긴다.

## 현재 구현

`scripts/backup-rtdb.mjs`

- Firebase RTDB를 **읽기만** 한다.
- Firebase 쓰기 API를 호출하지 않는다.
- 전체 root 또는 `--path=` 지정 경로를 1회 스냅샷한다.
- 결과는 `backups/rtdb/` 아래에만 저장한다.
- JSON과 함께 SHA-256 manifest를 만든다.
- 데이터 내용은 콘솔에 출력하지 않는다.
- `backups/`는 AIOPS `.gitignore` 대상이다.

## 환경변수

필수:

```
FIREBASE_DATABASE_URL=...
```

인증은 다음 우선순위다.

1. `FIREBASE_SERVICE_ACCOUNT_KEY`
   - 서비스계정 JSON 문자열 또는 JSON 파일 경로
2. Application Default Credentials

선택:

```
FIREBASE_PROJECT_ID=...
```

## 수동 검증

전체:

```
node scripts/backup-rtdb.mjs --label=manual-check
```

특정 경로:

```
node scripts/backup-rtdb.mjs --path=v5/contracts --label=jpkerp5
```

성공 시 콘솔에는 데이터 원문이 아니라 다음만 나온다.

- source host
- source path
- bytes
- top-level entry 수
- SHA-256

## jpkerp5 퇴역 전 Cutover Gate

**아직 아래 작업을 실행한 것으로 간주하지 않는다.**

1. 기존 `jpkerp5/.github/workflows/daily-backup.yml`의 실제 최근 실행 여부와 백업 대상을 확인한다.
2. 기존 백업의 대상 Firebase와 보존 필요성을 확정한다.
3. AIOPS 수동 백업을 같은 source/path에 대해 1회 실행한다.
4. 기존 백업과 건수/크기/필요 시 샘플 구조를 대조한다.
5. 백업 스케줄의 최종 소유 위치를 정한다.
6. **새 스케줄을 먼저 중복 실행하지 않는다.**
7. 새 스케줄이 검증된 뒤에만 구 `jpkerp5` workflow를 비활성화한다.
8. 그 뒤 `jpkerp5` Archive gate를 다시 평가한다.

## 금지

- 백업 JSON을 Git에 커밋하지 않는다.
- 서비스계정 키를 Git에 커밋하지 않는다.
- 구 workflow가 살아 있는지 모르는 상태에서 동일 스케줄을 추가하지 않는다.
- 백업 성공을 원본 복구 가능성 검증과 같은 의미로 보지 않는다.
