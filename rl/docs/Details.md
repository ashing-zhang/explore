# Hotel Block Inventory Revenue Management RL 设计说明（归一化版）

## 目标与约束

目标：训练一个强化学习 Agent，在酒店包房业务场景中动态定价，使整个销售周期的累计利润最大。

约束（业务设定）：

- 已提前采购固定数量库存
- 每批库存对应唯一入住日期（一个 Episode）
- 入住日期后库存失效
- 每天允许调整售价
- 用户是否下单由市场仿真器决定

## 归一化原则

为避免状态/动作/奖励直接依赖绝对货币数值，所有与价格/利润相关的量都用相对值表达：

- `profit_ratio`：利润率（相对于成本价），用于动作与奖励
- `selling_price = cost_price * (1 + profit_ratio)`：由利润率映射到绝对售价（仅用于内部仿真与统计）
- 价格相关状态使用 `*_price_ratio = price / cost_price`
- 累计收入/利润使用相对于 `cost_price * initial_inventory` 的比例

## State Space（状态空间）

State 为 Dict（连续为主），所有价格/利润均为 ratio。

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

关键定义：

```python
days_to_checkin_ratio = days_to_checkin / selling_window
remaining_inventory_ratio = remaining_inventory / initial_inventory
current_price_ratio = current_price / cost_price
current_profit_ratio = current_price_ratio - 1
competitor_price_ratio = competitor_price / cost_price
competitor_price_gap_ratio = (current_price - competitor_price) / cost_price
```

销量相关：

```python
sales_last_k_days_ratio = avg_sales_last_k_days / initial_inventory
sales_growth_rate = (sales_last_5_days_ratio - sales_last_10_days_ratio) / max(sales_last_10_days_ratio, 1e-6)
```

累计相关：

```python
denom = cost_price * initial_inventory
cumulative_revenue_ratio = cumulative_revenue / denom
cumulative_profit_ratio = cumulative_profit / denom
```

## Action Space（动作空间）

连续动作：

```python
action = {
    profit_ratio: float
}
```

动作到售价映射：

```python
selling_price = cost_price * (1 + profit_ratio)
```

约束：

```python
0 <= profit_ratio <= max_profit_ratio
max_profit_ratio = min(max_profit_ratio_cap, max_price / cost_price - 1)
max_price = competitor_price * 2
```

动作频率：

```python
1 action = 1 day
```

## Reward（奖励）

Daily Reward（不使用绝对货币数值）：

```python
reward = rooms_sold_today * profit_ratio
```

库存持有惩罚：

```python
reward -= holding_penalty_alpha * remaining_inventory_ratio
```

期末滞销惩罚（仅 Episode 结束日生效）：

```python
reward -= expiration_penalty_weight * unsold_inventory_ratio
```

## Simulator（仿真器）

仿真器的设定与执行逻辑见 [simulator.md](./simulator.md)。

## 环境与运行

一个 Episode 对应一个入住日期，`selling_window` 天，每天一步。

在 `rl/` 目录下运行：

```text
python -m training.train_ppo
python -m training.train_sac
python -m evaluation.evaluate
```

## State Transition

每个 Step：

```text
1. Agent输出售价

2. Demand Simulator生成客户到达

3. Customer Booking Model生成订单

4. 更新库存

5. 更新累计销量

6. 更新累计收入

7. 更新累计利润

8. days_to_checkin减1

9. 返回next_state
```

---

## Termination Conditions

满足任意条件：

### Condition 1

```python
days_to_checkin == 0
```

---

### Condition 2

```python
remaining_inventory == 0
```

---

## Gym API

```python
class HotelBlockEnv(gym.Env):

    def reset(self):

        return state

    def step(self, action):

        return (
            next_state,
            reward,
            terminated,
            truncated,
            info
        )
```

---

# Environment Output Metrics

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

---

# Training Objective

最大化：

```python
expected_total_profit
```

即：

```python
maximize(
    cumulative_profit
)
```
