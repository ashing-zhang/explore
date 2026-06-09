"""Booking probability model.

Run:
- Imported by the environment; no direct execution is required.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any, Protocol


class BookingModel(Protocol):
    """Booking model protocol."""

    def booking_probability(self, *, selling_price_ratio: float, competitor_price_ratio: float, beta: float) -> float:
        """Return booking probability in [0, 1]."""

    def sample_booking(self, *, selling_price_ratio: float, competitor_price_ratio: float, beta: float, rng: Any) -> bool:
        """Sample a Bernoulli booking outcome."""


@dataclass(frozen=True, slots=True)
class LogitBookingModel:
    """A logistic booking model with competitor advantage."""

    alpha: float
    gamma: float

    def booking_probability(self, *, selling_price_ratio: float, competitor_price_ratio: float, beta: float) -> float:
        """Compute booking probability using a sigmoid."""
        competitor_advantage_ratio = max(float(competitor_price_ratio) - float(selling_price_ratio), 0.0)
        x = float(self.alpha) - float(beta) * float(selling_price_ratio) + float(self.gamma) * competitor_advantage_ratio
        x = max(min(x, 60.0), -60.0)
        return float(1.0 / (1.0 + math.exp(-x)))

    def sample_booking(self, *, selling_price_ratio: float, competitor_price_ratio: float, beta: float, rng: Any) -> bool:
        """Sample a Bernoulli booking decision from the booking probability."""
        p = self.booking_probability(
            selling_price_ratio=selling_price_ratio,
            competitor_price_ratio=competitor_price_ratio,
            beta=beta,
        )
        return bool(rng.random() < p)
