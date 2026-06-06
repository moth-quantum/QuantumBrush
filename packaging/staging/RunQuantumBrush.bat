@echo off
setlocal EnableExtensions
set "ROOT=%~dp0"
cd /d "%ROOT%"

if exist "%USERPROFILE%\.quantumbrush\config\python_path.txt" goto launch
if exist "%USERPROFILE%\.quantumbrush\env" goto launch

where bash >nul 2>&1
if errorlevel 1 (
    echo Git Bash is required for first-time setup on Windows.
    echo Install Git for Windows, then run Setup again.
    exit /b 1
)

bash -lc "cd '%ROOT%' && bash setup.sh --yes"

:launch
java -jar "%ROOT%QuantumBrush.jar" %*
