# Shared Extraction Pilot — Google Sheet column label

## 대상

- FreePass ERP4 `sonokong/lib/sheet.mjs#colL`
- AIOps `lib/sheet.mjs#colL`

두 파일은 서로 다른 현역 프로젝트에 존재하면서 Git blob SHA가 **완전히 동일**하다.

`32940fd3edc5d0ec718410472a41476a921d55ff`

## exact source

- ERP4: `f01b91c7f68fc2f55d8d642bc3d39f5e07368967`
- AIOps: `cc440e53e90c642c42a88a70d415355056594129`

## semantic contract

`colL(n)`은 0-based 비음수 정수 열 번호를 Google Sheets A1 열 이름으로 바꾸는 순수 함수다.

- 0 → A
- 25 → Z
- 26 → AA
- 27 → AB
- 701 → ZZ

부작용은 없다.

두 프로젝트의 함수 구현뿐 아니라 해당 파일 전체가 byte-identical이다.

## 판정

**READY_FOR_EXTRACTION_REVIEW**

이것은 실제 추출 승인과 다르다.

아직 다음이 남아 있다.

1. 두 프로젝트 외 실제 consumer 목록 확인
2. shared package API/version 결정
3. 기존 상대 import `./goog.mjs`와 파일 단위 추출 범위를 분리
4. 각 소비 프로젝트의 회귀 테스트
5. rollback 계획
6. DevCenter package promotion 독립 검토

따라서 compiler 결과도 계속:

- `extraction_allowed=false`
- `package_promotion_allowed=false`
- `source_authority_transfer=false`

를 유지한다.

## 의미

KRW formatter 파일럿은 이름은 비슷하지만 계약이 달라 HOLD였다.

이번 `colL` 파일럿은 반대로 **서로 다른 프로젝트에서 동일 source blob + 동일 순수 동작 계약**이 확인돼 추출 검토 단계까지 올라간다.

즉 Shared Extraction Candidate Compiler가 HOLD만 내는 게 아니라 실제 공통화 가능한 후보도 구분한다.
