# main.py

from config import OUTPUT_DIR
from utils import ensure_output_dir, log
from modes.aurora import AuroraMode
from modes.nebula import NebulaMode
...
from report import write_quantum_report

MODE_MAP = {
    "aurora": AuroraMode,
    "nebula": NebulaMode,
    ...
}

def run_studio(mode="all", size=128, seed=None):
    ...

if __name__ == "__main__":
    run_studio(mode="all", size=128, seed=42)
