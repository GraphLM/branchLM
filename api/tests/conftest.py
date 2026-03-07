from __future__ import annotations

import sys
from pathlib import Path

import pytest

# Ensure `api/` is importable during pytest collection so imports like
# `from main import create_app` work regardless of where pytest is invoked from.
API_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_DIR))

from main import create_app  # noqa: E402
from store.base import Store  # noqa: E402

DEV_BYPASS_USER_ID = "dev:test@example.com"


def _cleanup_dev_bypass_workspaces(store: Store) -> None:
    workspaces = store.list_workspaces(DEV_BYPASS_USER_ID)
    for workspace in workspaces:
        store.delete_workspace(DEV_BYPASS_USER_ID, workspace["id"])


@pytest.fixture(autouse=True)
def cleanup_dev_bypass_data() -> None:
    app = create_app()
    store = app.state.store
    _cleanup_dev_bypass_workspaces(store)
    yield
    _cleanup_dev_bypass_workspaces(store)
