# quality — Quality / Delivery Hub backing assets

상태: 기존 물리 경로를 유지하는 과도기 backing asset이다. Hub 조직 진입점은 `../hubs/quality/README.md`와 `../hubs/delivery/README.md`다.

- `conformance`: **Quality Hub** — 기준과 구현의 양방향 대조
- `testing`: **Quality Hub** — 수용·회귀·변경 영향 검증 증거 생성
- `release-recovery`: **Delivery Hub** — 실제 승인 확인·반영 결과·복구 검증

물리 디렉터리 이동은 별도 migration에서 다룬다. 폴더 위치 때문에 Quality Hub와 Delivery Hub 책임을 다시 합치지 않는다.

파트를 활성화할 때 책임자·입출력·원본 참조·실행 진입점·완료 기준을 명시한다. 기존 원본은 이동·복제하지 않는다.
