"""Path helpers.

Run:
- This module is imported by training/evaluation scripts; no direct execution is required.
"""

from __future__ import annotations

from pathlib import Path


def package_root() -> Path:
    """Return the RL workspace directory (this repository's rl folder)."""
    return Path(__file__).resolve().parents[1]


def default_config_path() -> Path:
    """Return the default config path shipped with the package."""
    return package_root() / "configs" / "default.yaml"


def outputs_root() -> Path:
    """Return the default outputs directory path."""
    return package_root()

