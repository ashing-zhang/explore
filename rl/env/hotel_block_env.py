"""Hotel block inventory revenue management environment.

Run:
- Train PPO: python -m training.train_ppo
- Train SAC: python -m training.train_sac
- Evaluate: python -m evaluation.evaluate

Notes:
- Action is profit_ratio, with selling_price = cost_price * (1 + profit_ratio).
"""

from __future__ import annotations

import logging
from collections import deque
from dataclasses import dataclass
from typing import Any

import numpy as np

try:
    import gymnasium as gym
    from gymnasium import spaces
except ModuleNotFoundError:
    import gym
    from gym import spaces

from core.config import EnvConfig
from simulator.booking_model import BookingModel, LogitBookingModel
from simulator.competitor_simulator import (
    CompetitorSimulator,
    CompetitorStepContext,
    CompetitorState,
    RuleBasedCompetitorSimulator,
)
from simulator.demand_simulator import DefaultDemandSimulator, DemandContext, DemandSimulator

LOGGER = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class EpisodeFactors:
    """Stochastic factors sampled per episode."""

    seasonality: float
    event: float
    price_elasticity: float


def _safe_mean(values: list[float]) -> float:
    """Compute mean with an empty-list guard."""
    if not values:
        return 0.0
    return float(sum(values) / len(values))


class HotelBlockEnv(gym.Env):
    """A Gymnasium-compatible environment for hotel block inventory pricing."""

    metadata = {"render_modes": ["human"]}

    def __init__(
        self,
        *,
        config: EnvConfig,
        demand_simulator: DemandSimulator | None = None,
        competitor_simulator: CompetitorSimulator | None = None,
        booking_model: BookingModel | None = None,
    ) -> None:
        """Create the environment."""
        super().__init__()
        self._config = config
        self._config.validate()

        self._demand_simulator = demand_simulator or DefaultDemandSimulator()
        self._competitor_simulator = competitor_simulator or RuleBasedCompetitorSimulator(
            initial_inventory=config.initial_inventory,
            initial_price=config.competitor_initial_price,
        )
        self._booking_model = booking_model or LogitBookingModel(
            alpha=config.booking_alpha,
            gamma=config.booking_gamma,
        )

        self._rng = np.random.default_rng()

        self._initial_inventory = int(config.initial_inventory)
        self._remaining_inventory = int(config.initial_inventory)
        self._days_to_checkin = int(config.selling_window)
        self._current_price = float(config.cost_price)
        self._hotel_closed = 0

        self._competitor_state: CompetitorState = self._competitor_simulator.reset()
        self._factors = EpisodeFactors(seasonality=1.0, event=1.0, price_elasticity=1.0)

        self._sales_history: deque[int] = deque(maxlen=10)
        self._cumulative_sales = 0
        self._cumulative_revenue = 0.0
        self._cumulative_profit = 0.0
        self._last_arrivals = 0
        self._last_sales_today = 0
        self._last_profit_ratio = 0.0

        self.action_space = spaces.Box(
            low=np.array([0.0], dtype=np.float32),
            high=np.array([float(config.max_profit_ratio_cap)], dtype=np.float32),
            shape=(1,),
            dtype=np.float32,
        )

        ratio_high = np.array([50.0], dtype=np.float32)
        self.observation_space = spaces.Dict(
            {
                "days_to_checkin_ratio": spaces.Box(low=np.array([0.0], dtype=np.float32), high=np.array([1.0], dtype=np.float32), shape=(1,), dtype=np.float32),
                "remaining_inventory_ratio": spaces.Box(low=np.array([0.0], dtype=np.float32), high=np.array([1.0], dtype=np.float32), shape=(1,), dtype=np.float32),
                "current_price_ratio": spaces.Box(low=np.array([0.0], dtype=np.float32), high=ratio_high, shape=(1,), dtype=np.float32),
                "current_profit_ratio": spaces.Box(low=np.array([0.0], dtype=np.float32), high=ratio_high, shape=(1,), dtype=np.float32),
                "competitor_price_ratio": spaces.Box(low=np.array([0.0], dtype=np.float32), high=ratio_high, shape=(1,), dtype=np.float32),
                "competitor_price_gap_ratio": spaces.Box(low=-ratio_high, high=ratio_high, shape=(1,), dtype=np.float32),
                "hotel_closed": spaces.Discrete(2),
                "sales_last_1_day_ratio": spaces.Box(low=np.array([0.0], dtype=np.float32), high=np.array([1.0], dtype=np.float32), shape=(1,), dtype=np.float32),
                "sales_last_3_days_ratio": spaces.Box(low=np.array([0.0], dtype=np.float32), high=np.array([1.0], dtype=np.float32), shape=(1,), dtype=np.float32),
                "sales_last_5_days_ratio": spaces.Box(low=np.array([0.0], dtype=np.float32), high=np.array([1.0], dtype=np.float32), shape=(1,), dtype=np.float32),
                "sales_last_10_days_ratio": spaces.Box(low=np.array([0.0], dtype=np.float32), high=np.array([1.0], dtype=np.float32), shape=(1,), dtype=np.float32),
                "sales_growth_rate": spaces.Box(low=np.array([-10.0], dtype=np.float32), high=np.array([10.0], dtype=np.float32), shape=(1,), dtype=np.float32),
                "cumulative_sales_ratio": spaces.Box(low=np.array([0.0], dtype=np.float32), high=np.array([1.0], dtype=np.float32), shape=(1,), dtype=np.float32),
                "cumulative_revenue_ratio": spaces.Box(low=np.array([0.0], dtype=np.float32), high=ratio_high, shape=(1,), dtype=np.float32),
                "cumulative_profit_ratio": spaces.Box(low=-ratio_high, high=ratio_high, shape=(1,), dtype=np.float32),
            }
        )

    def reset(self, *, seed: int | None = None, options: dict[str, Any] | None = None) -> tuple[dict[str, Any], dict[str, Any]]:
        """Reset environment for a new episode."""
        super().reset(seed=seed)
        if seed is not None:
            self._rng = np.random.default_rng(int(seed))

        env_seed = None
        if options and "seed" in options:
            env_seed = int(options["seed"])
        if env_seed is not None:
            self._rng = np.random.default_rng(env_seed)

        self._initial_inventory = int(self._config.initial_inventory)
        self._remaining_inventory = int(self._config.initial_inventory)
        self._days_to_checkin = int(self._config.selling_window)
        self._current_price = float(self._config.cost_price)
        self._hotel_closed = 0

        self._competitor_state = self._competitor_simulator.reset()

        self._factors = EpisodeFactors(
            seasonality=self._config.seasonality_factor.sample(self._rng),
            event=self._config.event_factor.sample(self._rng),
            price_elasticity=self._config.price_elasticity.sample(self._rng),
        )

        self._sales_history.clear()
        self._cumulative_sales = 0
        self._cumulative_revenue = 0.0
        self._cumulative_profit = 0.0
        self._last_arrivals = 0
        self._last_sales_today = 0
        self._last_profit_ratio = 0.0

        obs = self._build_observation()
        info = {"episode_factors": self._factors}
        return obs, info

    def step(self, action: Any) -> tuple[dict[str, Any], float, bool, bool, dict[str, Any]]:
        """Advance the simulation by one day."""
        if self._days_to_checkin <= 0:
            obs = self._build_observation()
            return obs, 0.0, True, False, {"reason": "already_terminated"}

        raw_profit_ratio = float(np.asarray(action, dtype=np.float32).reshape(-1)[0])
        competitor_price = float(self._competitor_state.price)
        cost_price = float(self._config.cost_price)
        max_price = max(cost_price, competitor_price * float(self._config.max_price_multiplier))
        dynamic_max_profit_ratio = max(max_price / max(cost_price, 1e-12) - 1.0, 0.0)
        profit_ratio = float(np.clip(raw_profit_ratio, 0.0, float(self._config.max_profit_ratio_cap)))
        profit_ratio = float(min(profit_ratio, dynamic_max_profit_ratio))
        selling_price = float(cost_price * (1.0 + profit_ratio))
        selling_price_ratio = float(1.0 + profit_ratio)
        competitor_price_ratio = float(competitor_price / max(cost_price, 1e-12))

        self._hotel_closed = 1 if (self._rng.random() < float(self._config.hotel_close_prob)) else 0

        arrivals = self._simulate_arrivals()
        sales_today = 0
        revenue_today = 0.0
        profit_today = 0.0

        if self._hotel_closed == 0:
            for _ in range(arrivals):
                if self._remaining_inventory <= 0:
                    break
                booked = self._booking_model.sample_booking(
                    selling_price_ratio=selling_price_ratio,
                    competitor_price_ratio=competitor_price_ratio,
                    beta=float(self._factors.price_elasticity),
                    rng=self._rng,
                )
                if booked:
                    sales_today += 1
                    self._remaining_inventory -= 1
                    revenue_today += selling_price
                    profit_today += selling_price - cost_price

        self._current_price = selling_price
        self._last_arrivals = int(arrivals)
        self._last_sales_today = int(sales_today)
        self._last_profit_ratio = float(profit_ratio)

        self._cumulative_sales += int(sales_today)
        self._cumulative_revenue += float(revenue_today)
        self._cumulative_profit += float(profit_today)

        self._sales_history.append(int(sales_today))

        estimated_comp_sales = self._estimate_competitor_sales(arrivals=arrivals, our_sales=sales_today)
        self._competitor_state = self._competitor_simulator.step(
            self._competitor_state,
            CompetitorStepContext(
                days_to_checkin=int(self._days_to_checkin),
                target_sales=float(self._config.competitor_target_sales),
                estimated_sales_today=int(estimated_comp_sales),
            ),
        )

        remaining_inventory_ratio = float(self._remaining_inventory) / float(max(self._initial_inventory, 1))
        holding_penalty = float(self._config.holding_penalty_alpha) * remaining_inventory_ratio
        reward = float(sales_today) * float(profit_ratio) - holding_penalty

        terminated = False
        truncated = False

        self._days_to_checkin -= 1

        if self._remaining_inventory <= 0:
            terminated = True
        elif self._days_to_checkin == 0:
            terminated = True
            unsold_ratio = float(self._remaining_inventory) / float(max(self._initial_inventory, 1))
            reward -= float(self._config.expiration_penalty_weight) * unsold_ratio

        obs = self._build_observation()
        denom_total = float(max(self._initial_inventory, 1)) * float(max(cost_price, 1e-12))
        cumulative_revenue_ratio = float(self._cumulative_revenue) / denom_total
        cumulative_profit_ratio = float(self._cumulative_profit) / denom_total
        info = {
            "arrivals": int(arrivals),
            "rooms_sold_today": int(sales_today),
            "profit_ratio": float(profit_ratio),
            "selling_price": float(selling_price),
            "selling_price_ratio": float(selling_price_ratio),
            "competitor_price": float(self._competitor_state.price),
            "competitor_price_ratio": float(competitor_price_ratio),
            "price_bounds": {"min": float(cost_price), "max": float(max_price)},
            "revenue_today": float(revenue_today),
            "profit_today": float(profit_today),
            "holding_penalty": float(holding_penalty),
            "cumulative_sales": int(self._cumulative_sales),
            "cumulative_revenue": float(self._cumulative_revenue),
            "cumulative_profit": float(self._cumulative_profit),
            "cumulative_revenue_ratio": float(cumulative_revenue_ratio),
            "cumulative_profit_ratio": float(cumulative_profit_ratio),
            "remaining_inventory": int(self._remaining_inventory),
            "remaining_inventory_ratio": float(remaining_inventory_ratio),
            "days_to_checkin": int(self._days_to_checkin),
            "hotel_closed": int(self._hotel_closed),
        }
        return obs, float(reward), bool(terminated), bool(truncated), info

    def render(self) -> None:
        """Render a human-readable single-line status."""
        LOGGER.info(
            "dtc=%s inv=%s/%s profit_ratio=%.4f price=%.2f comp=%.2f sold=%s arrivals=%s profit=%.2f",
            self._days_to_checkin,
            self._remaining_inventory,
            self._initial_inventory,
            self._last_profit_ratio,
            self._current_price,
            float(self._competitor_state.price),
            self._last_sales_today,
            self._last_arrivals,
            self._cumulative_profit,
        )

    def _simulate_arrivals(self) -> int:
        """Sample daily arrivals using the demand simulator."""
        ctx = DemandContext(
            base_demand=float(self._config.base_demand),
            seasonality_factor=float(self._factors.seasonality),
            days_to_checkin=int(self._days_to_checkin),
            selling_window=int(self._config.selling_window),
            event_factor=float(self._factors.event),
        )
        return int(self._demand_simulator.sample_arrivals(ctx, rng=self._rng))

    def _estimate_competitor_sales(self, *, arrivals: int, our_sales: int) -> int:
        """Estimate competitor sales for inventory depletion."""
        remaining_market = max(int(arrivals) - int(our_sales), 0)
        share = 0.25
        estimate = int(round(remaining_market * share))
        return max(estimate, 0)

    def _build_observation(self) -> dict[str, Any]:
        """Build the observation dict."""
        cost_price = float(self._config.cost_price)
        denom_cost = float(max(cost_price, 1e-12))
        denom_total = float(max(self._initial_inventory, 1)) * denom_cost

        days_to_checkin_ratio = float(self._days_to_checkin) / float(max(int(self._config.selling_window), 1))
        remaining_inventory_ratio = float(self._remaining_inventory) / float(max(self._initial_inventory, 1))
        competitor_price = float(self._competitor_state.price)
        current_price_ratio = float(self._current_price / denom_cost)
        competitor_price_ratio = float(competitor_price / denom_cost)
        profit_ratio = float(max(current_price_ratio - 1.0, 0.0))
        price_gap_ratio = float((self._current_price - competitor_price) / denom_cost)

        history = list(self._sales_history)
        sales_last_1 = history[-1] if history else 0
        sales_last_3 = _safe_mean([float(x) for x in history[-3:]])
        sales_last_5 = _safe_mean([float(x) for x in history[-5:]])
        sales_last_10 = _safe_mean([float(x) for x in history[-10:]])

        sales_last_1_ratio = float(sales_last_1) / float(max(self._initial_inventory, 1))
        sales_last_3_ratio = float(sales_last_3) / float(max(self._initial_inventory, 1))
        sales_last_5_ratio = float(sales_last_5) / float(max(self._initial_inventory, 1))
        sales_last_10_ratio = float(sales_last_10) / float(max(self._initial_inventory, 1))
        growth = (sales_last_5_ratio - sales_last_10_ratio) / max(sales_last_10_ratio, 1e-6)

        cumulative_sales_ratio = float(self._cumulative_sales) / float(max(self._initial_inventory, 1))
        cumulative_revenue_ratio = float(self._cumulative_revenue) / denom_total
        cumulative_profit_ratio = float(self._cumulative_profit) / denom_total

        return {
            "days_to_checkin_ratio": np.array([days_to_checkin_ratio], dtype=np.float32),
            "remaining_inventory_ratio": np.array([remaining_inventory_ratio], dtype=np.float32),
            "current_price_ratio": np.array([current_price_ratio], dtype=np.float32),
            "current_profit_ratio": np.array([profit_ratio], dtype=np.float32),
            "competitor_price_ratio": np.array([competitor_price_ratio], dtype=np.float32),
            "competitor_price_gap_ratio": np.array([price_gap_ratio], dtype=np.float32),
            "hotel_closed": int(self._hotel_closed),
            "sales_last_1_day_ratio": np.array([sales_last_1_ratio], dtype=np.float32),
            "sales_last_3_days_ratio": np.array([sales_last_3_ratio], dtype=np.float32),
            "sales_last_5_days_ratio": np.array([sales_last_5_ratio], dtype=np.float32),
            "sales_last_10_days_ratio": np.array([sales_last_10_ratio], dtype=np.float32),
            "sales_growth_rate": np.array([float(growth)], dtype=np.float32),
            "cumulative_sales_ratio": np.array([cumulative_sales_ratio], dtype=np.float32),
            "cumulative_revenue_ratio": np.array([cumulative_revenue_ratio], dtype=np.float32),
            "cumulative_profit_ratio": np.array([cumulative_profit_ratio], dtype=np.float32),
        }
