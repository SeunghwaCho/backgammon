@echo off
rem build.bat - runs build.ps1
chcp 65001 > nul
set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\build.ps1" -ProjectRoot "%ROOT%"
