@echo off
setlocal EnableExtensions
set "ROOT=%~dp0"
cd /d "%ROOT%"

where bash >nul 2>&1
if not errorlevel 1 (
    bash "%ROOT%RunQuantumBrush.sh" %*
    exit /b %ERRORLEVEL%
)

if exist "%USERPROFILE%\.quantumbrush\config\python_path.txt" goto launch
if exist "%USERPROFILE%\.quantumbrush\env" goto launch

echo Git Bash is required for first-time setup on Windows.
echo Install Git for Windows, then run QuantumBrush again.
exit /b 1

:launch
java -jar "%ROOT%QuantumBrush.jar" %*
