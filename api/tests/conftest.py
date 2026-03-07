from __future__ import annotations

import sys
from pathlib import Path

# Ensure `api/` is importable during pytest collection.
API_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_DIR))
