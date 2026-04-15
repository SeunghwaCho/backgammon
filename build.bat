@echo off
setlocal enabledelayedexpansion

set "PROJECT_ROOT=%~dp0"
if "%PROJECT_ROOT:~-1%"=="\" set "PROJECT_ROOT=%PROJECT_ROOT:~0,-1%"

set "RELEASE_DIR=%PROJECT_ROOT%\release"
set "DIST_DIR=%PROJECT_ROOT%\dist"

echo [1] TypeScript compile...
cd /d "%PROJECT_ROOT%"
call npx tsc -p tsconfig.json
if errorlevel 1 (
    echo ERROR: TypeScript compile failed.
    exit /b 1
)

echo [2] Clean release folder...
if exist "%RELEASE_DIR%" rd /s /q "%RELEASE_DIR%"
mkdir "%RELEASE_DIR%"

echo [3] Copy static files...
powershell -NoProfile -Command "(Get-Content '%PROJECT_ROOT%\index.html' -Raw) -replace 'dist/main\.js', 'main.js' | Set-Content '%RELEASE_DIR%\index.html' -NoNewline"
copy /y "%PROJECT_ROOT%\style.css" "%RELEASE_DIR%\" >nul

echo [4] Copy JS files (skip tests)...
for %%F in ("%DIST_DIR%\*.js") do (
    copy /y "%%F" "%RELEASE_DIR%\" >nul
)

for /d %%D in ("%DIST_DIR%\*") do (
    set "DNAME=%%~nxD"
    if /i not "!DNAME!"=="tests" (
        if not exist "%RELEASE_DIR%\!DNAME!" mkdir "%RELEASE_DIR%\!DNAME!"
        for %%F in ("%%D\*.js") do (
            copy /y "%%F" "%RELEASE_DIR%\!DNAME!\" >nul
        )
        echo    copied: dist\!DNAME!\
    ) else (
        echo    skipped: dist\tests\
    )
)

echo.
echo Build complete! Output: %RELEASE_DIR%
echo Open release\index.html in browser, or run: npx serve "%RELEASE_DIR%"

endlocal
