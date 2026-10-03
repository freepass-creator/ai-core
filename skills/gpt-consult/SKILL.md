---
name: gpt-consult
description: 다른 AI(GPT·Codex)와 상의·독립 검토가 필요할 때 — 설계·규격 결정, 되돌리기 어려운 변경, 반례가 필요한 판단, 중요한 문안, PR 병합 전 검토. 혼자 결정하지 말고 상대 의견을 받아 동의·수정·반박·보류로 정리한다.
---

# GPT·Codex 상의

★대표: 「혼자만 하지 말고 GPT 랑 같이」. 상의는 «생각나면»이 아니라 «처음에 확인하는 것»이다.

## 1. 명령줄 (기록이 남는 기본 길 — 2026-10-03 여러 번 실행 확인)
```bash
codex exec -s read-only -m gpt-5.5 -C "<대상 저장소 절대경로>" --skip-git-repo-check -o "<답변 파일>" "<읽기 전용 질문>" < /dev/null
```
- `exit 0` + 비어 있지 않은 답변 파일 둘 다 있어야 ANSWERED.
- `-m` 은 빼지 않는다. 지금 운영 기본값은 `gpt-5.5` — `~/.codex/config.toml` 의 기본 모델이 계정에서 거부(400)된 적이 있어 호출에 적는다. 거부되면 그 사실을 FAILED 로 적고 다른 지원 모델로 다시 부른다.
- 검토 호출에 `workspace-write`·`--full-auto`·파일 수정 요청을 쓰지 않는다.
- 공용 기록까지: AI Core 에서 `npm run duo -- ask --to codex --about "<제목>" --body "<질문>" --now`.

## 2. 화면 짝 대화 (Codex 앱 — `pc-screen`)
Claude 세션 하나 = Codex 앱의 같은 프로젝트 «짝 대화» 하나(첫 줄 = 이 세션 제목). 화면이 다른 세션·사람에게 쓰이고 있으면 1번으로.

## 3. 생각 상의 (무료 채팅)
아이디어·문안 같은 «생각»은 chatgpt.com · gemini.google.com 일반 채팅도 쓴다(화면). 어려운 결정만 추론 최고 단계.

## 지킬 것
- 질문엔 내 입장(동의·수정·반박·보류)과 근거를 먼저 적고 반례를 묻는다.
- 상대에겐 비식별 최소 맥락·정확한 질문·대상 revision 만 보낸다.
- 부른 사실과 답을 `C:\dev\ai-core\docs\coordination\CROSS_AI_LOG.md` 에 한 줄. 기록이 없으면 안 부른 것이다. 막힘·실패를 통과로 세지 않는다.
