@echo off
REM aiops watchdog -- "did the scheduled work run at all?" pass
REM
REM   Exit codes catch a task that FAILED. They cannot catch a task that never
REM   STARTED (disabled, PC off, skipped on a power/network condition) -- there
REM   is no exit code at all in that case. This pass reads the last-success
REM   times in logs\jikimi-maekbak.json and mails when one is too old.
REM
REM   It is a SEPARATE process from the work it watches, on purpose: the whole
REM   point is that it still runs when the watched task did not.
REM
REM   NOT REGISTERED. The owner enables scheduled tasks one at a time; this file
REM   is the thing to register when that happens. Suggested (NOT applied):
REM     schtasks /create /tn "aiops-jikimi" /tr "C:\dev\aiops\scripts\jikimi.cmd" /sc daily /st 09:30
REM   09:30 = after staff arrive, so the mail is read the same morning.
REM   Before enabling, flip the matching "jikyeobonda" row in lib/jikimi.mjs to true.
REM
REM   ASCII ONLY in this file. cmd.exe decodes .cmd with the console codepage,
REM   so Korean filenames here get mangled and the batch dies with no log.
REM   Korean text lives inside the .mjs, which node reads as UTF-8.
REM
REM   chcp 65001 -> UTF-8, otherwise the Korean log is unreadable mojibake.
REM
REM   remove:  Unregister-ScheduledTask -TaskName "aiops-jikimi" -Confirm:$false
chcp 65001 > nul
cd /d C:\dev\aiops
if not exist logs mkdir logs
echo ---- %DATE% %TIME% (jikimi stale check) ---- >> logs\jikimi.log
node scripts\jikimi-jeomgeom.mjs --bonaenda >> logs\jikimi.log 2>&1
set RC=%ERRORLEVEL%
echo ---- exit %RC% ---- >> logs\jikimi.log
REM   Hand the node exit code back to Task Scheduler (see docs KH-019).
exit /b %RC%
