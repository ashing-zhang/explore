# Hotel Block Inventory Revenue Management RL Environment Specification

## Objective

Build a reinforcement learning environment that simulates hotel room booking behavior and trains a pricing policy for hotel block inventory revenue management.

Business setting:

- Fixed inventory is purchased from hotels.
- Inventory belongs to a specific stay date.
- Inventory expires after check-in date.
- The agent dynamically sets selling prices during the selling window.
- Objective: maximize total profit over the entire inventory lifecycle.

***

# Environment Definition

## Episode

One episode represents one stay date.

Example:

```yaml
stay_date: 2026-08-01
inventory: 100
cost_price: 300
selling_window: 60 days
```

Time step:

```yaml
1 step = 1 day
```

Episode length:

```yaml
T = selling_window
```

***

# State Space

```python
state = {
    days_to_checkin_ratio: float,

    remaining_inventory_ratio: float,

    current_price_ratio: float,

    current_profit_ratio: float,

    competitor_price_ratio: float,

    competitor_price_gap_ratio: float,

    hotel_closed: int,

    sales_last_1_day_ratio: float,

    sales_last_3_days_ratio: float,

    sales_last_5_days_ratio: float,

    sales_last_10_days_ratio: float,

    sales_growth_rate: float,

    cumulative_sales_ratio: float,

    cumulative_revenue_ratio: float,

    cumulative_profit_ratio: float
}
```

Definitions:

```python
days_to_checkin_ratio =
days_to_checkin / selling_window
```

```python
remaining_inventory_ratio =
remaining_inventory / initial_inventory
```

```python
current_price_ratio =
current_price / cost_price
```

```python
current_profit_ratio =
current_price_ratio - 1
```

```python
competitor_price_ratio =
competitor_price / cost_price
```

```python
competitor_price_gap_ratio =
(current_price - competitor_price) / cost_price
```

```python
sales_growth_rate =
(avg_sales_last_5_days -
 avg_sales_last_10_days)
/
max(avg_sales_last_10_days, 1)
```

***

# Action Space

Continuous action space:

```python
action = {
    profit_ratio: float
}
```

Action to price:

```python
selling_price = cost_price * (1 + profit_ratio)
```

Constraints:

```python
0 <= profit_ratio <= max_profit_ratio
```

Example:

```python
max_price = competitor_price * 2
max_profit_ratio = max_price / cost_price - 1
```

***

# Market Simulator

## Daily Customer Arrivals

For each day:

```python
num_customers ~ Poisson(lambda_t)
```

where

```python
lambda_t =
base_demand
*
seasonality_factor
*
days_to_checkin_factor
*
event_factor
```

***

## Booking Probability

For each arriving customer:

```python
p_book =
sigmoid(
    alpha
    -
    beta * selling_price_ratio
    +
    gamma * competitor_advantage
)
```

where

```python
selling_price_ratio =
selling_price / cost_price
```

```python
competitor_advantage =
max(
    competitor_price_ratio - selling_price_ratio,
    0
)
```

Booking decision:

```python
book ~ Bernoulli(p_book)
```

Inventory decreases when booking succeeds.

***

# Competitor Simulator

Competitor state:

```python
competitor_inventory
competitor_price
```

Daily pricing rule:

```python
if inventory_ratio < 0.3:
    competitor_price *= 1.1

if days_to_checkin < 7:
    competitor_price *= 1.2

if recent_sales < target_sales:
    competitor_price *= 0.85
```

***

# Inventory Expiration

At:

```python
days_to_checkin == 0
```

All remaining inventory expires.

Unsold inventory becomes:

```python
value = 0
```

Episode terminates.

***

# Reward Function

Daily reward:

```python
reward =
rooms_sold_today
*
profit_ratio
```

Inventory holding penalty:

```python
reward -=
alpha
*
remaining_inventory_ratio
```

Expiration penalty:

Applied only at episode end.

```python
reward -=
expiration_penalty_weight
*
unsold_inventory_ratio
```

***

# Environment API

```python
class HotelBlockEnv(gym.Env):

    def reset(self):
        pass

    def step(self, action):
        pass

    def render(self):
        pass
```

Return format:

```python
(
    next_state,
    reward,
    terminated,
    truncated,
    info
)
```

***

# Configuration

```yaml
initial_inventory: 100

cost_price: 300

selling_window: 60

base_demand: 20

seasonality_factor:
  min: 0.5
  max: 2.0

event_factor:
  min: 1.0
  max: 3.0

price_elasticity:
  min: 1.0
  max: 3.0

max_profit_ratio_cap: 5.0

expiration_penalty_weight: 1.0
```

***

# Training Interface

Environment must support:

```python
Stable-Baselines3 PPO

Stable-Baselines3 SAC

Ray RLlib PPO

Ray RLlib SAC
```

***

# Evaluation Metrics

```python
total_profit
```

```python
profit_margin
```

```python
sell_through_rate
```

```python
average_daily_rate
```

```python
revpar
```

```python
inventory_waste_rate
```

***

# Deliverables

Implement:

```text
rl/
├── env/
│   └── hotel_block_env.py
├── simulator/
│   ├── demand_simulator.py
│   ├── competitor_simulator.py
│   └── booking_model.py
├── training/
│   ├── train_ppo.py
│   ├── train_sac.py
│   ├── train_rllib_ppo.py
│   └── train_rllib_sac.py
├── evaluation/
│   └── evaluate.py
├── core/
│   ├── config.py
│   ├── logging.py
│   └── paths.py
├── configs/
│   └── default.yaml
└── notebooks/
    └── analysis.ipynb
```

Required outputs:

```text
trained_model.zip
training_logs/
evaluation_report.html
profit_curve.png
inventory_curve.png
price_curve.png
```
