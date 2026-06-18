@echo off
echo Starting original legacy Quantum Brush (pre-PR)...
cd /d "%~dp0"
"C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot\bin\java.exe" -jar temp-legacy\build\quantumbrush.jar
pause
