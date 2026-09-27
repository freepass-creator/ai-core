@echo off
REM 상품 갱신 지킴이를 Windows 작업 스케줄러에서 부르는 자리.
REM
REM ★왜 .cmd 가 필요한가: schtasks 는 작업 폴더를 못 정한다. 여기서 정해 준다.
REM ★왜 Claude 가 아닌가: 2026-09-22~28, 앱 예약작업이 권한 승인 대기로 멈췄고
REM   그 멈춤이 이후 44회를 막았다. 이 판단에는 판단이랄 게 없어서 사람도 AI도 필요 없다.
REM
REM 로그는 .local\erp5-keeper.log (판단 한 줄) 과 .local\erp5-keeper.out (날것) 에 쌓인다.
cd /d C:\dev\ai-core
if not exist .local mkdir .local
node scripts\erp5-keeper.mjs --env-file C:\dev\freepass-admin\.env.local >> .local\erp5-keeper.out 2>&1
exit /b %ERRORLEVEL%
