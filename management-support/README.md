# Management Support

AI Core 본사의 경영지원 영역이다.

이 폴더는 **공통 문서 템플릿·보관 규칙·감사/인수인계 규칙**처럼 여러 프로젝트가 함께 쓰는 본사 자산을 소유한다. 제품별 문서 원본, 고객/직원 개인정보, 재무 원본, 사건 자료, 운영 로그는 이곳의 SSOT가 아니다.

## 현재 상태

- 상태: **SCAFFOLD / HOLD**
- 현재 외부 문서 템플릿 원천: `freepass-creator/docshub@4059d82779b7e1796afa2bbdf644e1d3bbdba3e7`
- 전환 계약: `../docs/integration/DOCSHUB_IMPORT_CLASSIFICATION_2026-09-23.json`
- 문서 실행/검증 소비자: `../devcenter/hubs/document/`
- 최종 공통 템플릿 본문 소유 위치: `templates/`

현재는 수용 구조만 만든다. 실제 DocsHub 템플릿 본문은 아직 이 폴더로 복사하지 않는다.

## 권한

### Management Support가 소유
- 재사용 가능한 문서 템플릿 본문
- 공통 문서 생성기/카탈로그
- 문서 보관·승인·감사·인수인계의 본사 규칙

### DevCenter Document Hub가 소유
- Document Job
- template source binding
- render planning
- quality/visual validation
- `core-receipt/v1` 기반 Document Receipt
- approved template lock / last-known-good chain

### 소유하지 않음
- 회사 원본 PDF/DOCX/XLSX
- 인사/개인정보 자료
- 계좌·정산·재무 원본
- 사건·고소장·법무 증거
- 프로젝트별 최종 산출물
- 외부 발송 상태

## 절대 규칙

외부 DocsHub와 `management-support/templates/`를 동시에 writable template SSOT로 운영하지 않는다.

Cutover 전에는 외부 DocsHub exact revision이 template source다. Cutover 후에는 `management-support/templates/`가 source가 되고 외부 DocsHub는 reference-only가 된다.
