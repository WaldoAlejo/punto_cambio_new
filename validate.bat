@echo off
cd /d "%~dp0"
echo.
echo === VALIDANDO SALDOS ===
echo.
npx ts-node scripts\validate\validate-all-saldos-comprehensive.ts
pause
