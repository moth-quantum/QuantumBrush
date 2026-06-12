@echo off
setlocal

set "APP_DIR=%~dp0"
set "INSTALL_DIR=%USERPROFILE%\QuantumBrush"

if not exist "%INSTALL_DIR%" (
  mkdir "%INSTALL_DIR%" >nul 2>nul
  xcopy "%APP_DIR%*" "%INSTALL_DIR%\" /E /I /Y >nul
)

if not exist "%INSTALL_DIR%\config\python_path.txt" (
  echo QuantumBrush is not set up yet. Starting setup...
  pushd "%INSTALL_DIR%"
  bash setup.sh
  popd
  exit /b %ERRORLEVEL%
)

java -jar "%INSTALL_DIR%\QuantumBrush.jar"
