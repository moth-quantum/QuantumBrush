# Install Verification Checklist

Use this checklist when submitting a hackathon entry or validating a release build.

## Required recording

Record your screen from download through first successful brush run. The video must show:

1. Download from the official GitHub Releases page only
2. File hash or exact release filename visible in browser
3. Native installer launch (`.dmg`, `.exe`, `.deb`, or `.iso`)
4. First-launch dependency setup completing without manual terminal commands
5. QuantumBrush opening from Applications / Start Menu / app menu
6. Importing an image and running at least one brush stroke

## Platform-specific checks

### macOS

- Download `QuantumBrush-*-macos-apple-silicon.dmg` or `QuantumBrush-*-macos-intel.dmg`
- Open the `.dmg`, drag QuantumBrush to Applications
- Launch from Applications
- If Gatekeeper appears, confirm the app is signed/notarized for release builds
- Do not use `xattr -cr` or other security bypasses in the demo video

### Windows

- Download `QuantumBrush-*-windows-x64.exe`
- Run the installer and accept the Start Menu shortcut
- Launch QuantumBrush from Start Menu
- On first launch, allow Git Bash / setup prompts if shown

### Ubuntu / Linux

- Preferred: install `QuantumBrush-*-linux-amd64.deb`
- Alternative: mount `QuantumBrush-*-ubuntu-amd64.iso` and run `./install-quantumbrush.sh`
- Launch QuantumBrush from the applications menu

## Fallback shell installer

If native packages are unavailable, use:

- `QuantumBrush-Installer.sh` on macOS/Linux
- `QuantumBrush-Installer.bat` on Windows

These remain supported for developers, but hackathon demos should prefer native installers.

## What counts as failure

- Download from unofficial mirror
- Manual `pip install`, `conda create`, or `java -jar` steps required before the app opens
- Security bypass instructions (`xattr`, disabling Gatekeeper, unsigned unknown publisher ignored permanently)
- App crashes during first launch setup

## Maintainer release checklist

1. Tag release: `git tag vX.Y.Z && git push origin vX.Y.Z`
2. Confirm GitHub Actions `Release Installers` workflow succeeds
3. Verify all platform assets uploaded to Releases
4. Test one signed build on macOS before announcing
5. Keep `QuantumBrush-Installer.sh` attached as fallback only
