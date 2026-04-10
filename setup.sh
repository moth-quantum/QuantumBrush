#!/bin/bash
# QuantumBrush Setup Script
# Installs Java and Python dependencies for QuantumBrush
# Supports macOS, Linux, and Windows (Git Bash)

# ── Color / output helpers ───────────────────────────────────────────
if [ -t 1 ] && command -v tput > /dev/null; then
    ncolors=$(tput colors 2>/dev/null)
    if [ -n "$ncolors" ] && [ "$ncolors" -ge 8 ]; then
        BOLD="$(tput bold)" NORMAL="$(tput sgr0)"
        RED="$(tput setaf 1)" GREEN="$(tput setaf 2)"
        YELLOW="$(tput setaf 3)" BLUE="$(tput setaf 4)"
    fi
fi
: "${RED:=}" "${GREEN:=}" "${YELLOW:=}" "${BLUE:=}" "${BOLD:=}" "${NORMAL:=}"

info()    { printf "${BLUE}[INFO]${NORMAL} %s\n" "$1"; }
success() { printf "${GREEN}[OK]${NORMAL} %s\n" "$1"; }
warn()    { printf "${YELLOW}[WARNING]${NORMAL} %s\n" "$1"; }
err()     { printf "${RED}[ERROR]${NORMAL} %s\n" "$1"; }

# ── OS detection (run once, used everywhere) ─────────────────────────
detect_os() {
    case "$(uname -s)" in
        Darwin*)          OS_TYPE="macos"   ;;
        Linux*)           OS_TYPE="linux"   ;;
        MINGW*|MSYS*|CYGWIN*) OS_TYPE="windows" ;;
        *)
            err "Unsupported operating system: $(uname -s)"
            exit 1
            ;;
    esac
}

# ── Java ─────────────────────────────────────────────────────────────
check_java() {
    if ! command -v java &> /dev/null; then
        return 1
    fi
    JAVA_VER=$(java -version 2>&1 | head -n 1 | cut -d'"' -f2 | cut -d'.' -f1)
    [ "$JAVA_VER" -ge 11 ] 2>/dev/null
}

install_java() {
    info "Installing Java..."

    case "$OS_TYPE" in
        macos)
            if ! command -v brew &> /dev/null; then
                info "Installing Homebrew first..."
                /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
                [ -f "/opt/homebrew/bin/brew" ] && export PATH="/opt/homebrew/bin:$PATH"
            fi
            brew install openjdk
            # Link so macOS can find it
            sudo ln -sfn "$(brew --prefix)/opt/openjdk/libexec/openjdk.jdk" \
                /Library/Java/JavaVirtualMachines/openjdk.jdk 2>/dev/null
            local brew_prefix
            brew_prefix="$(brew --prefix)"
            export PATH="$brew_prefix/opt/openjdk/bin:$PATH"
            ;;
        linux)
            if command -v apt &> /dev/null; then
                sudo apt update && sudo apt install -y openjdk-21-jdk
            elif command -v dnf &> /dev/null; then
                sudo dnf install -y java-21-openjdk-devel
            elif command -v pacman &> /dev/null; then
                sudo pacman -S --noconfirm jdk-openjdk
            else
                err "Could not detect package manager. Please install Java 11+ manually."
                return 1
            fi
            ;;
        windows)
            if ! command -v winget.exe &> /dev/null; then
                err "winget is not available."
                echo
                echo "  It may not be registered yet. Try running this in PowerShell:"
                echo "    Add-AppxPackage -RegisterByFamilyName -MainPackage Microsoft.DesktopAppInstaller_8wekyb3d8bbwe"
                echo "  Then re-run this script."
                echo
                echo "  If that doesn't work, install Java manually:"
                echo "    https://learn.microsoft.com/en-us/java/openjdk/download"
                return 1
            fi
            info "A Windows permission prompt may appear — click Yes."
            winget.exe install Microsoft.OpenJDK.21 --accept-package-agreements --accept-source-agreements
            NEEDS_RESTART=true
            return 0
            ;;
    esac

    # Verify (not reached on Windows — they need a restart)
    if check_java; then
        success "Java installed successfully"
    else
        err "Java installation failed. Please install Java 11+ manually."
        return 1
    fi
}

# ── Conda ────────────────────────────────────────────────────────────
find_conda() {
    command -v conda &> /dev/null && return 0

    # Check common installation paths
    local paths=(
        "$HOME/miniconda3/bin/conda"
        "$HOME/anaconda3/bin/conda"
        "$HOME/miniforge3/bin/conda"
        "/opt/homebrew/Caskroom/miniconda/base/bin/conda"
        "/opt/miniconda3/bin/conda"
        "/usr/local/miniconda3/bin/conda"
    )

    # Windows-specific paths (Git Bash maps C:\Users\x to /c/Users/x)
    if [ "$OS_TYPE" = "windows" ]; then
        local win_user
        win_user=$(cmd.exe /C "echo %USERPROFILE%" 2>/dev/null | tr -d '\r')
        if [ -n "$win_user" ]; then
            # Convert Windows path to Git Bash path
            local unix_profile
            unix_profile=$(cygpath -u "$win_user" 2>/dev/null || echo "")
            if [ -n "$unix_profile" ]; then
                paths+=(
                    "$unix_profile/miniconda3/condabin/conda"
                    "$unix_profile/Miniconda3/condabin/conda"
                    "$unix_profile/anaconda3/condabin/conda"
                    "$unix_profile/AppData/Local/miniconda3/condabin/conda"
                )
            fi
        fi
    fi

    for p in "${paths[@]}"; do
        if [ -f "$p" ]; then
            local conda_dir
            conda_dir="$(dirname "$p")"
            export PATH="$conda_dir:$PATH"
            return 0
        fi
    done
    return 1
}

init_conda() {
    find_conda || return 1

    local base
    base=$(conda info --base 2>/dev/null)
    if [ -n "$base" ] && [ -f "$base/etc/profile.d/conda.sh" ]; then
        source "$base/etc/profile.d/conda.sh"
    fi
}

install_miniconda() {
    info "Installing Miniconda..."

    case "$OS_TYPE" in
        macos|linux)
            local arch
            arch=$(uname -m)
            local url=""

            if [ "$OS_TYPE" = "macos" ]; then
                [ "$arch" = "arm64" ] && url="https://repo.anaconda.com/miniconda/Miniconda3-latest-MacOSX-arm64.sh"
                [ "$arch" = "x86_64" ] && url="https://repo.anaconda.com/miniconda/Miniconda3-latest-MacOSX-x86_64.sh"
            else
                [ "$arch" = "x86_64" ] && url="https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh"
                [ "$arch" = "aarch64" ] && url="https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-aarch64.sh"
            fi

            if [ -z "$url" ]; then
                err "Unsupported architecture: $arch"
                return 1
            fi

            local installer="/tmp/miniconda_installer.sh"
            info "Downloading Miniconda for $OS_TYPE ($arch)..."
            curl -fSL -o "$installer" "$url" || { err "Download failed"; return 1; }

            bash "$installer" -b -p "$HOME/miniconda3"
            rm -f "$installer"

            init_conda || { err "Miniconda installation failed"; return 1; }
            success "Miniconda installed"
            ;;
        windows)
            if ! command -v winget.exe &> /dev/null; then
                err "winget is not available."
                echo
                echo "  Install Miniconda manually:"
                echo "    https://docs.anaconda.com/miniconda/"
                return 1
            fi
            info "A Windows permission prompt may appear — click Yes."
            winget.exe install Anaconda.Miniconda3 --accept-package-agreements --accept-source-agreements
            NEEDS_RESTART=true
            ;;
    esac
}

# ── Conda environment ────────────────────────────────────────────────
setup_conda_env() {
    info "Setting up Python environment..."

    # Initialize conda for this shell session
    if ! init_conda; then
        err "Could not initialize conda"
        return 1
    fi

    # Remove existing env if present
    if conda env list 2>/dev/null | grep -q "^quantumbrush "; then
        warn "Environment 'quantumbrush' already exists. Recreating..."
        conda env remove -n quantumbrush -y
    fi

    # Accept ToS if the command exists (newer Anaconda versions)
    conda tos accept 2>/dev/null || true

    info "Creating conda environment: quantumbrush (Python 3.11)"
    conda create -n quantumbrush python=3.11 -y

    info "Installing dependencies via conda..."
    conda install -n quantumbrush -c conda-forge -y \
        "numpy>=2.1.0" \
        "matplotlib>=3.7.0" \
        "scipy>=1.10.0"

    info "Installing dependencies via pip..."
    conda run -n quantumbrush pip install \
        "Pillow>=10.0.0" \
        "qiskit>=2.0.0" \
        "qiskit-ibm-runtime>=0.20.0" \
        "qiskit-aer>=0.17.0" \
        "pytest>=7.0.0" \
        "black>=23.0.0" \
        "matplotlib>=3.10.0" \
        "jax~=0.6.0" \
        "jaxlib~=0.6.0" \
        "pennylane>=0.43.0,<0.44.0" \
        "optax>=0.1.0,<0.2.0" \
        "equinox"

    # Save Python path for QuantumBrush
    local py_path
    py_path=$(conda run -n quantumbrush which python)
    if [ -n "$py_path" ]; then
        mkdir -p "config"
        echo "$py_path" > "config/python_path.txt"
        success "Python path saved: $py_path"
    fi

    # Verify all key packages
    info "Verifying packages..."
    if conda run -n quantumbrush python -c \
        "import numpy, qiskit, qiskit_ibm_runtime, matplotlib, scipy, PIL, jax, pennylane, optax, equinox; print('All packages verified')" \
        2>/dev/null; then
        success "All packages installed correctly"
    else
        warn "Some packages may not have installed correctly"
    fi
}

# ── Main ─────────────────────────────────────────────────────────────
main() {
    printf "\n"
    printf "╔══════════════════════════════════════════════════════════════╗\n"
    printf "║                    QuantumBrush Setup                       ║\n"
    printf "╚══════════════════════════════════════════════════════════════╝\n"
    printf "\n"

    detect_os
    NEEDS_RESTART=false

    # ── Step 1: Java ──
    if check_java; then
        success "Java $(java -version 2>&1 | head -n 1 | cut -d'"' -f2) is installed"
    else
        read -p "Java 11+ is required. Install automatically? (Y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Nn]$ ]]; then
            warn "Java installation skipped. QuantumBrush requires Java 11+."
        elif ! install_java; then
            err "Java installation failed."
            exit 1
        fi
    fi

    # ── Step 2: Conda ──
    if find_conda; then
        success "Conda is installed"
    else
        read -p "Miniconda is required for Python dependencies. Install automatically? (Y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Nn]$ ]]; then
            warn "Miniconda installation skipped."
        elif ! install_miniconda; then
            err "Miniconda installation failed."
            exit 1
        fi
    fi

    # ── Windows: restart required after winget installs ──
    if [ "$NEEDS_RESTART" = true ]; then
        echo
        printf "╔══════════════════════════════════════════════════════════════╗\n"
        printf "║                       Next Steps                            ║\n"
        printf "╠══════════════════════════════════════════════════════════════╣\n"
        printf "║  Tools have been installed, but your current terminal       ║\n"
        printf "║  doesn't know about them yet.                               ║\n"
        printf "║                                                              ║\n"
        printf "║  Please:                                                     ║\n"
        printf "║    1. Close this Git Bash window                             ║\n"
        printf "║    2. Open a new Git Bash window                             ║\n"
        printf "║    3. Run:  cd ~/QuantumBrush && ./setup.sh                  ║\n"
        printf "║                                                              ║\n"
        printf "║  The script will pick up where it left off.                  ║\n"
        printf "╚══════════════════════════════════════════════════════════════╝\n"
        echo
        exit 0
    fi

    # ── Step 3: Python environment ──
    if ! setup_conda_env; then
        err "Python environment setup failed."
        exit 1
    fi

    # ── Done ──
    echo
    success "QuantumBrush setup completed!"
    echo
    printf "%sTo run QuantumBrush:%s\n" "$BLUE" "$NORMAL"
    printf "  java -jar QuantumBrush.jar\n"
    echo
}

main "$@"
