"""Demand simulator.

Run:
- Imported by the environment; no direct execution is required.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol


@dataclass(frozen=True, slots=True)
class DemandContext:
    """Inputs for demand generation."""

    base_demand: float
    seasonality_factor: float
    days_to_checkin: int
    selling_window: int
    event_factor: float


class DemandSimulator(Protocol):
    """Demand simulator protocol."""

    def sample_arrivals(self, ctx: DemandContext, rng: Any) -> int:
        """Return the number of arriving customers for the day."""


@dataclass(frozen=True, slots=True)
class DefaultDemandSimulator:
    """A simple demand model based on Poisson arrivals."""

    min_days_factor: float = 0.5
    max_days_factor: float = 2.0

    def days_to_checkin_factor(self, *, days_to_checkin: int, selling_window: int) -> float:
        """Compute a monotone factor that increases towards check-in."""
        selling_window = max(int(selling_window), 1)
        ratio = max(min(days_to_checkin / selling_window, 1.0), 0.0)
        return float(self.min_days_factor + (1.0 - ratio) * (self.max_days_factor - self.min_days_factor))

    def intensity(self, ctx: DemandContext) -> float:
        """Compute the Poisson intensity (lambda_t)."""
        days_factor = self.days_to_checkin_factor(
            days_to_checkin=ctx.days_to_checkin,
            selling_window=ctx.selling_window,
        )
        return float(ctx.base_demand * ctx.seasonality_factor * days_factor * ctx.event_factor)

    def sample_arrivals(self, ctx: DemandContext, rng: Any) -> int:
        """Sample Poisson arrivals using a NumPy-like RNG."""
        lam = max(self.intensity(ctx), 0.0)
        return int(rng.poisson(lam))

