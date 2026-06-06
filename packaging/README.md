# QuantumBrush Packaging

Native installers for macOS, Windows, and Ubuntu/Linux.

## Outputs

| Platform | Artifact | Build script |
|----------|----------|--------------|
| Ubuntu/Debian | `.deb` + `.iso` | `packaging/build-linux.sh` |
| macOS Intel | `.dmg` | `QB_ARCH=x86_64 packaging/build-macos.sh` |
| macOS Apple Silicon | `.dmg` | `QB_ARCH=arm64 packaging/build-macos.sh` |
| Windows | `.exe` | `packaging/build-windows.sh` (or `build-windows.ps1` wrapper) |

Fallback shell installers:

- `packaging/QuantumBrush-Installer.sh`
- `packaging/QuantumBrush-Installer.bat`

## Local build requirements

- JDK 21+ with `jpackage`, `javac`, and `jar`
- Linux ISO build also needs `xorriso`
- macOS signing/notarization needs Apple Developer credentials in env vars
- Windows signing needs Authenticode cert in env vars

## Build locally

```bash
export QB_VERSION=0.8.0
chmod +x packaging/build-linux.sh
./packaging/build-linux.sh
```

```bash
export QB_VERSION=0.8.0
export QB_ARCH=arm64   # or x86_64
chmod +x packaging/build-macos.sh
./packaging/build-macos.sh
```

```bash
export QB_VERSION=0.8.0
chmod +x packaging/build-windows.sh
./packaging/build-windows.sh
```

```powershell
$env:QB_VERSION = "0.8.0"
.\packaging\build-windows.ps1
```

Artifacts land in `packaging/out/`.

## Signing environment variables

### macOS

- `APPLE_SIGNING_IDENTITY`
- `APPLE_ID`
- `APPLE_APP_PASSWORD`
- `APPLE_TEAM_ID`

### Windows

- `WINDOWS_SIGNING_CERT`
- `WINDOWS_SIGNING_PASSWORD`

If these are unset, builds still succeed unsigned. Unsigned macOS `.dmg` files may trigger Gatekeeper warnings.

## How first launch works

Installers ship a small Java launcher (`packaging/launcher/Launcher.java`) that:

1. Detects whether Python/Java dependencies are configured
2. Runs `setup.sh --yes` automatically on first launch
3. Starts `QuantumBrush.jar`

This preserves the existing conda/Java automation for non-technical users.

- **macOS / Linux:** setup runs in the background on first launch — no terminal needed.
- **Windows:** setup runs via Git Bash. Users need [Git for Windows](https://git-scm.com/download/win) installed before first launch.

## CI release

Push a version tag to trigger `.github/workflows/release.yml`:

```bash
git tag v0.8.0
git push origin v0.8.0
```

Or run the workflow manually from GitHub Actions.

See `INSTALL_VERIFICATION.md` for hackathon screen-recording requirements.
