#!/bin/bash
# QuantumBrush Setup Script
# Installs Java and Python dependencies for QuantumBrush

# Determine if terminal supports colors
if [ -t 1 ]; then
  if command -v tput > /dev/null; then
    ncolors=$(tput colors)
    if [ -n "$ncolors" ] && [ "$ncolors" -ge 8 ]; then
      BOLD="$(tput bold)"
      NORMAL="$(tput sgr0)"
      RED="$(tput setaf 1)"
      GREEN="$(tput setaf 2)"
      YELLOW="$(tput setaf 3)"
      BLUE="$(tput setaf 4)"
    fi
  fi
fi

# Fallback if tput doesn't work
if [ -z "$RED" ]; then
  BOLD=""
  NORMAL=""
  RED=""
  GREEN=""
  YELLOW=""
  BLUE=""
fi

# Functions for output
print_step() {
    printf "${BLUE}[INFO]${NORMAL} %s\n" "$1"
}

print_success() {
    printf "${GREEN}[SUCCESS]${NORMAL} %s\n" "$1"
}

print_warning() {
    printf "${YELLOW}[WARNING]${NORMAL} %s\n" "$1"
}

print_error() {
    printf "${RED}[ERROR]${NORMAL} %s\n" "$1"
}

# Check Java installation
check_java() {
    print_step "Checking for Java..."

    if command -v java &> /dev/null; then
        JAVA_VERSION=$(java -version 2>&1 | head -n 1 | cut -d'"' -f2 | cut -d'.' -f1)
        if [ "$JAVA_VERSION" -ge 11 ] 2>/dev/null; then
            print_success "Java $JAVA_VERSION is installed"
            return 0
        else
            print_warning "Java version is too old (need 11+)"
            return 1
        fi
    else
        print_warning "Java is not installed"
        return 1
    fi
}

# Install Java
install_java() {
    print_step "Installing Java..."

    OS="$(uname -s)"
    case "${OS}" in
        Darwin*)
            # macOS - use Homebrew
            if ! command -v brew &> /dev/null; then
                print_step "Installing Homebrew first..."
                /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

                # Add Homebrew to PATH for Apple Silicon Macs
                if [ -f "/opt/homebrew/bin/brew" ]; then
                    export PATH="/opt/homebrew/bin:$PATH"
                fi
            fi

            print_step "Installing OpenJDK via Homebrew..."
            brew install openjdk

            # Link it so macOS can find it
            print_step "Linking OpenJDK for system use..."
            sudo ln -sfn /opt/homebrew/opt/openjdk/libexec/openjdk.jdk /Library/Java/JavaVirtualMachines/openjdk.jdk 2>/dev/null || \
            sudo ln -sfn /usr/local/opt/openjdk/libexec/openjdk.jdk /Library/Java/JavaVirtualMachines/openjdk.jdk 2>/dev/null

            # Add to PATH
            if [ -f "/opt/homebrew/opt/openjdk/bin/java" ]; then
                export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"
            elif [ -f "/usr/local/opt/openjdk/bin/java" ]; then
                export PATH="/usr/local/opt/openjdk/bin:$PATH"
            fi
            ;;
        Linux*)
            # Linux - detect distribution
            if command -v apt &> /dev/null; then
                # Ubuntu/Debian
                print_step "Installing OpenJDK via apt..."
                sudo apt update && sudo apt install -y openjdk-17-jdk
            elif command -v dnf &> /dev/null; then
                # Fedora/RHEL
                print_step "Installing OpenJDK via dnf..."
                sudo dnf install -y java-17-openjdk-devel
            elif command -v pacman &> /dev/null; then
                # Arch Linux
                print_step "Installing OpenJDK via pacman..."
                sudo pacman -S --noconfirm jdk-openjdk
            else
                print_error "Could not detect package manager. Please install Java manually."
                return 1
            fi
            ;;
        *)
            print_error "Unsupported operating system: $OS"
            return 1
            ;;
    esac

    # Verify installation
    if check_java; then
        print_success "Java installed successfully"
        return 0
    else
        print_error "Java installation failed"
        return 1
    fi
}

# Find conda installation
find_conda() {
    # Check if conda command exists
    if command -v conda &> /dev/null; then
        return 0
    fi

    # Check common installation paths
    COMMON_CONDA_PATHS=(
        "$HOME/miniconda3/bin/conda"
        "$HOME/anaconda3/bin/conda"
        "$HOME/miniforge3/bin/conda"
        "/opt/homebrew/Caskroom/miniconda/base/bin/conda"
        "/opt/homebrew/Caskroom/anaconda/base/bin/conda"
        "/opt/miniconda3/bin/conda"
        "/opt/anaconda3/bin/conda"
        "/usr/local/miniconda3/bin/conda"
        "/usr/local/anaconda3/bin/conda"
    )

    for path in "${COMMON_CONDA_PATHS[@]}"; do
        if [ -f "$path" ]; then
            export PATH="$(dirname "$path"):$PATH"
            return 0
        fi
    done

    return 1
}

# Initialize conda
init_conda() {
    # Find conda installation
    if ! find_conda; then
        return 1
    fi

    # Find conda.sh script
    CONDA_BASE=$(conda info --base 2>/dev/null)
    if [ -n "$CONDA_BASE" ] && [ -f "$CONDA_BASE/etc/profile.d/conda.sh" ]; then
        source "$CONDA_BASE/etc/profile.d/conda.sh"
        return 0
    fi

    # Try common locations for conda.sh
    CONDA_SCRIPT_PATHS=(
        "$HOME/miniconda3/etc/profile.d/conda.sh"
        "$HOME/anaconda3/etc/profile.d/conda.sh"
        "/opt/homebrew/Caskroom/miniconda/base/etc/profile.d/conda.sh"
        "/opt/homebrew/Caskroom/anaconda/base/etc/profile.d/conda.sh"
        "/opt/miniconda3/etc/profile.d/conda.sh"
        "/opt/anaconda3/etc/profile.d/conda.sh"
    )

    for script in "${CONDA_SCRIPT_PATHS[@]}"; do
        if [ -f "$script" ]; then
            source "$script"
            return 0
        fi
    done

    print_warning "Could not find conda.sh script, but conda command is available"
    return 0
}

# Install Miniconda
install_miniconda() {
    print_step "Installing Miniconda..."

    # Create temporary directory
    TEMP_DIR="$HOME/.quantumbrush_temp"
    mkdir -p "$TEMP_DIR"
    cd "$TEMP_DIR"

    # Detect system architecture
    OS=$(uname -s)
    ARCH=$(uname -m)

    case "$OS" in
        "Darwin")
            if [ "$ARCH" = "arm64" ]; then
                MINICONDA_URL="https://repo.anaconda.com/miniconda/Miniconda3-latest-MacOSX-arm64.sh"
                INSTALLER_NAME="Miniconda3-latest-MacOSX-arm64.sh"
            else
                MINICONDA_URL="https://repo.anaconda.com/miniconda/Miniconda3-latest-MacOSX-x86_64.sh"
                INSTALLER_NAME="Miniconda3-latest-MacOSX-x86_64.sh"
            fi
            ;;
        "Linux")
            if [ "$ARCH" = "x86_64" ]; then
                MINICONDA_URL="https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh"
                INSTALLER_NAME="Miniconda3-latest-Linux-x86_64.sh"
            elif [ "$ARCH" = "aarch64" ]; then
                MINICONDA_URL="https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-aarch64.sh"
                INSTALLER_NAME="Miniconda3-latest-Linux-aarch64.sh"
            else
                print_error "Unsupported Linux architecture: $ARCH"
                return 1
            fi
            ;;
        *)
            print_error "Unsupported operating system: $OS"
            return 1
            ;;
    esac

    print_step "Downloading Miniconda for $OS ($ARCH)..."

    # Download Miniconda installer
    if command -v curl &> /dev/null; then
        curl -O "$MINICONDA_URL"
    elif command -v wget &> /dev/null; then
        wget "$MINICONDA_URL"
    else
        print_error "Neither curl nor wget found. Please install one of them."
        return 1
    fi

    if [ ! -f "$INSTALLER_NAME" ]; then
        print_error "Failed to download Miniconda installer"
        return 1
    fi

    print_step "Installing Miniconda..."

    # Install Miniconda silently
    bash "$INSTALLER_NAME" -b -p "$HOME/miniconda3"

    # Clean up
    cd - > /dev/null
    rm -rf "$TEMP_DIR"

    # Initialize conda
    if init_conda; then
        print_success "Miniconda installed and initialized successfully"
        return 0
    else
        print_error "Miniconda installation failed"
        return 1
    fi
}

# Setup Python environment with QuantumBrush dependencies
setup_python_environment() {
    print_step "Setting up Python environment with QuantumBrush dependencies..."

    # Check if conda is available
    if ! find_conda; then
        print_step "Conda not found, installing Miniconda..."
        if ! install_miniconda; then
            print_error "Failed to install Miniconda"
            return 1
        fi
    else
        print_success "Conda is already installed"
    fi

    # Initialize conda
    if ! init_conda; then
        print_error "Failed to initialize conda"
        return 1
    fi

    # Check if environment already exists
    if conda env list | grep -q "^quantumbrush "; then
        print_warning "Environment 'quantumbrush' already exists. Removing and recreating..."
        conda env remove -n quantumbrush -y
    fi

    # Create new environment
    print_step "Creating conda environment: quantumbrush"
    conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/main 
    conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/r
    conda create -n quantumbrush python=3.11 -y

    # Install packages with specific version requirements
    print_step "Installing QuantumBrush dependencies..."

    # Install via conda first (better for scientific packages)
    conda install -n quantumbrush -c conda-forge -y \
        "numpy>=2.1.0" \
        "matplotlib>=3.7.0" \
        "scipy>=1.10.0"


    # Install via pip (for packages not available in conda or for specific versions)
    conda run -n quantumbrush pip install \
        "Pillow>=10.0.0" \
        "qiskit>=2.0.0" \
        "qiskit-ibm-runtime>=0.20.0" \
        "qiskit-aer>=0.17.0" \
        "pytest>=7.0.0" \
        "black>=23.0.0" \
        "matplotlib>=3.10.0" \


    # Get the Python path from the conda environment
    CONDA_PYTHON_PATH=$(conda run -n quantumbrush which python)

    if [ -n "$CONDA_PYTHON_PATH" ]; then
        print_success "Python environment created: $CONDA_PYTHON_PATH"

        # Save Python path to QuantumBrush config
        mkdir -p "config"
        echo "$CONDA_PYTHON_PATH" > "config/python_path.txt"

        print_success "Python path saved to QuantumBrush configuration"

        # Verify key packages are installed
        print_step "Verifying package installation..."
        if conda run -n quantumbrush python -c "import numpy, qiskit,qiskit_ibm_runtime, matplotlib, scipy, PIL; print('✓ All packages verified')" 2>/dev/null; then
            print_success "All packages verified successfully"
        else
            print_warning "Some packages may not have installed correctly"
        fi

        return 0
    else
        print_error "Failed to get Python path from conda environment"
        return 1
    fi
}

# Main function
main() {
    printf "\n"
    printf "╔══════════════════════════════════════════════════════════════╗\n"
    printf "║                  QuantumBrush Setup                         ║\n"
    printf "║                                                              ║\n"
    printf "╚══════════════════════════════════════════════════════════════╝\n"
    printf "\n"

    # Check and install Java
    if ! check_java; then
        read -p "Do you want to install Java automatically? (Y/n): " -n 1 -r
        echo

        if [[ ! $REPLY =~ ^[Nn]$ ]]; then
            if ! install_java; then
                print_error "Java installation failed. Please install Java manually."
                exit 1
            fi
        else
            print_warning "Java installation skipped. QuantumBrush requires Java 11+ to run."
        fi
    fi

    # Setup Python environment
    if ! setup_python_environment; then
        print_error "Python environment setup failed."
        exit 1
    fi

    # Setup complete
    echo
    print_success "QuantumBrush setup completed successfully!"
    echo
    printf "${GREEN}Dependencies installed:${NORMAL}\n"
    printf "  • Java: $(java -version 2>&1 | head -n 1)\n"
    printf "  • Python: $(conda run -n quantumbrush python --version 2>/dev/null || echo 'Not available')\n"
    printf "  • NumPy: $(conda run -n quantumbrush python -c 'import numpy; print(numpy.__version__)' 2>/dev/null || echo 'Not available')\n"
    printf "  • Qiskit: $(conda run -n quantumbrush python -c 'import qiskit; print(qiskit.__version__)' 2>/dev/null || echo 'Not available')\n"
    printf "  • Qiskit_ibm_runtime: $(conda run -n quantumbrush python -c 'import qiskit_ibm_runtime; print(qiskit_ibm_runtime.__version__)' 2>/dev/null || echo 'Not available')\n"
    printf "  • Matplotlib: $(conda run -n quantumbrush python -c 'import matplotlib; print(matplotlib.__version__)' 2>/dev/null || echo 'Not available')\n"
    echo
    printf "${BLUE}To run QuantumBrush:${NORMAL}\n"
    printf "  • Double-click the JAR file\n"
    printf "  • Or from terminal: java -jar QuantumBrush.jar\n"
    echo
}

# Run main function
main "$@"
