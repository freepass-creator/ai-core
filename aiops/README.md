# aiops — 본사로 들인 «공통» 부분

`freepass-creator/aiops@3d6ec8c6a0e826ae0472e3fb3e8bbaa8399b68c9` 에서 **사업 중립 공통만** 복사해 온 자리다.

> 대표(2026-09-25): 「렌터카 사업 관련된 기능은 다 랩맨(renman)으로 들어간다고 보면 돼. 그 외적인 개발, 뭐 문서, 디자인, UI, UX 이런 것만 AI 코어에 모아둔다.」

## 무엇이 들어왔나

- AI 협업 방법·AI 노하우(`docs/aiknowhow/`)·범용 도구(Google·Drive·Sheet 도구, 잠금·쓰기 도구, 작업판, 승인, OCR·전사·PDF·엑셀 유틸)·데이터센터 폴더 도구.
- 목록·원본 blob·sha256 은 [`PROVENANCE.json`](PROVENANCE.json). `test/aiops-physical-copy.test.mjs` 가 한 글자라도 다르면 빨갛게 한다.

## 무엇이 안 들어왔나 (원본 aiops 에 그대로 있다)

| 구분 | 어디로 | 수 |
|---|---|---|
| 렌터카 업무(과태료·미수·자금·보험·계약·원자·자산 …) | 렌터카 매니저 `freepass-creator/renman` | PROVENANCE `OWNED_BY_RENTAL_RENMAN` |
| 프리패스 마켓 업무(공급사 재고·손오공 재고 API·판매시트 정산·영업) | 프리패스 자회사 | `OWNED_BY_FREEPASS_SUBSIDIARY` |
| 운영 자료·사건·키트 사본·진입 파일·실제 기록 | 옮기지 않음 | `OWNED_BY_EXCLUDE` |
| 개인정보·비밀이 든 공통 파일 | 가린 뒤에 들인다 | `PII_OR_SECRET_HELD_AT_SOURCE` |

## 규칙

- **여기는 정본이 아니다.** 실행 권한은 원본 aiops 에 있다. 업무별로 따로 전환하기 전까지 여기 코드를 운영에 돌리지 않는다.
- 루트 규격(`docs/AI_WORKING_STANDARD.md`·`design-system/`·`registry/`·`contracts/`)으로 **올리지 않는다.** 올릴 것은 따로 PR 로 흡수한다.
- 원본에 회사 경로·계정(`C:/dev/...`·서비스계정 경로·직원 메일)이 박힌 파일이 있다. 공통 서비스(`shared-services/`)로 옮길 때는 그 값을 설정으로 빼야 한다.
