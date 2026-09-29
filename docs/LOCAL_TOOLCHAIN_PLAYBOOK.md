# 로컬 공통 도구 운영 플레이북

상태: `ADOPTED_LOCAL`

대상: TeamJPK Windows 개발 PC

정본: 이 문서는 선택·사용·검증 규칙을 소유하고, 설치 여부는 `npm run tools:doctor`의 현재 관측을 따른다. 연결 계정과 권한 경계는 [`memory/TOOL_CONNECTIONS.md`](../memory/TOOL_CONNECTIONS.md)가 소유한다.

## 1. 먼저 하는 일

```powershell
npm run tools:doctor
npm run tools:doctor -- --json
```

`AVAILABLE`은 해당 버전 명령이 현재 셸에서 실행됐다는 뜻일 뿐 로그인, 프로젝트 연결, 운영 권한, 실제 업무 성공을 뜻하지 않는다. `MISSING`은 설치 부재, `BLOCKED`는 Windows 정책·권한 차단, `TIMEOUT`은 응답 없음, `FAILED`는 실행됐지만 버전 점검 실패다. 새 설치보다 프로젝트의 lockfile·로컬 binary(`npm exec`, `npx`, Gradle wrapper)를 우선한다.

## 2. 작업별 선택표

| 하고 싶은 일 | 1순위 | 같이 쓰는 도구 | 완료 증거 |
| --- | --- | --- | --- |
| Git 상태·브랜치·PR | `git`, `gh`, `rg` | `fd`, `jq`, `7z` | exact revision, diff, 원격 readback, CI |
| Node/웹 개발 | 프로젝트 `npm` script | `node`, `npm`/`pnpm`/`yarn`/`bun` | lockfile 기준 install, test, build |
| Python 작업 | 프로젝트 venv + `uv` | `python`, `pipx` | 고정 dependency, test, 출력 재조회 |
| 브라우저 탐색·UI 확인 | `agent-browser` | Playwright | 실제 URL, snapshot/screenshot, console/error 상태 |
| 반복 E2E·다중 브라우저 | 프로젝트 Playwright | Chromium/Firefox/WebKit | exact revision의 재현 가능한 test result |
| JSON·파일 탐색 | `jq`, `rg`, `fd` | SQLite | 입력 범위, 행/키 수, 출력 재조회 |
| 문서 변환 | Pandoc | LibreOffice, Poppler | 생성 파일 + 렌더링 페이지 육안 검사 |
| PDF 검사 | Poppler (`pdftotext`, `pdftoppm`) | LibreOffice | 텍스트 추출 + 페이지 이미지 검사 |
| 이미지 작업 | ImageMagick | 원본 보존 | 치수/형식 확인 + 결과 이미지 검사 |
| 영상·음성 변환 | FFmpeg | `ffprobe` | codec/duration 확인 + 샘플 재생 |
| Firebase | 프로젝트 script/SDK | Firebase CLI, gcloud | 대상 project 확인, dry-run/emulator, 운영 readback |
| Vercel | Git 배포 경로 | Vercel CLI | deployment URL, SHA, 실제 route 확인 |
| 컨테이너 | Docker CLI | Docker Desktop/원격 daemon | `docker version`의 Client와 Server 모두 확인 |
| Kubernetes | `kubectl` | Helm | current-context, diff/template, rollout/readback |
| IaC | Terraform | gcloud/kubectl | `fmt`, `validate`, `plan`; apply는 별도 승인 |
| Android | Gradle wrapper | Java, adb | build 결과 + 실제 기기/emulator 확인 |
| AI 자문 | Codex + Claude | 사용자가 직접 지정할 때만 Gemini/Cursor | 대상 revision, 실제 답, 종료코드, 이견 기록 |
| Google Workspace | `gws` 프로필 | Drive connector | 계정·파일 ID·범위·수정시각 고정, 수정 후 readback |

## 3. 핵심 실행법

### 브라우저

단발 탐색은 `agent-browser`를 사용한다.

```powershell
agent-browser --session qa open http://localhost:3000
agent-browser --session qa wait --load networkidle
agent-browser --session qa snapshot -i
agent-browser --session qa screenshot --full-page artifacts/page.png
agent-browser --session qa close
```

회귀 검사는 프로젝트가 고정한 Playwright 버전과 설정을 사용한다. 전역 `playwright`는 새 프로젝트 진단용이지 프로젝트 lockfile을 덮는 정본이 아니다. 브라우저 한 종류가 정책에 막히면 다른 브라우저 성공을 전체 PASS로 확대하지 않고 해당 엔진을 `HOLD_BROWSER_<ENGINE>`으로 남긴다.

### 문서·PDF·미디어

```powershell
pandoc input.md -o output.docx
soffice --headless --convert-to pdf --outdir out output.docx
pdftoppm -png out/output.pdf out/page
magick identify out/page-1.png
ffprobe -v error -show_format -show_streams media.mp4
```

변환 명령 성공만으로 완료하지 않는다. DOCX/PDF는 페이지 렌더링, 이미지·영상은 치수·codec·duration과 실제 결과를 확인한다. 원본은 덮어쓰지 않는다.

### 클라우드·인프라

```powershell
firebase projects:list
gcloud config list
vercel whoami
docker version
kubectl config current-context
helm template <release> <chart>
terraform fmt -check
terraform validate
terraform plan
```

로그인 확인은 쓰기 권한이 아니다. `deploy`, `apply`, `kubectl apply`, `helm upgrade`, 운영 DB 변경은 대상·revision·환경·rollback을 고정하고 기존 승인 경계를 따른다. RTDB는 영구 폐기 정책 때문에 설치 여부와 관계없이 사용하지 않는다.

### AI·Workspace

Claude는 `npm run claude:status` 후 아래 고정 형식으로 호출한다. `--root`는 Claude 프로세스의 실제 작업 디렉터리이고 `--prompt`는 질문이다. 알 수 없는 옵션과 값 누락은 게이트가 즉시 거부한다.

```powershell
npm run claude:review -- --root C:\dev\target-repo --prompt "대상 revision과 요구사항을 기준으로 읽기 전용 검토해 줘"
```

현재 저장소만 검토할 때는 `npm run claude:review -- -p "질문"`도 허용한다. 실제 답변 본문과 종료코드 0이 함께 있어야 검토 완료다. 자세한 실패 구분은 [`AI-CLI연동.md`](../aiops/docs/aiknowhow/AI-CLI연동.md)를 따른다. Google Workspace는 `gws`, `gws-collab`, `gws-admin`의 정해진 범위를 재사용하며 로그인 계정과 원문 접근을 추정하지 않는다. 외부 발송·수정·삭제·공유는 별도 승인 대상이다.

## 4. 공통 실패 처리

1. `Get-Command <도구>`와 `<도구> --version`을 분리해 PATH와 실행 실패를 구분한다.
2. 새 터미널에서 다시 확인한다. 설치 직후 기존 셸은 갱신된 PATH를 모를 수 있다.
3. 전역 버전보다 프로젝트 wrapper와 lockfile을 우선한다.
4. `BLOCKED`면 재설치 반복 대신 Windows Application Control, 관리자 권한, 실행 위치를 구분한다.
5. CLI 존재, 로그인, 대상 연결, 권한, 실제 실행, 운영 결과를 각각 별도 상태로 기록한다.
6. 자격 증명·토큰·고객 원문은 명령행, 로그, 문서, AI 프롬프트에 넣지 않는다.

## 5. 완료 기록

도구를 쓴 작업에는 도구 목록보다 다음을 남긴다.

- 대상 repo/source와 exact revision 또는 파일 ID·범위
- 실제 실행 명령과 성공/실패 상태
- 생성물·화면·원격 상태의 readback
- 정책 차단·미로그인·미검증 엔진 등 HOLD
- `next_start_here`

이 PC에서 확인된 설치 목록은 환경 힌트일 뿐 다른 PC의 정본이 아니다. `tools:doctor` 결과를 현재 세션에서 다시 관측한다.
