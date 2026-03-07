from __future__ import annotations

import sys
from pathlib import Path

# Ensure `api/` is importable during pytest collection so imports like
# `from main import create_app` work regardless of where pytest is invoked from.
API_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_DIR))
