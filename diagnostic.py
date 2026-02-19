# diagnostic_simple.py
import webview
import importlib
import sys
import os

print("Python executable:", sys.executable)
print("Python version:", sys.version)
print("\nChecking webview installation:")
print("webview path:", webview.__file__)

print("\nChecking available backends:")
backends = ['gtk', 'qt', 'cef']

for backend in backends:
    print(f"\nTesting {backend}:")
    try:
        module_name = f'webview.platforms.{backend}'
        spec = importlib.util.find_spec(module_name)
        if spec:
            print(f"  ✓ Module found at: {spec.origin}")
            # Try to import it
            module = importlib.import_module(module_name)
            print(f"  ✓ Successfully imported")
            if hasattr(module, 'BrowserView'):
                print(f"  ✓ Has BrowserView class")
        else:
            print(f"  ✗ Module not found")
    except ImportError as e:
        print(f"  ✗ Import error: {e}")
    except Exception as e:
        print(f"  ✗ Other error: {e}")

print("\nChecking GTK-specific imports:")
try:
    import gi
    print("  ✓ gi module found")
    gi.require_version('Gtk', '3.0')
    from gi.repository import Gtk
    print(f"  ✓ Gtk {Gtk.get_major_version()}.{Gtk.get_minor_version()} imported")
    
    # Check WebKit
    try:
        gi.require_version('WebKit2', '4.0')
        from gi.repository import WebKit2
        print(f"  ✓ WebKit2 {WebKit2.get_major_version()}.{WebKit2.get_minor_version()} imported")
    except (ImportError, ValueError) as e:
        print(f"  ✗ WebKit2 import failed: {e}")
        
except ImportError as e:
    print(f"  ✗ gi import failed: {e}")
except ValueError as e:
    print(f"  ✗ Gtk version requirement failed: {e}")