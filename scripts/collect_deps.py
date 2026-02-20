import os
import json
from pathlib import Path

def collect_dependencies():
    effects_dir = Path("backend/effects")
    all_deps = set() # For PyInstaller flags (names only)
    raw_deps = set() # For requirements.txt (with versions)
    
    # Standard libraries we always need to enforce
    standard_scientific = ["numpy", "scipy", "matplotlib", "qiskit", "qiskit_aer"]
    all_deps.update((d.split(">")[0].split("<")[0].split("=")[0].strip() for d in standard_scientific))
    raw_deps.update(standard_scientific)

    # Scan all effect JSONs for extra dependencies
    for json_file in effects_dir.glob("*/*_requirements.json"):
        try:
            with open(json_file, "r") as f:
                data = json.load(f)
                deps = data.get("dependencies", {})
                for dep, version in deps.items():
                    clean_dep = dep.split(">")[0].split("<")[0].split("=")[0].strip()
                    if not clean_dep:
                        continue
                    
                    all_deps.add(clean_dep)
                    
                    full_dep = f"{dep}{version}" if version and any(c in version for c in "=<>") else f"{dep}>={version}" if version else dep
                    
                    # Update raw_deps: if we already have a bare 'package', replace it with 'package>=version'
                    # If we already have a 'package>=version', keep it.
                    existing = next((d for d in raw_deps if d.startswith(clean_dep)), None)
                    if existing:
                        if len(full_dep) > len(existing): # Simple heuristic: longer string usually has more constraints
                            raw_deps.remove(existing)
                            raw_deps.add(full_dep)
                    else:
                        raw_deps.add(full_dep)
        except Exception as e:
            print(f"Warning: Failed to parse {json_file}: {e}")

    # Write requirements-effects.txt
    with open("requirements-effects.txt", "w") as f:
        f.write("# Auto-generated from effect JSONs\n")
        for dep in sorted(raw_deps):
            f.write(f"{dep}\n")

    # Generate PyInstaller flags
    flags = []
    for dep in sorted(all_deps):
        flags.append(f"--collect-all {dep}")
        if "qiskit" in dep.lower():
            flags.append(f"--copy-metadata {dep}")
            
    return " ".join(flags)

if __name__ == "__main__":
    import sys
    # If called with --flags, return PyInstaller args. Otherwise just generate the txt.
    res = collect_dependencies()
    if "--flags" in sys.argv:
        print(res)
