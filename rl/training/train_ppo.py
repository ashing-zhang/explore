"""Train a PPO agent on HotelBlockEnv.

Run:
- python -m training.train_ppo

Configuration:
- Default config: configs/default.yaml
- Override config path via environment variable HOTEL_RL_CONFIG=/path/to/config.yaml
"""

from __future__ import annotations

import logging
import os
from pathlib import Path

from core.config import AppConfig, from_yaml
from core.dotenv import load_default_dotenv
from core.logging import setup_logging
from core.paths import default_config_path, outputs_root
from env.hotel_block_env import HotelBlockEnv

LOGGER = logging.getLogger(__name__)


def _resolve_config_path() -> Path:
    """Resolve config path from environment or default."""
    env_path = os.environ.get("HOTEL_RL_CONFIG")
    if env_path:
        return Path(env_path).expanduser().resolve()
    return default_config_path()


def _ensure_dirs() -> dict[str, Path]:
    """Create output directories."""
    root = outputs_root()
    model_dir = root
    logs_dir = root / "training_logs"
    model_dir.mkdir(parents=True, exist_ok=True)
    logs_dir.mkdir(parents=True, exist_ok=True)
    return {"root": root, "model_dir": model_dir, "logs_dir": logs_dir}


def _build_env(config: AppConfig) -> HotelBlockEnv:
    """Create a single environment instance."""
    return HotelBlockEnv(config=config.env)


def main() -> None:
    """Run PPO training."""
    load_default_dotenv()
    config_path = _resolve_config_path()
    config = from_yaml(config_path)
    setup_logging(config.logging)

    try:
        from stable_baselines3 import PPO
        from stable_baselines3.common.monitor import Monitor
        from stable_baselines3.common.vec_env import DummyVecEnv
    except ModuleNotFoundError as exc:
        raise ModuleNotFoundError(
            "stable-baselines3 is required for training (pip install stable-baselines3)."
        ) from exc

    dirs = _ensure_dirs()
    env = DummyVecEnv([lambda: Monitor(_build_env(config))])

    LOGGER.info("Training PPO using config=%s", str(config_path))
    model = PPO(
        policy="MultiInputPolicy",
        env=env,
        verbose=1,
        n_steps=int(config.ppo.n_steps),
        batch_size=int(config.ppo.batch_size),
        gamma=float(config.ppo.gamma),
        learning_rate=float(config.ppo.learning_rate),
        tensorboard_log=str(dirs["logs_dir"] / "ppo"),
    )
    model.learn(total_timesteps=int(config.ppo.total_timesteps))

    model_path = dirs["model_dir"] / "trained_model.zip"
    model.save(str(model_path))
    LOGGER.info("Saved PPO model to %s", str(model_path))


if __name__ == "__main__":
    main()
