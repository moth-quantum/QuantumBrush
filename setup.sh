#!/bin/bash
set +H

[ -t 1 ] && { R=$'\033[31m' G=$'\033[32m' Y=$'\033[33m' B=$'\033[34m' N=$'\033[0m'; }
: "${R:=}" "${G:=}" "${Y:=}" "${B:=}" "${N:=}"
info() { printf "${B}[INFO]${N} %s\n" "$1"; }
ok()   { printf "${G}[OK]${N} %s\n" "$1"; }
warn() { printf "${Y}[WARN]${N} %s\n" "$1"; }
die()  { printf "${R}[ERROR]${N} %s\n" "$1"; exit 1; }

ENV="$HOME/.quantumbrush/env"

case "$(uname -s)" in
    Darwin*)              OS=mac ;;
    Linux*)               OS=linux ;;
    MINGW*|MSYS*|CYGWIN*) OS=windows ;;
    *) die "Unsupported OS: $(uname -s)" ;;
esac

java_ok() {
    command -v java &>/dev/null || return 1
    [ "$(java -version 2>&1 | head -1 | cut -d'"' -f2 | cut -d. -f1)" -ge 11 ] 2>/dev/null
}

install_java() {
    info "Installing Java..."
    case "$OS" in
        mac)
            command -v brew &>/dev/null \
                || /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
            [ -f /opt/homebrew/bin/brew ] && export PATH="/opt/homebrew/bin:$PATH"
            brew install openjdk
            sudo ln -sfn "$(brew --prefix)/opt/openjdk/libexec/openjdk.jdk" \
                /Library/Java/JavaVirtualMachines/openjdk.jdk 2>/dev/null
            export PATH="$(brew --prefix)/opt/openjdk/bin:$PATH"
            ;;
        linux)
            if   command -v apt    &>/dev/null; then sudo apt update && sudo apt install -y openjdk-21-jdk
            elif command -v dnf    &>/dev/null; then sudo dnf install -y java-21-openjdk-devel
            elif command -v pacman &>/dev/null; then sudo pacman -S --noconfirm jdk-openjdk
            else die "Java not found. Install Java manually from Microsoft OpenJDK."
            fi
            ;;
        windows)
            command -v winget.exe &>/dev/null \
                || die "winget not found. Install Java manually: https://learn.microsoft.com/en-us/java/openjdk/download"
            info "A UAC prompt may appear — click Yes."
            winget.exe install Microsoft.OpenJDK.21 --accept-package-agreements --accept-source-agreements
            RESTART=true; return 0
            ;;
    esac
    java_ok && ok "Java installed" || die "Java installation failed"
}

require_conda() {
    if ! command -v conda &>/dev/null; then
        for p in \
            "$HOME/miniconda3/bin/conda" \
            "$HOME/anaconda3/bin/conda" \
            "$HOME/miniforge3/bin/conda" \
            "/opt/anaconda3/bin/conda" \
            "/opt/miniconda3/bin/conda" \
            "/opt/homebrew/Caskroom/miniconda/base/bin/conda"; do
            [ -f "$p" ] && { export PATH="$(dirname "$p"):$PATH"; break; }
        done
        if [ "$OS" = "windows" ]; then
            local win
            win=$(cygpath -u "$(cmd.exe /C 'echo %USERPROFILE%' 2>/dev/null | tr -d '\r')" 2>/dev/null)
            for p in \
                "$win/miniconda3/condabin/conda" \
                "$win/Miniconda3/condabin/conda" \
                "$win/anaconda3/condabin/conda" \
                "$win/AppData/Local/miniconda3/condabin/conda"; do
                [ -f "$p" ] && { export PATH="$(dirname "$p"):$PATH"; break; }
            done
        fi
    fi
    command -v conda &>/dev/null || return 1
    local base; base=$(conda info --base 2>/dev/null)
    [ -f "$base/etc/profile.d/conda.sh" ] && source "$base/etc/profile.d/conda.sh"
}

install_conda() {
    info "Installing Miniconda..."
    case "$OS" in
        mac|linux)
            local arch url
            arch=$(uname -m)
            case "$OS-$arch" in
                mac-arm64)     url="https://repo.anaconda.com/miniconda/Miniconda3-latest-MacOSX-arm64.sh" ;;
                mac-x86_64)    url="https://repo.anaconda.com/miniconda/Miniconda3-latest-MacOSX-x86_64.sh" ;;
                linux-x86_64)  url="https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh" ;;
                linux-aarch64) url="https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-aarch64.sh" ;;
                *) die "Unsupported architecture: $arch" ;;
            esac
            curl -fSL -o /tmp/mc.sh "$url" || die "Miniconda download failed"
            bash /tmp/mc.sh -b -p "$HOME/miniconda3" && rm /tmp/mc.sh
            require_conda || die "Miniconda init failed"
            ok "Miniconda installed"
            ;;
        windows)
            command -v winget.exe &>/dev/null \
                || die "winget not found. Install Miniconda manually: https://docs.anaconda.com/miniconda/"
            info "A UAC prompt may appear — click Yes."
            winget.exe install Anaconda.Miniconda3 --accept-package-agreements --accept-source-agreements
            RESTART=true
            ;;
    esac
}

setup_env() {
    require_conda || die "Conda not available"
    conda tos accept &>/dev/null || true

    [ -d "$ENV" ] && { warn "Removing existing environment..."; conda env remove -p "$ENV" -y; }

    info "Creating Python 3.11 environment..."
    conda create -p "$ENV" python=3.11 -y || die "Failed to create environment"

    local py
    if [ "$OS" = "windows" ]; then
        py="$ENV/Scripts/python.exe"
    else
        py="$ENV/bin/python"
    fi

    info "Installing core packages..."
    "$py" -m pip install \
        "numpy>=2.1.0" \
        "matplotlib>=3.7.0" \
        "scipy>=1.10.0" \
        "Pillow>=10.0.0" \
        "qiskit>=2.0.0" \
        "qiskit-ibm-runtime>=0.20.0" \
        "qiskit-aer>=0.17.0" \
        || die "Core package installation failed"
    ok "Core packages installed"

    "$py" -m pip install "pytest>=7.0.0" "black>=23.0.0" 2>/dev/null \
        || warn "Dev tools failed (non-critical)"

    if "$py" -m pip install "jax~=0.6.0" "jaxlib~=0.6.0"; then
        ok "JAX installed"
        "$py" -m pip install \
            "pennylane>=0.43.0,<0.44.0" "optax>=0.1.0,<0.2.0" "equinox" \
            || warn "PennyLane stack failed — Advanced quantum algorithms unavailable"
    else
        warn "JAX/jaxlib failed — common on some hardware. Most brushes are unaffected."
    fi

    # IQM hardware execution (optional). Installed in its own pip command so
    # the resolver doesn't have to balance iqm-client's heavy transitive deps
    # against the core scientific stack. Failure is non-fatal — the app still
    # works on the Aer simulator without iqm-client present.
    #
    # NOTE on the suppressed warning below: iqm-client 34.x requires
    # qiskit<2.2, which conflicts on paper with qiskit-ibm-runtime / samplomatic
    # / ibm-quantum-schemas (they declare qiskit>=2.2). For the current
    # QuantumBrush code path this is cosmetic — see HARDWARE.md in the source
    # branch for the rationale and the conditions under which it would stop
    # being cosmetic.
    info "Installing IQM client (optional, for hardware execution)..."
    "$py" -m pip install "iqm-client[qiskit]>=22.10,<35.0" 2>&1 \
        | grep -v -E '^(ERROR: pip'\''s dependency resolver does not currently take into account|(qiskit-ibm-runtime|samplomatic|ibm-quantum-schemas) [0-9.]+ requires qiskit[<>=!,. 0-9]+, but you have qiskit [0-9.]+ which is incompatible\.)'
    pip_ec=${PIPESTATUS[0]}
    if [ "$pip_ec" = "0" ] && "$py" -c "import iqm.qiskit_iqm" 2>/dev/null; then
        ok "IQM client installed"
    else
        warn "iqm-client[qiskit] not available — IQM hardware execution disabled. Aer simulator still works."
    fi

    local config_py
    if [ "$OS" = "windows" ]; then
        config_py=$(cygpath -w "$py" 2>/dev/null || echo "$py")
    else
        config_py="$py"
    fi
    mkdir -p config && echo "$config_py" > config/python_path.txt
    ok "Python path: $config_py"

    info "Verifying core packages..."
    if ! "$py" -c "import numpy, qiskit, qiskit_ibm_runtime, matplotlib, scipy, PIL"; then
        die "Core package verification failed"
    fi
    ok "Core packages verified"

    "$py" -c "import iqm.qiskit_iqm" 2>/dev/null \
        && ok "IQM client verified" || warn "IQM client not available (optional)"

    "$py" -c "import jax, pennylane, optax, equinox" 2>/dev/null \
        && ok "Advanced packages verified" || warn "Advanced packages not available (optional)"
}

echo
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    QuantumBrush Setup                        ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo

RESTART=false

if java_ok; then
    ok "Java $(java -version 2>&1 | head -1 | cut -d'"' -f2) found"
else
    printf "Java 11+ required. Install now? (Y/n): "
    read -r -n 1 REPLY; echo
    [[ $REPLY =~ ^[Nn]$ ]] && warn "QuantumBrush requires Java 11+" \
        || install_java || exit 1
fi

if require_conda; then
    ok "Conda found"
else
    printf "Miniconda required. Install now? (Y/n): "
    read -r -n 1 REPLY; echo
    [[ $REPLY =~ ^[Nn]$ ]] && warn "Conda is required for Python dependencies!" \
        || install_conda || exit 1
fi

if [ "$RESTART" = true ]; then
    echo
    echo "  Close this window, open a new terminal, then run ./setup.sh again."
    echo
    exit 0
fi

setup_env

echo
ok "Setup complete!"
printf "${B}To run:${N} Open up HOME/QuantumBrush/QuantumBrush.jar \n\n"