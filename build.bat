@echo off
rem build.bat - runs build.ps1

setlocal
for /f "tokens=2 delims=:." %%A in ('chcp') do set "OLDCP=%%A"
set "OLDCP=%OLDCP: =%"

chcp 949 > nul
set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

pushd "%ROOT%" || exit /b 1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\build.ps1" -ProjectRoot "%ROOT%"
set "EXITCODE=%ERRORLEVEL%"
popd

if defined OLDCP chcp %OLDCP% > nul
endlocal & exit /b %EXITCODE%
