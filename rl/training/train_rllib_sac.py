"""Train an RLlib SAC agent on HotelBlockEnv.

Run:
- python -m training.train_rllib_sac

Configuration:
- Default config: configs/default.yaml
- Override config path via environment variable HOTEL_RL_CONFIG=/path/to/config.yaml
"""

from __future__ import annotations

import logging
import os
from pathlib import Path

from core.dotenv import load_default_dotenv
from core.config import from_yaml
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


def main() -> None:
    """Run RLlib SAC training."""
    load_default_dotenv()
    config_path = _resolve_config_path()
    config = from_yaml(config_path)
    setup_logging(config.logging)

    try:
        import ray
        from ray.rllib.algorithms.sac import SACConfig
        from ray.tune.registry import register_env
    except ModuleNotFoundError as exc:
        raise ModuleNotFoundError("ray[rllib] is required for RLlib training (pip install 'ray[rllib]').") from exc

    def env_creator(env_config: dict) -> HotelBlockEnv:
        """Create a new environment for RLlib workers."""
        _ = env_config
        return HotelBlockEnv(config=config.env)

    register_env("HotelBlockEnv", env_creator)

    ray.init(ignore_reinit_error=True, include_dashboard=False, logging_level=logging.ERROR)
    algo_config = (
        SACConfig()
        .environment(env="HotelBlockEnv")
        .framework("torch")
        .rollouts(num_rollout_workers=0)
    )
    algo = algo_config.build()

    LOGGER.info("Training RLlib SAC using config=%s", str(config_path))
    for _ in range(max(int(config.sac.total_timesteps) // 10_000, 1)):
        algo.train()

    out = outputs_root()
    out.mkdir(parents=True, exist_ok=True)
    checkpoint_dir = algo.save(str(out / "rllib_checkpoints"))
    LOGGER.info("Saved RLlib SAC checkpoint to %s", str(checkpoint_dir))
    ray.shutdown()


if __name__ == "__main__":
    main()
