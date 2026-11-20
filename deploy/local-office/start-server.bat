@echo off
REM Solidrow on this PC - open http://localhost:8000 in the browser.
cd /d "%~dp0..\..\backend"
php artisan serve --host=127.0.0.1 --port=8000
