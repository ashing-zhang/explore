"""Minimal .env loader for local development.

Run:
- Imported by training/evaluation scripts; no direct execution is required.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path

LOGGER = logging.getLogger(__name__)


def load_dotenv(path: Path, *, override: bool = False) -> dict[str, str]:
    """Load environment variables from a .env file."""
    if not path.exists() or not path.is_file():
        return {}

    loaded: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue

        if line.startswith("export "):
            line = line.removeprefix("export ").lstrip()

        if "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if not key:
            continue

        if (value.startswith("'") and value.endswith("'")) or (value.startswith('"') and value.endswith('"')):
            value = value[1:-1]

        if not override and key in os.environ:
            continue

        os.environ[key] = value
        loaded[key] = value

    if loaded:
        LOGGER.info("Loaded %s env var(s) from %s", len(loaded), str(path))
    return loaded


def load_default_dotenv(*, override: bool = False) -> dict[str, str]:
    """Load .env from the rl/ directory if it exists."""
    from core.paths import outputs_root

    return load_dotenv(outputs_root() / ".env", override=override)

