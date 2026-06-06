param(
    [string]$Version = $(if ($env:QB_VERSION) { $env:QB_VERSION } else { "0.7.0" })
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$env:QB_VERSION = $Version

if (-not (Get-Command bash -ErrorAction SilentlyContinue)) {
    Write-Error "bash is required. Install Git for Windows or use WSL."
    exit 1
}

& bash "$Root/packaging/build-windows.sh"
