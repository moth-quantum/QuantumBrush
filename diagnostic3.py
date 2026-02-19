#!/usr/bin/env python3
"""
Version checker for pywebview and its dependencies.
Run this script to diagnose version mismatches.
"""

import sys
import subprocess
import importlib.metadata
from pathlib import Path

def print_header(title):
    print(f"\n{'='*60}")
    print(f" {title}")
    print('='*60)

def get_pip_version(package):
    try:
        return importlib.metadata.version(package)
    except:
        return "Not installed"

def run_cmd(cmd):
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        return result.stdout.strip() or result.stderr.strip()
    except:
        return "Failed to run command"

print_header("SYSTEM INFORMATION")
print(f"Python: {sys.version}")
print(f"Platform: {sys.platform}")
print(f"Pyenv: {run_cmd('which python')}")

print_header("PACKAGE VERSIONS")
packages = ['pywebview', 'PyGObject', 'pycairo', 'PyQt5', 'PyQt6', 'PySide6', 'qtpy']
for pkg in packages:
    print(f"{pkg}: {get_pip_version(pkg)}")

print_header("GTK/WEBKIT SYSTEM LIBRARIES")
print("pkg-config versions:")
for lib in ['gtk+-3.0', 'webkit2gtk-4.0', 'webkit2gtk-4.1', 'gobject-introspection-1.0', 'glib-2.0']:
    version = run_cmd(f'pkg-config --modversion {lib} 2>/dev/null')
    if version and "Failed" not in version:
        print(f"  {lib}: {version}")
    else:
        print(f"  {lib}: Not found")

print_header("INSTALLED SYSTEM PACKAGES")
webkit_pkgs = run_cmd("dpkg -l 2>/dev/null | grep -E 'webkit|gtk|gobject|libglib' | head -20")
if webkit_pkgs:
    print(webkit_pkgs)
else:
    print("No dpkg output (not a Debian/Ubuntu system)")

print_header("PYTHON GTK BINDINGS")
try:
    import gi
    print(f"gi.__version__: {gi.__version__}")
    
    # GTK
    gi.require_version('Gtk', '3.0')
    from gi.repository import Gtk
    print(f"GTK: {Gtk.get_major_version()}.{Gtk.get_minor_version()}.{Gtk.get_micro_version()}")
    
    # WebKit2 - try different versions
    for version in ['4.0', '4.1']:
        try:
            gi.require_version('WebKit2', version)
            from gi.repository import WebKit2
            print(f"WebKit2 {version}: {WebKit2.get_major_version()}.{WebKit2.get_minor_version()}.{WebKit2.get_micro_version()}")
        except (ImportError, ValueError) as e:
            print(f"WebKit2 {version}: {e}")
            
    # Check available typelibs
    typelib_path = Path('/usr/lib/x86_64-linux-gnu/girepository-1.0')
    if typelib_path.exists():
        webkit_typelibs = list(typelib_path.glob('WebKit2-*.typelib'))
        print(f"\nAvailable WebKit typelibs: {[f.name for f in webkit_typelibs]}")
    else:
        print(f"\nTypelib path {typelib_path} not found")
        
except ImportError as e:
    print(f"PyGObject not properly installed: {e}")

print_header("PYWEBVIEW GTK BACKEND FILE")
try:
    import webview
    gtk_path = Path(webview.__file__).parent / 'platforms' / 'gtk.py'
    print(f"GTK backend: {gtk_path}")
    
    if gtk_path.exists():
        # Check for evaluate_javascript method
        with open(gtk_path) as f:
            content = f.read()
            if 'evaluate_javascript' in content:
                lines = content.split('\n')
                for i, line in enumerate(lines, 1):
                    if 'evaluate_javascript' in line:
                        print(f"  Line {i}: {line.strip()}")
            else:
                print("  'evaluate_javascript' not found in gtk.py")
    else:
        print("  GTK backend file not found")
except Exception as e:
    print(f"Error checking pywebview: {e}")

print_header("WEBKITGTK BINARY INFO")
binary_info = run_cmd("ldconfig -p 2>/dev/null | grep -E 'webkit|WebKit' | head -10")
if binary_info:
    print(binary_info)
else:
    print("No webkit libraries found in ldconfig")

print_header("SUMMARY")
print("""
Common issues:
1. WebKitGTK version mismatch - pywebview expects certain API methods
2. PyGObject version incompatible with system GTK
3. Missing gir1.2-webkit2-* packages
4. Ubuntu 20.04 has older WebKit (4.0) which may lack evaluate_javascript

Suggested fixes:
- Use Qt backend: pip install PyQt5 PyQtWebEngine
- Or upgrade WebKit: sudo apt install libwebkit2gtk-4.1-0 gir1.2-webkit2-4.1
- Or downgrade pywebview: pip install pywebview==4.4.1
""")