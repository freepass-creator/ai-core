@echo off
REM aiops daily loop -- calls scripts/daily.mjs
REM
REM   ASCII ONLY in this file. cmd.exe decodes .cmd with the console codepage,
REM   so Korean filenames here get mangled and the batch dies with no log.
REM   The Korean-named script is imported from scripts/daily.mjs instead.
REM
REM   chcp 65001 -> UTF-8, otherwise the Korean log is unreadable mojibake.
REM
REM   remove:  Unregister-ScheduledTask -TaskName "aiops-daily" -Confirm:$false
chcp 65001 > nul
cd /d C:\dev\aiops
if not exist logs mkdir logs
echo ---- %DATE% %TIME% ---- >> logs\daily.log
node scripts\daily.mjs >> logs\daily.log 2>&1
set RC=%ERRORLEVEL%
echo ---- exit %RC% ---- >> logs\daily.log
REM   ---------------------------------------------------------------- watchdog
REM   The alert lives HERE, outside the work, on purpose. A .cmd keeps running
REM   after node dies -- even on a forced kill (0xC000013A), which is exactly
REM   what happened to aiops-light at 10:10 on 2026-09-16 with nobody told.
REM   An alert placed at the end of the .mjs dies together with the .mjs.
REM   The echo above is written by cmd.exe alone, so the exit code survives in
REM   the log even if node cannot start at all and the next line does nothing.
REM   The watchdog only mails on failure, and at most once a day for a repeat.
node scripts\jikimi-allim.mjs --jageop=aiops-daily --code=%RC% --bonaenda >> logs\jikimi.log 2>&1
REM   Hand the WORK's exit code (not the watchdog's) back to Task Scheduler.
exit /b %RC%
