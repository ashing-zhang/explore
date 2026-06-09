"""Logging setup.

Run:
- This module is imported by scripts; no direct execution is required.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class LoggingConfig:
    """Logging configuration."""

    level: str = "INFO"


def setup_logging(config: LoggingConfig) -> None:
    """Configure root logging with a consistent format."""
    level = getattr(logging, config.level.upper(), logging.INFO)
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s %(name)s - %(message)s",
    )

