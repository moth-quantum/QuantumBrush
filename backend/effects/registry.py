import json
import importlib.resources

def _load_req(effect_id):
    try:
        # Modern way to load resources from a package
        pkg = f"backend.effects.{effect_id}"
        resource = f"{effect_id}_requirements.json"
        with importlib.resources.files(pkg).joinpath(resource).open('r') as f:
            return json.load(f)
    except Exception:
        return {}

from .acrylic import acrylic
from .GoL import GoL
from .clone import clone
from .damping import damping
from .heisenbrush import heisenbrush
from .heisenbrush2 import heisenbrush2
from .qdrop import qdrop

EFFECT_REGISTRY = {
    "acrylic": {"module": acrylic, "config": _load_req("acrylic")},
    "GoL": {"module": GoL, "config": _load_req("GoL")},
    "clone": {"module": clone, "config": _load_req("clone")},
    "damping": {"module": damping, "config": _load_req("damping")},
    "heisenbrush": {"module": heisenbrush, "config": _load_req("heisenbrush")},
    "heisenbrush2": {"module": heisenbrush2, "config": _load_req("heisenbrush2")},
    "qdrop": {"module": qdrop, "config": _load_req("qdrop")},
}
