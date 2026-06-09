"""
运行指南：
    本模块为 scripts 下的工具函数集合，不单独运行。
    供以下模块以模块方式运行时复用：
    - python -m scripts.plot_price_scatter
    - python -m scripts.plot_price_sales
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import yaml
from odps import ODPS


@dataclass(frozen=True)
class OdpsConfig:
    access_id: str
    secret_access_key: str
    project: str
    endpoint: str


def load_yaml(path: Path) -> dict:
    """Load YAML file as a dict."""
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def load_odps_config(config_path: Path) -> OdpsConfig:
    """Load ODPS config from yaml."""
    config = load_yaml(config_path)
    odps_config = config.get("odps", {}) or {}
    required_keys = ("access_id", "secret_access_key", "project", "endpoint")
    missing = [k for k in required_keys if not odps_config.get(k)]
    if missing:
        raise ValueError(f"ODPS config missing keys: {missing}")
    return OdpsConfig(
        access_id=odps_config["access_id"],
        secret_access_key=odps_config["secret_access_key"],
        project=odps_config["project"],
        endpoint=odps_config["endpoint"],
    )


def init_odps_client(config: OdpsConfig) -> ODPS:
    """Initialize ODPS client."""
    return ODPS(
        access_id=config.access_id,
        secret_access_key=config.secret_access_key,
        project=config.project,
        endpoint=config.endpoint,
    )


def read_sql_file(sql_path: Path) -> str:
    """Read a sql file as a single SQL string."""
    with open(sql_path, "r", encoding="utf-8") as f:
        sql = f.read().strip()
    if sql.endswith(";"):
        sql = sql[:-1].strip()
    if not sql:
        raise ValueError(f"SQL file is empty: {sql_path}")
    return sql


def to_float(value) -> float | None:
    """Convert value to float if possible."""
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None
