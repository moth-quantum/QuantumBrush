# QuantumBrush Refactored App

This document outlines the technical improvements and architectural changes introduced in this implementation. The primary objective was to transition the legacy Java-based stack into a modernized, high-performance ecosystem using React and Python, while ensuring robust distribution and extensibility.

## Core Architectural Advantages

### 1. Modern Technology Stack & Interoperability
The application has migrated from a Java-based environment to a contemporary stack:
- **Frontend**: React, Vite, and Tailwind CSS.
- **Interoperability**: Leveraging `pywebview` for native communication between the high-performance React-based UI and the core Python backend. This eliminates overhead while providing a platform-native desktop experience.
- **Package Management**: Unified dependency management via Bun (frontend) and Python's standard tooling.

## Rationale: Why pywebview over Electron?

The decision to use `pywebview` instead of Electron for this overhaul was driven by the specific requirements of a quantum-scientific application:

| Metric | pywebview | Electron |
| :--- | :--- | :--- |
| **Core Entry Size** | **~72 MB** | **~150-200 MB** |
| **Memory Usage** | **40-60 MB** (Base) | **150+ MB** (Base) |
| **Backend Architecture** | Native Python (Single Process) | Node.js + Python Sidecar (Multi-Process) |
| **Web Engine** | System-Native (WebKit/WebView2) | Bundled Chromium |

### Key Advantages:
- **Zero-Latency Interop**: Unlike Electron, which requires complex IPC or socket communication between a Node.js main process and a Python sidecar, `pywebview` allows the React frontend to call Python functions directly. This is critical for high-frequency data exchange required by quantum simulations.
- **Resource Efficiency**: By utilizing the OS-native web renderer, we avoid bundling a full Chromium instance. This results in a significantly lower memory footprint and initial disk space usage before dependencies.
- **Unified Scientific Environment**: Our entire backend exists in a single Python environment. This simplifies the bundling of heavy scientific libraries like Qiskit and SciPy, as they don't need to be managed as "external resources" to an Electron app.

### 2. Reliable Distribution & Portability
The build system has been optimized for both developer and end-user distribution:
- **Standalone Binaries**: Using PyInstaller, the application can be packaged into a self-contained "One-Dir" or "One-File" structure. Customers can execute the software without requiring a Python environment, bash scripts, or repository cloning.
- **Web Deployment Capabilities**: The frontend is a decoupled Vite application. By providing a backend API implementation, the interface can be deployed as an independent web application.

### 3. Professional Backend Modernization
The backend implementation has been refactored to prioritize stability and static analysis:
- **Effect Registry Pattern**: Dynamic path-based imports have been replaced with a centralized registry. This allows PyInstaller and IDEs to statically resolve dependecies, ensuring that complex scientific libraries (Qiskit, SciPy, NumPy) are accurately bundled.
- **Dynamic Dependency Collection**: An automated script (`scripts/collect_deps.py`) parses individual effect configurations at build-time to generate consolidated requirements and PyInstaller flags.
- **Location-Agnostic Execution**: Dependency on hardcoded installation paths has been removed. The application now uses system standard temporary directories for volatile data and `importlib.resources` for metadata access, ensuring compatibility across different operating systems and installation environments.

## Technical Specifications
- **Build Engine**: Bun (Frontend), PyInstaller (Native Bundling).
- **Core Libraries**: Python 3.10+, Qiskit, NumPy, SciPy, Matplotlib, Pillow, PyWebView.
- **UI Architecture**: Tailwind CSS configuration for highly optimized, utility-first styling.

## Deployment & Development

### Local Execution (Repository Mode)
For development and full environment access:
1. Initialize the environment: `./install.sh`
2. Launch the application: `./run_native.sh`

### Standalone Build
To generate a production-ready binary distribution for end-users:
```bash
./deploy_native.sh
```
The resulting distribution in the `dist/` directory is portable and excludes the need for source-code access or manual environment configuration.

### Deployment as Web App
The frontend in `frontend/` can be built and deployed to any static hosting service. Ensure `VITE_BACKEND` is configured to point to a reachable API endpoint for effect processing.
