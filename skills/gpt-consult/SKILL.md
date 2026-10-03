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

## 1-1. Codex 에게 «고치게» 맡기기 (workspace-write — 2026-10-03 B3Q 시험 3건)

```bash
codex exec -m gpt-5.5 -s workspace-write -C "<저장소 절대경로>" --skip-git-repo-check -o "<답변 파일>" "<실행 규칙> <오더>" < /dev/null
```
`gpt-6-astra` 도 된다. `<실행 규칙>` 앞머리는 아래 그대로 붙인다.

```text
[실행 규칙] 이 PC 의 Codex 샌드박스는 네트워크가 없다 — 네트워크가 필요한 단계(npm install·fetch·push·웹)는 하지 말고 BLOCKED_NETWORK: <필요한 것> 한 줄로 멈춰라, 추측해서 채우지 마라. PowerShell 에서 npm 은 npm.cmd. 파일은 UTF-8, 기존 줄끝 유지.
[위임 범위] git 쓰기 명령(add·mv·commit·push)·gh 는 쓰지 마라 — worktree 의 git 인덱스는 샌드박스 밖이다. 파일 이동은 파일시스템 이동으로만. 스테이징·기록·커밋·push·PR·#211·독립 검토는 부르는 세션이 한다.
```

`[위임 범위]` 가 없으면 Codex 가 git·#211·사전점검 같은 네트워크 단계에서 막혀 멈췄다(2026-10-03 devcenter 이동 실측).

- Windows elevated 샌드박스는 `-c sandbox_workspace_write.network_access=true` 를 줘도 네트워크가 막힌다(`EACCES`). 규칙 없이 맡기면 3분 재시도 끝에 조회 안 한 값을 써넣은 적이 있다. unelevated 는 명령 자체가 안 뜬다(`CreateProcessAsUserW 5`). 방화벽·실행정책 같은 시스템 보안 설정은 바꾸지 않는다.
- 네트워크가 필요한 단계(`npm ci`·fetch·자료 받기)는 부르는 세션이 먼저 하고, Codex 에게는 «고치기+시험»만 맡긴다. push·PR 은 부르는 세션이 한다.

| 시험 | 결과 |
| --- | --- |
| 코드 수정+npm test | 65초 완료 |
| 네트워크 필요 | 5초 BLOCKED_NETWORK(규칙 없을 땐 179초 후 추측값) |
| 150초 긴 명령 | 160초 완료 |

끝나면 부르는 세션이 diff·시험을 직접 확인한다(맡겼다 ≠ 됐다).

## 2. 화면 짝 대화 (Codex 앱 — `pc-screen`)
Claude 세션 하나 = Codex 앱의 같은 프로젝트 «짝 대화» 하나(첫 줄 = 이 세션 제목). 화면이 다른 세션·사람에게 쓰이고 있으면 1번으로.

## 3. 생각 상의 (무료 채팅)
아이디어·문안 같은 «생각»은 chatgpt.com · gemini.google.com 일반 채팅도 쓴다(화면). 어려운 결정만 추론 최고 단계.

## 지킬 것
- 질문엔 내 입장(동의·수정·반박·보류)과 근거를 먼저 적고 반례를 묻는다.
- 상대에겐 비식별 최소 맥락·정확한 질문·대상 revision 만 보낸다.
- 부른 사실과 답을 `C:\dev\ai-core\docs\coordination\CROSS_AI_LOG.md` 에 한 줄. 기록이 없으면 안 부른 것이다. 막힘·실패를 통과로 세지 않는다.
