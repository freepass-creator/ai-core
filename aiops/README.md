# aiops — 본사로 들인 «공통» 부분

`freepass-creator/aiops@334b9474de5a10dfb406637d54e6a55daa3e0f3a` 에서 **사업 중립 공통만** 복사해 온 자리다.

> ★2026-09-25 — 대표가 aiops 저장소를 **삭제**한다(「AI 옵스도 삭제할 거니까 … 데이터 가져갈 거 가져가라」). 그래서 삭제 직전의 main 으로 다시 맞췄고, 남은 파일은 모두 주인에게 갔다 — 렌터카 1174개는 `renman/aiops-rental/`, 프리패스 영업·정산 39개는 `freepass-sales/aiops-freepass/`, `.ai-core/` 키트 사본 14개는 이 저장소 루트가 정본이라 버렸다.

> 대표(2026-09-25): 「렌터카 사업 관련된 기능은 다 랩맨(renman)으로 들어간다고 보면 돼. 그 외적인 개발, 뭐 문서, 디자인, UI, UX 이런 것만 AI 코어에 모아둔다.」

## 무엇이 들어왔나

- AI 협업 방법·AI 노하우(`docs/aiknowhow/`)·범용 도구(Google·Drive·Sheet 도구, 잠금·쓰기 도구, 작업판, 승인, OCR·전사·PDF·엑셀 유틸)·데이터센터 폴더 도구.
- 목록·원본 blob·sha256 은 [`PROVENANCE.json`](PROVENANCE.json). `test/aiops-physical-copy.test.mjs` 가 한 글자라도 다르면 빨갛게 한다.

## 무엇이 안 들어왔나 (원본 aiops 에 그대로 있다)

| 구분 | 어디로 | 수 |
|---|---|---|
| 렌터카 업무(과태료·미수·자금·보험·계약·원자·자산·사건·진입 파일 …) | `freepass-creator/renman` `aiops-rental/` | PROVENANCE `OWNED_BY_RENTAL` |
| 프리패스 마켓 업무(공급사 재고·손오공 재고·판매시트 정산·영업) | `freepass-creator/freepass-sales` `aiops-freepass/` | `OWNED_BY_FREEPASS` |
| `.ai-core/` 키트 사본 | 버림 — 이 저장소 루트가 정본 | `OWNED_BY_DROP_KIT_DUPLICATE` |

## 개인정보

원본은 PR #16 에서 문서·주석만 가렸다. 이 사본은 코드 문자열·JSON 안의 고객 이름까지 같은 고정 가명(`고객NNN`)으로 바꿨다 — 그런 파일은 PROVENANCE 에 `TRANSFORMED` 로 적혀 있다. 전화는 `010-0000-0000`, 주민번호는 `######-#######`. 직원 이름과 회사 차량 번호는 그대로 둔다. git 이력은 가져오지 않았다.

## 규칙

- 원본 aiops 가 사라지므로 **이 사본이 공통 부분의 정본이다.** 다만 아직 운영에 붙인 적이 없다 — 돌리기 전에 경로·자격증명을 설정으로 빼고 시험한다.
- 루트 규격(`docs/AI_WORKING_STANDARD.md`·`design-system/`·`registry/`·`contracts/`)으로 **올리지 않는다.** 올릴 것은 따로 PR 로 흡수한다.
- 원본에 회사 경로·계정(`C:/dev/...`·서비스계정 경로·직원 메일)이 박힌 파일이 있다. 공통 서비스(`shared-services/`)로 옮길 때는 그 값을 설정으로 빼야 한다.
