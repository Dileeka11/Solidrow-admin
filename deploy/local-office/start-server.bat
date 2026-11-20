@echo off
REM Solidrow local office server - other PCs open http://<this-PC-IP>:8000
cd /d "%~dp0..\..\backend"
php artisan serve --host=0.0.0.0 --port=8000
