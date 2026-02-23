# report.py

import os
from config import OUTPUT_DIR

def write_report(stats):

    lines = []
    lines.append("QUANTUM CANVAS REPORT")
    lines.append("=====================")
    lines.append(f"Total gates: {stats['total_gates']}")

    for k,v in stats["by_type"].items():
        lines.append(f"{k}: {v}")

    path = os.path.join(OUTPUT_DIR,"quantum_report.txt")

    with open(path,"w") as f:
        f.write("\n".join(lines))
