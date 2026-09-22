# Design Lock / Last-known-good v1

## 목적

대표 시안 또는 화면 디자인이 승인된 뒤, 이후 변경이 디자인 언어를 다시 흔들지 않도록 **승인된 기준을 exact revision과 증거에 묶어 고정**한다.

## 원칙

- 사용자 또는 권한 있는 검토자의 명시적 승인 증거 없이는 Design Lock 생성 금지
- 대상 project revision과 AI Core revision을 exact 40-char SHA로 고정
- 승인된 Design Plan과 렌더/검수 source ref를 보존
- 다음 Lock은 `previous_lock_ref`를 통해 이전 last-known-good와 연결
- rollback은 임의 기억이 아니라 이전 Lock을 기준으로 수행
- Lock이 존재해도 제품 코드가 실제로 그 디자인과 동일하다는 뜻은 아니며 Quality Receipt로 재검증해야 함

## 정본

- Contract: `contracts/design-lock.schema.json`
- Runtime: `scripts/design-lock.mjs`
- Test definitions: `test/design-lock.test.mjs`

## 사용

```powershell
node scripts/design-lock.mjs finalize design-lock-draft.json design-lock.json
node scripts/design-lock.mjs validate design-lock.json
```

Design Lock은 디자인 승인/복구 기준이며 production deploy 승인 자체는 아니다. 배포는 Delivery Hub 경계를 따른다.
