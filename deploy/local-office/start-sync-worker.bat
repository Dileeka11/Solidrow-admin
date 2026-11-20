@echo off
REM Solidrow sync - keep this window open.
REM  * sends this PC's registrations to the live server
REM  * every minute brings other PCs' changes down to this PC
REM Works offline too: everything waits and goes when internet is back.
cd /d "%~dp0..\..\backend"
start "Solidrow sync - pull (keep open)" /min cmd /c "php artisan schedule:work"
:loop
php artisan queue:work --queue=sync,default --tries=0 --sleep=3 --max-time=3600
echo Sync stopped - restarting in 5 seconds...
timeout /t 5 /nobreak >nul
goto loop
