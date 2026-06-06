param(
    [string]$Version = $(if ($env:QB_VERSION) { $env:QB_VERSION } else { "0.7.0" })
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Packaging = Join-Path $Root "packaging"
$Staging = Join-Path $Packaging "staging"
$InputDir = Join-Path $Packaging "input"
$Resources = Join-Path $Packaging "resources"
$Out = Join-Path $Packaging "out"
$TarballUrl = if ($env:QB_TARBALL_URL) { $env:QB_TARBALL_URL } else { "https://github.com/moth-quantum/QuantumBrush/archive/refs/heads/dist.tar.gz" }

function Info($msg) { Write-Host "[INFO] $msg" }
function Die($msg) { Write-Error $msg; exit 1 }

if (-not (Get-Command jpackage -ErrorAction SilentlyContinue)) {
    Die "jpackage is required. Install JDK 21+ and ensure jpackage is on PATH."
}

Remove-Item -Recurse -Force $Staging, $InputDir, $Resources, $Out -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $Staging, $InputDir, $Resources, $Out | Out-Null

Info "Staging QuantumBrush application files..."
$LocalJar = Join-Path $Root "QuantumBrush.jar"
if (Test-Path $LocalJar) {
    robocopy $Root $Staging /E /XD .git packaging\out packaging\staging packaging\input packaging\resources packaging\launcher\build | Out-Null
    if ($LASTEXITCODE -ge 8) { Die "Failed to stage local app files." }
} else {
    Info "QuantumBrush.jar not found locally; downloading dist tarball..."
    $TempTar = Join-Path $env:TEMP "quantumbrush-dist.tar.gz"
    Invoke-WebRequest -Uri $TarballUrl -OutFile $TempTar
    tar -xzf $TempTar -C $Staging --strip-components=1
    Remove-Item $TempTar -Force
}

if (-not (Test-Path (Join-Path $Staging "QuantumBrush.jar"))) {
    Die "QuantumBrush.jar missing from staged app."
}

Info "Building launcher.jar..."
$BuildDir = Join-Path $Packaging "launcher/build"
Remove-Item -Recurse -Force $BuildDir -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $BuildDir | Out-Null
javac (Join-Path $Packaging "launcher/Launcher.java") -d $BuildDir
jar --create --file (Join-Path $InputDir "launcher.jar") --main-class Launcher -C $BuildDir .

Copy-Item -Force (Join-Path $Staging "QuantumBrush.jar"), (Join-Path $Staging "setup.sh"), (Join-Path $Staging "update.sh") $InputDir
Copy-Item -Force (Join-Path $Staging "Setup.command"), (Join-Path $Staging "Update.command") $InputDir -ErrorAction SilentlyContinue
Copy-Item -Recurse -Force (Join-Path $Staging "effect") $InputDir
if (Test-Path (Join-Path $Staging "QuantumBrush_lib")) {
    Copy-Item -Recurse -Force (Join-Path $Staging "QuantumBrush_lib") $InputDir
}

Info "Building Windows .exe installer..."
jpackage `
    --name QuantumBrush `
    --app-version $Version `
    --vendor "MOTH Quantum" `
    --description "Creative image modification powered by quantum computing" `
    --copyright "Copyright 2025 MOTH Quantum" `
    --type exe `
    --dest $Out `
    --input $InputDir `
    --main-jar launcher.jar `
    --main-class Launcher `
    --win-dir-chooser `
    --win-menu `
    --win-shortcut `
    --win-shortcut-prompt

$ExeFile = Get-ChildItem -Path $Out -Filter "QuantumBrush*.exe" | Select-Object -First 1
if (-not $ExeFile) {
    Die "No .exe produced by jpackage."
}

$FinalExe = Join-Path $Out ("QuantumBrush-{0}-windows-x64.exe" -f $Version)
Move-Item -Force $ExeFile.FullName $FinalExe

if ($env:WINDOWS_SIGNING_CERT -and $env:WINDOWS_SIGNING_PASSWORD) {
    Info "Signing Windows artifact..."
    & signtool sign /fd SHA256 /f $env:WINDOWS_SIGNING_CERT /p $env:WINDOWS_SIGNING_PASSWORD $FinalExe
}

Info "Built $FinalExe"
Info "Windows packaging complete."
