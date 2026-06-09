"""Configuration models and YAML loader.

Run:
- Used by scripts via python -m training.train_ppo (or train_sac) and python -m evaluation.evaluate (run from the rl/ directory)
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from core.logging import LoggingConfig


@dataclass(frozen=True, slots=True)
class FloatRange:
    """A closed interval for sampling continuous factors."""

    min: float
    max: float

    def validate(self, name: str) -> None:
        """Validate the range."""
        if self.min > self.max:
            raise ValueError(f"{name}.min must be <= {name}.max (got {self.min} > {self.max})")

    def sample(self, rng: Any) -> float:
        """Sample a float uniformly in [min, max] using a NumPy-like RNG."""
        self.validate("range")
        return float(rng.uniform(self.min, self.max))


@dataclass(frozen=True, slots=True)
class EnvConfig:
    """Environment configuration."""

    initial_inventory: int
    cost_price: float
    selling_window: int
    base_demand: float
    seasonality_factor: FloatRange
    event_factor: FloatRange
    price_elasticity: FloatRange
    holding_penalty_alpha: float = 0.0
    booking_alpha: float = 6.0
    booking_gamma: float = 0.03
    max_price_multiplier: float = 2.0
    max_profit_ratio_cap: float = 5.0
    hotel_close_prob: float = 0.0
    competitor_initial_price: float = 500.0
    competitor_target_sales: float = 5.0
    expiration_penalty_weight: float = 1.0

    def validate(self) -> None:
        """Validate the environment configuration."""
        if self.initial_inventory <= 0:
            raise ValueError("initial_inventory must be > 0")
        if self.cost_price < 0:
            raise ValueError("cost_price must be >= 0")
        if self.selling_window <= 0:
            raise ValueError("selling_window must be > 0")
        if self.base_demand < 0:
            raise ValueError("base_demand must be >= 0")
        if not (0.0 <= self.hotel_close_prob <= 1.0):
            raise ValueError("hotel_close_prob must be in [0, 1]")
        if self.max_price_multiplier <= 0:
            raise ValueError("max_price_multiplier must be > 0")
        if self.max_profit_ratio_cap <= 0:
            raise ValueError("max_profit_ratio_cap must be > 0")
        if self.holding_penalty_alpha < 0:
            raise ValueError("holding_penalty_alpha must be >= 0")
        if self.expiration_penalty_weight < 0:
            raise ValueError("expiration_penalty_weight must be >= 0")

        self.seasonality_factor.validate("seasonality_factor")
        self.event_factor.validate("event_factor")
        self.price_elasticity.validate("price_elasticity")


@dataclass(frozen=True, slots=True)
class PPOConfig:
    """Stable-Baselines3 PPO training configuration."""

    total_timesteps: int = 200_000
    n_steps: int = 2048
    batch_size: int = 64
    gamma: float = 0.99
    learning_rate: float = 3e-4

    def validate(self) -> None:
        """Validate PPO configuration."""
        if self.total_timesteps <= 0:
            raise ValueError("ppo.total_timesteps must be > 0")


@dataclass(frozen=True, slots=True)
class SACConfig:
    """Stable-Baselines3 SAC training configuration."""

    total_timesteps: int = 300_000
    batch_size: int = 256
    gamma: float = 0.99
    learning_rate: float = 3e-4
    buffer_size: int = 100_000

    def validate(self) -> None:
        """Validate SAC configuration."""
        if self.total_timesteps <= 0:
            raise ValueError("sac.total_timesteps must be > 0")


@dataclass(frozen=True, slots=True)
class EvaluationConfig:
    """Evaluation configuration."""

    episodes: int = 20
    seed: int = 7

    def validate(self) -> None:
        """Validate evaluation configuration."""
        if self.episodes <= 0:
            raise ValueError("evaluation.episodes must be > 0")


@dataclass(frozen=True, slots=True)
class AppConfig:
    """Root configuration."""

    logging: LoggingConfig
    env: EnvConfig
    ppo: PPOConfig
    sac: SACConfig
    evaluation: EvaluationConfig

    def validate(self) -> None:
        """Validate the whole configuration tree."""
        self.env.validate()
        self.ppo.validate()
        self.sac.validate()
        self.evaluation.validate()


def load_yaml(path: Path) -> dict[str, Any]:
    """Load a YAML file into a dictionary."""
    try:
        import yaml
    except ModuleNotFoundError as exc:
        raise ModuleNotFoundError("PyYAML is required to load .yaml configs (pip install pyyaml).") from exc

    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"Config must be a mapping at top-level: {path}")
    return data


def _as_float_range(value: Any, *, name: str) -> FloatRange:
    """Parse a FloatRange from a mapping."""
    if not isinstance(value, dict):
        raise TypeError(f"{name} must be a mapping with keys min/max")
    min_v = float(value.get("min"))
    max_v = float(value.get("max"))
    return FloatRange(min=min_v, max=max_v)


def from_yaml(path: Path) -> AppConfig:
    """Load and validate AppConfig from a YAML file."""
    raw = load_yaml(path)

    logging_raw = raw.get("logging", {}) if isinstance(raw.get("logging", {}), dict) else {}
    env_raw = raw.get("env", {})
    ppo_raw = raw.get("ppo", {})
    sac_raw = raw.get("sac", {})
    evaluation_raw = raw.get("evaluation", {})

    if not isinstance(env_raw, dict):
        raise TypeError("env must be a mapping")

    env = EnvConfig(
        initial_inventory=int(env_raw["initial_inventory"]),
        cost_price=float(env_raw["cost_price"]),
        selling_window=int(env_raw["selling_window"]),
        base_demand=float(env_raw["base_demand"]),
        seasonality_factor=_as_float_range(env_raw["seasonality_factor"], name="seasonality_factor"),
        event_factor=_as_float_range(env_raw["event_factor"], name="event_factor"),
        price_elasticity=_as_float_range(env_raw["price_elasticity"], name="price_elasticity"),
        holding_penalty_alpha=float(env_raw.get("holding_penalty_alpha", 0.0)),
        booking_alpha=float(env_raw.get("booking_alpha", 6.0)),
        booking_gamma=float(env_raw.get("booking_gamma", 0.03)),
        max_price_multiplier=float(env_raw.get("max_price_multiplier", 2.0)),
        max_profit_ratio_cap=float(env_raw.get("max_profit_ratio_cap", 5.0)),
        hotel_close_prob=float(env_raw.get("hotel_close_prob", 0.0)),
        competitor_initial_price=float(env_raw.get("competitor_initial_price", 500.0)),
        competitor_target_sales=float(env_raw.get("competitor_target_sales", 5.0)),
        expiration_penalty_weight=float(env_raw.get("expiration_penalty_weight", 1.0)),
    )

    config = AppConfig(
        logging=LoggingConfig(level=str(logging_raw.get("level", "INFO"))),
        env=env,
        ppo=PPOConfig(
            total_timesteps=int(ppo_raw.get("total_timesteps", 200_000)),
            n_steps=int(ppo_raw.get("n_steps", 2048)),
            batch_size=int(ppo_raw.get("batch_size", 64)),
            gamma=float(ppo_raw.get("gamma", 0.99)),
            learning_rate=float(ppo_raw.get("learning_rate", 3e-4)),
        ),
        sac=SACConfig(
            total_timesteps=int(sac_raw.get("total_timesteps", 300_000)),
            batch_size=int(sac_raw.get("batch_size", 256)),
            gamma=float(sac_raw.get("gamma", 0.99)),
            learning_rate=float(sac_raw.get("learning_rate", 3e-4)),
            buffer_size=int(sac_raw.get("buffer_size", 100_000)),
        ),
        evaluation=EvaluationConfig(
            episodes=int(evaluation_raw.get("episodes", 20)),
            seed=int(evaluation_raw.get("seed", 7)),
        ),
    )
    config.validate()
    return config
