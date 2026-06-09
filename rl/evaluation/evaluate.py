"""Evaluate a trained policy (or a random baseline) on HotelBlockEnv.

Run:
- python -m evaluation.evaluate

Configuration:
- Default config: configs/default.yaml
- Override config path via environment variable HOTEL_RL_CONFIG=/path/to/config.yaml
- Override model path via environment variable HOTEL_RL_MODEL=/path/to/trained_model.zip
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np

from core.config import AppConfig, from_yaml
from core.dotenv import load_default_dotenv
from core.logging import setup_logging
from core.paths import default_config_path, outputs_root
from env.hotel_block_env import HotelBlockEnv

LOGGER = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class EpisodeResult:
    """Aggregated episode metrics."""

    total_profit: float
    total_revenue: float
    total_sales: int
    sell_through_rate: float
    profit_margin: float
    average_daily_rate: float
    revpar: float
    inventory_waste_rate: float


def _resolve_config_path() -> Path:
    """Resolve config path from environment or default."""
    env_path = os.environ.get("HOTEL_RL_CONFIG")
    if env_path:
        return Path(env_path).expanduser().resolve()
    return default_config_path()


def _resolve_model_path(outputs_dir: Path) -> Path | None:
    """Resolve a model path from environment or known defaults."""
    env_model = os.environ.get("HOTEL_RL_MODEL")
    if env_model:
        p = Path(env_model).expanduser().resolve()
        return p if p.exists() else None

    default_model = outputs_dir / "trained_model.zip"
    if default_model.exists():
        return default_model
    legacy_model = outputs_root() / "trained_model.zip"
    if legacy_model.exists():
        return legacy_model
    return None


def _ensure_outputs() -> Path:
    """Ensure outputs directory exists."""
    out = outputs_root() / "outputs"
    out.mkdir(parents=True, exist_ok=True)
    return out


def _load_sb3_model(model_path: Path) -> Any:
    """Load a Stable-Baselines3 model from disk."""
    try:
        from stable_baselines3 import PPO, SAC
    except ModuleNotFoundError as exc:
        raise ModuleNotFoundError(
            "stable-baselines3 is required to load models (pip install stable-baselines3)."
        ) from exc

    try:
        return PPO.load(str(model_path))
    except Exception:
        return SAC.load(str(model_path))


def _compute_episode_result(config: AppConfig, final_info: dict[str, Any]) -> EpisodeResult:
    """Compute metrics from final info."""
    total_profit = float(final_info.get("cumulative_profit", 0.0))
    total_revenue = float(final_info.get("cumulative_revenue", 0.0))
    total_sales = int(final_info.get("cumulative_sales", 0))
    initial_inventory = int(config.env.initial_inventory)
    remaining_inventory = int(final_info.get("remaining_inventory", 0))

    sell_through_rate = float(total_sales / max(initial_inventory, 1))
    profit_margin = float(total_profit / max(total_revenue, 1.0))
    average_daily_rate = float(total_revenue / max(total_sales, 1))
    revpar = float(total_revenue / max(initial_inventory, 1))
    inventory_waste_rate = float(remaining_inventory / max(initial_inventory, 1))

    return EpisodeResult(
        total_profit=total_profit,
        total_revenue=total_revenue,
        total_sales=total_sales,
        sell_through_rate=sell_through_rate,
        profit_margin=profit_margin,
        average_daily_rate=average_daily_rate,
        revpar=revpar,
        inventory_waste_rate=inventory_waste_rate,
    )


def _plot_curves(outputs_dir: Path, curves: dict[str, list[float]]) -> dict[str, str]:
    """Plot curves to PNG files and return filename mapping."""
    try:
        import matplotlib.pyplot as plt
    except ModuleNotFoundError:
        LOGGER.warning("matplotlib is not installed; skipping PNG outputs.")
        return {}

    axis_labels = {
        "profit_curve": ("Day (timestep in episode)", "Mean cumulative_profit_ratio"),
        "inventory_curve": ("Day (timestep in episode)", "Mean remaining_inventory_ratio"),
        "price_curve": ("Day (timestep in episode)", "Mean selling_price_ratio"),
    }

    files: dict[str, str] = {}
    for key, values in curves.items():
        fig = plt.figure()
        ax = fig.add_subplot(111)
        ax.plot(values)
        ax.set_title(key)
        xlabel, ylabel = axis_labels.get(key, ("Day (timestep in episode)", key))
        ax.set_xlabel(xlabel)
        ax.set_ylabel(ylabel)
        filename = f"{key}.png"
        fig.tight_layout()
        fig.savefig(outputs_dir / filename, dpi=150)
        plt.close(fig)
        files[key] = filename
    return files


def _plot_comparison_curves(
    outputs_dir: Path,
    *,
    model_curves: dict[str, list[float]] | None,
    baseline_curves: dict[str, list[float]],
    model_label: str = "model",
    baseline_label: str = "random_baseline",
) -> dict[str, str]:
    """Plot baseline vs model curves to PNG files and return filename mapping."""
    try:
        import matplotlib.pyplot as plt
    except ModuleNotFoundError:
        LOGGER.warning("matplotlib is not installed; skipping PNG outputs.")
        return {}

    axis_labels = {
        "profit_curve": ("Day (timestep in episode)", "Mean cumulative_profit_ratio"),
        "inventory_curve": ("Day (timestep in episode)", "Mean remaining_inventory_ratio"),
        "price_curve": ("Day (timestep in episode)", "Mean selling_price_ratio"),
    }

    files: dict[str, str] = {}
    keys = sorted(set(baseline_curves.keys()) | (set(model_curves.keys()) if model_curves else set()))
    for key in keys:
        fig = plt.figure()
        ax = fig.add_subplot(111)
        baseline_values = baseline_curves.get(key, [])
        ax.plot(baseline_values, label=baseline_label)
        if model_curves is not None:
            model_values = model_curves.get(key, [])
            ax.plot(model_values, label=model_label)
        ax.set_title(key)
        xlabel, ylabel = axis_labels.get(key, ("Day (timestep in episode)", key))
        ax.set_xlabel(xlabel)
        ax.set_ylabel(ylabel)
        ax.legend()
        filename = f"{key}.png"
        fig.tight_layout()
        fig.savefig(outputs_dir / filename, dpi=150)
        plt.close(fig)
        files[key] = filename
    return files


def _write_html_report(
    outputs_dir: Path,
    *,
    model_summary: dict[str, float] | None,
    baseline_summary: dict[str, float],
    image_files: dict[str, str],
) -> Path:
    """Write a small HTML report."""
    lines: list[str] = []
    lines.append("<html><head><meta charset='utf-8'><title>Hotel RL Evaluation</title></head><body>")
    lines.append("<h1>Evaluation Summary</h1>")

    def _table(title: str, summary: dict[str, float]) -> None:
        lines.append(f"<h2>{title}</h2>")
        lines.append("<table border='1' cellpadding='6' cellspacing='0'>")
        for k, v in summary.items():
            lines.append(f"<tr><td>{k}</td><td>{v:.6f}</td></tr>")
        lines.append("</table>")

    _table("Random Baseline", baseline_summary)
    if model_summary is None:
        lines.append("<h2>Model</h2>")
        lines.append("<p>No model was found; only the random baseline was evaluated.</p>")
    else:
        _table("Model", model_summary)
        lines.append("<h2>Model - Baseline (Delta)</h2>")
        lines.append("<table border='1' cellpadding='6' cellspacing='0'>")
        keys = sorted(set(baseline_summary.keys()) | set(model_summary.keys()))
        for k in keys:
            delta = float(model_summary.get(k, 0.0)) - float(baseline_summary.get(k, 0.0))
            lines.append(f"<tr><td>{k}</td><td>{delta:.6f}</td></tr>")
        lines.append("</table>")

    if image_files:
        lines.append("<h2>Curves</h2>")
        for k, fname in image_files.items():
            lines.append(f"<h3>{k}</h3>")
            lines.append(f"<img src='{fname}' style='max-width: 900px;'/>")

    lines.append("</body></html>")
    report_path = outputs_dir / "evaluation_report.html"
    report_path.write_text("\n".join(lines), encoding="utf-8")
    return report_path


def main() -> None:
    """Run evaluation."""
    load_default_dotenv()
    config_path = _resolve_config_path()
    config = from_yaml(config_path)
    setup_logging(config.logging)

    outputs_dir = _ensure_outputs()
    model_path = _resolve_model_path(outputs_dir)

    model = None
    if model_path is not None:
        LOGGER.info("Loading model: %s", str(model_path))
        model = _load_sb3_model(model_path)
    else:
        LOGGER.info("No model found; using random policy baseline.")

    def _run_eval(*, policy: Any | None) -> tuple[list[EpisodeResult], list[list[float]], list[list[float]], list[list[float]]]:
        episode_results: list[EpisodeResult] = []
        profit_curves: list[list[float]] = []
        inventory_curves: list[list[float]] = []
        price_curves: list[list[float]] = []

        for i in range(int(config.evaluation.episodes)):
            env = HotelBlockEnv(config=config.env)
            obs, _ = env.reset(seed=int(config.evaluation.seed) + i)

            episode_profit: list[float] = []
            episode_inventory: list[float] = []
            episode_price: list[float] = []
            final_info: dict[str, Any] = {}

            terminated = False
            truncated = False
            while not (terminated or truncated):
                if policy is None:
                    action = env.action_space.sample()
                else:
                    action, _ = policy.predict(obs, deterministic=True)
                obs, _, terminated, truncated, info = env.step(action)
                final_info = info

                episode_profit.append(float(info.get("cumulative_profit_ratio", 0.0)))
                episode_inventory.append(float(info.get("remaining_inventory_ratio", 0.0)))
                episode_price.append(float(info.get("selling_price_ratio", 1.0)))

            result = _compute_episode_result(config, final_info)
            episode_results.append(result)
            profit_curves.append(episode_profit)
            inventory_curves.append(episode_inventory)
            price_curves.append(episode_price)

        return episode_results, profit_curves, inventory_curves, price_curves

    baseline_results, baseline_profit, baseline_inventory, baseline_price = _run_eval(policy=None)
    model_results: list[EpisodeResult] | None = None
    model_profit: list[list[float]] | None = None
    model_inventory: list[list[float]] | None = None
    model_price: list[list[float]] | None = None
    if model is not None:
        model_results, model_profit, model_inventory, model_price = _run_eval(policy=model)

    def _pad_curve(curve: list[float], *, target_len: int) -> list[float]:
        """Pad a curve to target length by extending the last value."""
        if target_len <= 0:
            return []
        if not curve:
            return [0.0] * target_len
        if len(curve) >= target_len:
            return curve[:target_len]
        return curve + [float(curve[-1])] * (target_len - len(curve))

    def mean(xs: list[float]) -> float:
        """Compute mean with empty guard."""
        return float(np.mean(xs)) if xs else 0.0

    def _summarize(results: list[EpisodeResult]) -> dict[str, float]:
        return {
            "total_profit": mean([r.total_profit for r in results]),
            "profit_margin": mean([r.profit_margin for r in results]),
            "sell_through_rate": mean([r.sell_through_rate for r in results]),
            "average_daily_rate": mean([r.average_daily_rate for r in results]),
            "revpar": mean([r.revpar for r in results]),
            "inventory_waste_rate": mean([r.inventory_waste_rate for r in results]),
        }

    def _mean_curves(
        profit: list[list[float]], inventory: list[list[float]], price: list[list[float]]
    ) -> dict[str, list[float]]:
        max_len = max(
            max((len(c) for c in profit), default=0),
            max((len(c) for c in inventory), default=0),
            max((len(c) for c in price), default=0),
        )
        profit_mat = np.array([_pad_curve(c, target_len=max_len) for c in profit], dtype=np.float32)
        inv_mat = np.array([_pad_curve(c, target_len=max_len) for c in inventory], dtype=np.float32)
        price_mat = np.array([_pad_curve(c, target_len=max_len) for c in price], dtype=np.float32)
        return {
            "profit_curve": list(np.mean(profit_mat, axis=0)) if max_len > 0 else [],
            "inventory_curve": list(np.mean(inv_mat, axis=0)) if max_len > 0 else [],
            "price_curve": list(np.mean(price_mat, axis=0)) if max_len > 0 else [],
        }

    baseline_summary = _summarize(baseline_results)
    baseline_curves = _mean_curves(baseline_profit, baseline_inventory, baseline_price)

    model_summary: dict[str, float] | None = None
    model_curves: dict[str, list[float]] | None = None
    if model_results is not None and model_profit is not None and model_inventory is not None and model_price is not None:
        model_summary = _summarize(model_results)
        model_curves = _mean_curves(model_profit, model_inventory, model_price)

    images = _plot_comparison_curves(outputs_dir, model_curves=model_curves, baseline_curves=baseline_curves)
    report_path = _write_html_report(
        outputs_dir,
        model_summary=model_summary,
        baseline_summary=baseline_summary,
        image_files=images,
    )

    LOGGER.info("Wrote evaluation report: %s", str(report_path))


if __name__ == "__main__":
    main()
