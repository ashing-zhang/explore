"""Competitor simulator.

Run:
- Imported by the environment; no direct execution is required.
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from typing import Protocol


@dataclass(frozen=True, slots=True)
class CompetitorState:
    """Competitor internal state."""

    initial_inventory: int
    remaining_inventory: int
    price: float
    recent_sales: float = 0.0

    @property
    def inventory_ratio(self) -> float:
        """Return remaining_inventory / initial_inventory."""
        denom = max(self.initial_inventory, 1)
        return float(self.remaining_inventory / denom)


@dataclass(frozen=True, slots=True)
class CompetitorStepContext:
    """Inputs for competitor daily update."""

    days_to_checkin: int
    target_sales: float
    estimated_sales_today: int


class CompetitorSimulator(Protocol):
    """Competitor simulator protocol."""

    def reset(self) -> CompetitorState:
        """Reset competitor state for a new episode."""

    def step(self, state: CompetitorState, ctx: CompetitorStepContext) -> CompetitorState:
        """Update competitor state by one day."""


@dataclass(frozen=True, slots=True)
class RuleBasedCompetitorSimulator:
    """A simple competitor pricing rule based on inventory pressure and time-to-checkin."""

    initial_inventory: int
    initial_price: float

    def reset(self) -> CompetitorState:
        """Reset competitor state."""
        return CompetitorState(
            initial_inventory=int(self.initial_inventory),
            remaining_inventory=int(self.initial_inventory),
            price=float(self.initial_price),
            recent_sales=0.0,
        )

    def step(self, state: CompetitorState, ctx: CompetitorStepContext) -> CompetitorState:
        """Apply the daily pricing rule and decrement inventory."""
        next_price = float(state.price)
        if state.inventory_ratio < 0.3:
            next_price *= 1.1
        if ctx.days_to_checkin < 7:
            next_price *= 1.2
        if float(state.recent_sales) < float(ctx.target_sales):
            next_price *= 0.85

        estimated_sales_today = max(int(ctx.estimated_sales_today), 0)
        remaining_inventory = max(int(state.remaining_inventory) - estimated_sales_today, 0)

        return replace(
            state,
            price=max(next_price, 0.0),
            remaining_inventory=remaining_inventory,
            recent_sales=float(estimated_sales_today),
        )

