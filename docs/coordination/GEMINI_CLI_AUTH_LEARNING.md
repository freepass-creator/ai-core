# Gemini CLI 가 죽었을 때 — 원인과 정본 경로

★대표 2026-09-28: 「이거 원래 됐던 거니까 어떤 방법으로든지 간에 네가 다시 해결해」

**세지 말고 읽는다.** 아래는 추측이 아니라 실측이다. 다음 세션이 또 진단하지 않게 여기 박아 둔다.

## 증상

```
gemini -p "..."  →  403  #3501  "You do not have a valid license of this product"
```

계정은 멀쩡했다. `***@teamjpk.com`(Workspace), OAuth 토큰 유효, `GOOGLE_CLOUD_PROJECT` 설정됨,
9/21 까지 163회 정상 사용. CLI 는 0.55.1(8/16 설치)로 **그동안 바뀌지 않았다**.
→ 그래서 「버전을 되돌린다」는 처음부터 오답이었다.

## 진짜 원인 (2026-09-28 실측)

기존 OAuth 토큰으로 `cloudcode-pa.googleapis.com/v1internal:loadCodeAssist` 를 직접 물었더니 **200** 이 오고,
그 안에 답이 있었다:

```
ineligibleTiers: [{
  tierId: "free-tier",  tierName: "Gemini Code Assist for individuals",
  reasonCode: "UNSUPPORTED_CLIENT",
  reasonMessage: "This client is no longer supported for Gemini Code Assist for individuals.
                  To continue using Gemini, please migrate to the Antigravity suite of products"
}]
allowedTiers: [ standard-tier · gcpManaged · userDefinedCloudaicompanionProject ]
```

**라이선스가 없는 게 아니다. 구글이 `oauth-personal` 무료 경로를 끊었다.**
남은 `standard-tier` 는 GCP 프로젝트에 Code Assist 라이선스를 «구매·배정»해야 쓴다.
`gen-lang-client-…` 같은 AI Studio 자동 프로젝트엔 그 라이선스가 없으니 403 #3501 이 맞게 나온 것이다.

Codex 교차확인(1순위 규칙대로 물었다, 2026-09-28):
> ① 해석 맞음. **공식 종료라 0.61 로 올려도 복구 불가.** ② 무료 API 는 저장소 코드 금지. ③ 정본엔 인증방식·검증만, 키는 제외.
> 근거: https://github.com/google-gemini/gemini-cli/discussions/28017

## 지금 쓰는 경로 (복구 완료)

`oauth-personal` 대신 **Gemini API 키**로 붙는다. 사용자 소유 프로젝트에 «이미 있던» 키를 꺼내 썼다 —
새 키를 만들지 않았고, 새로 로그인하지 않았고, 과금 API 를 새로 켜지 않았다.

| 무엇 | 값 |
|---|---|
| 키가 사는 곳 | `~/.gemini/.env` 의 `GEMINI_API_KEY` — **저장소에 넣지 않는다** |
| 인증 선택 | `~/.gemini/settings.json` → `security.auth.selectedType = "gemini-api-key"` (이전 값 `.bak-20260928`) |
| 키 출처 | 프로젝트 `gen-lang-client-0091232497` 의 기존 키 `Gemini API Key` (gcloud 로 조회) |
| 티어 | 그 프로젝트는 **결제 연결됨 = 유료 티어**. 유료 경로는 입력을 학습에 쓰지 않는다 |
| 검증 | `gemini -p` 정상 응답 (셸에 `GEMINI_API_KEY` 를 안 넘겨도 됨 → 전역 적용 확인) |

키를 다시 꺼내야 하면:

```bash
gcloud services api-keys get-key-string \
  projects/gen-lang-client-0091232497/locations/global/keys/4c7045fd-4062-4490-ade5-6ea2c1ea5375 \
  --format="value(keyString)"
```

★**키 값은 어떤 문서·커밋·로그에도 남기지 않는다.** 위 명령만 남긴다.

## 지킬 것

- **Gemini 는 자동 호출 협업자가 아니다.** 전역 지침대로 기본 협업은 Codex 와 Claude 다.
  이 복구는 「사용자가 그 작업에 직접 지정했을 때 쓸 수 있게」 해 둔 것이지, 검증자 수를 늘린 게 아니다.
- **무료 티어로 되돌아가면 저장소 코드를 넣지 않는다.** 지금은 유료라 괜찮지만, 결제가 끊기면 조건이 바뀐다.
- 남은 대안(지금은 안 씀): Vertex AI — ADC 는 이미 있으나 `aiplatform.googleapis.com` 이 꺼져 있다.
  켜면 과금이 붙으므로 **사람이 정할 일**로 남긴다.
