# freepass erp — 화면 시안 v0.1

상품몰 → 재고 → 계약 접수 → (공급사 확인 · 계약 · 출고) → 실적 → 정산 흐름 화면. 시작: [index.html](index.html)

- 부품: `../claude-v1.css` · 배치: `../startup-erp/erp-templates.css` (틀 T1–T6, 규격은 [../startup-erp/SPEC.md](../startup-erp/SPEC.md))
- 업무 기준: `docs/business/FREEPASS_MOBILITY_BUSINESS_KNOWLEDGE.md` — 재고는 공급사 확인이 정본, 모르는 금액은 «미확정», 수수료는 권한자만
- 상품 · 공급사 · 고객 · 금액은 모두 설명용 샘플이다(공급사명은 가상). 차량 이미지는 실루엣 SVG다.
- 캡처: `shots/` (1440px, `products-390.png`은 모바일 폭)
