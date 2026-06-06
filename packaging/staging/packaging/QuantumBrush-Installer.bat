@echo off
setlocal EnableExtensions
set "RELEASES_URL=https://github.com/moth-quantum/QuantumBrush/releases/latest"
set "TARBALL_URL=https://github.com/moth-quantum/QuantumBrush/archive/refs/heads/dist.tar.gz"
set "INSTALL_DIR=%USERPROFILE%\QuantumBrush"

echo.
echo ==============================================================
echo                   QuantumBrush Installer
echo ==============================================================
echo.
echo Prefer a native installer when available:
echo   %RELEASES_URL%
echo   Windows: QuantumBrush-*-windows-x64.exe
echo.

where curl >nul 2>&1
if errorlevel 1 (
    echo [ERROR] curl is required but not installed.
    exit /b 1
)

where tar >nul 2>&1
if errorlevel 1 (
    echo [ERROR] tar is required but not installed.
    exit /b 1
)

if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

echo [INFO] Downloading QuantumBrush...
curl -fsSL "%TARBALL_URL%" -o "%TEMP%\quantumbrush-dist.tar.gz"
if errorlevel 1 (
    echo [ERROR] Download failed.
    exit /b 1
)

tar -xzf "%TEMP%\quantumbrush-dist.tar.gz" -C "%INSTALL_DIR%" --strip-components=1
if errorlevel 1 (
    echo [ERROR] Extract failed.
    exit /b 1
)

del "%TEMP%\quantumbrush-dist.tar.gz" >nul 2>&1
echo [OK] QuantumBrush installed to %INSTALL_DIR%
echo.
set /p RUNSETUP="Run setup now to install Java and Python dependencies? (Y/n): "
if /I "%RUNSETUP%"=="n" goto skipsetup

where bash >nul 2>&1
if errorlevel 1 (
    echo [WARNING] bash not found. Install Git for Windows, then run:
    echo   cd "%INSTALL_DIR%" ^&^& bash setup.sh
    goto done
)

bash -lc "cd '%INSTALL_DIR%' && bash setup.sh"
goto done

:skipsetup
echo [WARNING] Setup skipped. Run later with:
echo   cd "%INSTALL_DIR%" ^&^& bash setup.sh

:done
echo.
echo [OK] Done!
echo To run QuantumBrush:
echo   cd "%INSTALL_DIR%"
echo   RunQuantumBrush.bat
echo.
pause
