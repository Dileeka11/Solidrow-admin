@echo off
REM Pushes candidate registrations to the live server. Keep this window running.
REM If it stops, queued registrations wait and are sent when it starts again.
cd /d "%~dp0..\..\backend"
:loop
php artisan queue:work --queue=sync,default --tries=0 --sleep=3 --max-time=3600
echo Worker stopped - restarting in 5 seconds...
timeout /t 5 /nobreak >nul
goto loop
