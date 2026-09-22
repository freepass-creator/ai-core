# Management Support Templates

이 폴더는 DocsHub 물리 통합이 완료된 뒤 **공통 문서 template body의 canonical target**이 된다.

현재 상태는 **EMPTY BY POLICY**다. 이 README 외 template body, renderer, generator, catalog를 아직 넣지 않는다.

반입 조건은 `../../docs/integration/DOCSHUB_IMPORT_CLASSIFICATION_2026-09-23.json`의 cutover requirements를 전부 만족해야 한다.

## 허용 후보

fresh inventory 후 명확히 공통 자산으로 확인된 것만 후보가 된다.

- 문서 template body
- template catalog/spec
- 재사용 가능한 generator/renderer source
- 공통 출력 규격에 필요한 비민감 정적 자산

## 반입 금지

- `.ai-core/` starter-kit 사본
- 프로젝트용 `AGENTS.md`
- 회사 원본 문서
- 직원/고객 개인정보
- 재무·계좌 원본
- 사건/고소장/법무 증거
- runtime output/log/batch
- 배포 경계 설정·credential·secret

실제 template source가 이곳에 들어오는 순간에는 provenance, artifact parity, Document Hub binding, Work Map/capability route를 **같은 cutover 단위**로 전환해야 한다.
