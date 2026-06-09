# Simulator（仿真器）

本项目的“市场仿真器”由三个部分组成，用于在每个时间步（1 天）内生成：到达客流、成交结果、竞品价格与竞品库存变化。它们共同决定环境在给定定价动作下的销量与利润反馈。

## 1. 需求到达（Demand）

每天到达客户数用泊松过程建模：

$$
\text{arrivals}_t \sim \mathrm{Poisson}(\lambda_t)
$$

其中强度（到达率）为：

$$
\lambda_t = \text{base\_demand}\cdot \text{seasonality}\cdot \text{days\_factor}\cdot \text{event}
$$

`days_factor` 用于刻画“越临近入住日需求越旺”的效应。令：
$$
r_t=\mathrm{clip}\left(\frac{\text{days\_to\_checkin}_t}{\text{selling\_window}},\,0,\,1\right)
$$

则：

$$
\text{days\_factor}_t=\text{min\_days\_factor}+(1-r_t)\cdot(\text{max\_days\_factor}-\text{min\_days\_factor})
$$

因此当 `days_to_checkin` 变小（更接近入住日）时，$r_t$ 下降，`days_factor` 上升，$\lambda_t$ 增大。

## 2. 预订概率（Booking）

对每天到达的每一个客户，使用一个 logit/sigmoid 模型决定其是否下单（伯努利试验）：

$$
p_t = \sigma(x_t)=\frac{1}{1+e^{-x_t}}
$$

$$
x_t = \alpha - \beta\cdot \text{selling\_price\_ratio}_t + \gamma\cdot \text{competitor\_advantage\_ratio}_t
$$

其中：

- $\text{selling\_price\_ratio}_t=\dfrac{\text{selling\_price}_t}{\text{cost\_price}}=1+\text{profit\_ratio}_t$
- $\text{competitor\_price\_ratio}_t=\dfrac{\text{competitor\_price}_t}{\text{cost\_price}}$
- $\text{competitor\_advantage\_ratio}_t=\max(\text{competitor\_price\_ratio}_t-\text{selling\_price\_ratio}_t,\,0)$

含义直观上是：

- 自己越贵（`selling_price_ratio` 越大），成交概率越低（由 $\beta$ 控制敏感度）
- 竞品相对更贵时（优势为正），自己的成交概率会上升（由 $\gamma$ 控制幅度）

每天的实际销量由对每个到达客户的伯努利结果累加，并受剩余库存上限约束。

## 3. 竞品模拟（Competitor）

竞品状态包含：初始库存、剩余库存、当前价格、近期销量。每日更新由一个规则系统完成：

1) 定价规则（按顺序乘系数）：

- 若 `inventory_ratio < 0.3`：价格上调（库存紧张，提价）
- 若 `days_to_checkin < 7`：价格上调（临近入住日，提价）
- 若 `recent_sales < target_sales`：价格下调（销量不达标，降价促销）

2) 竞品库存扣减：用当日估计的竞品销量 `estimated_sales_today` 从竞品库存中扣除，得到新的剩余库存。

该模块的作用是让竞品价格与库存随时间产生动态变化，进而影响“竞品相对优势”与成交概率。

## 4. 每日执行逻辑（集成流程）

在环境的一天（一个 step）里，仿真器的整体调用顺序可概括为：

1) 由动作 `profit_ratio` 得到 `selling_price_ratio` 与 `selling_price`
2) 采样当日到达客户数 `arrivals`
3) 对每个到达客户：根据 `p_book` 采样是否下单，更新销量、库存、收入、利润
4) 根据市场剩余客流估计竞品销量，更新竞品价格与竞品库存
5) 计算当日 reward，并在期末叠加滞销惩罚（若有）
6) 时间推进 1 天，进入下一步或终止

## 5. 例子：单日仿真流程

假设某个 episode 的参数如下（仅用于说明逻辑，数值是举例）：

- `cost_price = 300`
- `initial_inventory = 100`，当前 `remaining_inventory = 100`
- `selling_window = 20`，当前 `days_to_checkin = 10`
- `base_demand = 20`
- 当局采样到 `seasonality = 1.2`、`event = 1.5`、`beta = 2.0`
- `min_days_factor = 0.5`，`max_days_factor = 2.0`
- 竞品当前价格 `competitor_price = 500`
- 预订模型参数：`alpha = 6.0`，`gamma = 0.03`

### Step A：由动作得到售价

若智能体（或随机 baseline）在这一天选择：

$$
\text{profit\_ratio}=0.5
$$

则：

$$
\text{selling\_price\_ratio}=1+\text{profit\_ratio}=1.5,\quad
\text{selling\_price}=300\cdot 1.5=450
$$

### Step B：采样到达客户数

先计算：

$$
r=\frac{10}{20}=0.5,\quad
\text{days\_factor}=0.5+(1-0.5)\cdot(2.0-0.5)=1.25
$$

$$
\lambda = 20\cdot 1.2\cdot 1.25\cdot 1.5 = 45
$$

于是：

$$
\text{arrivals}\sim\mathrm{Poisson}(45)
$$

例如某次采样得到 `arrivals = 48`。

### Step C：逐客成交采样并更新库存/利润

先计算竞品相对比价：

$$
\text{competitor\_price\_ratio}=\frac{500}{300}\approx 1.667
$$

$$
\text{competitor\_advantage\_ratio}=\max(1.667-1.5,0)=0.167
$$

logit：

$$
x = 6.0 - 2.0\cdot 1.5 + 0.03\cdot 0.167 \approx 3.005
$$

成交概率：

$$
p=\sigma(3.005)\approx 0.953
$$

对 48 个到达客户逐个做伯努利采样（并受库存约束）。例如这一天实际成交 `rooms_sold_today = 44`，则：

- `remaining_inventory = 100 - 44 = 56`
- `revenue_today = 44 * 450 = 19,800`
- `profit_today = 44 * (450 - 300) = 6,600`

### Step D：更新竞品

先估计竞品销量（示例逻辑：竞品拿走剩余客流的一部分）：

$$
\text{estimated\_sales\_today}\approx 0.25\cdot \max(\text{arrivals}-\text{our\_sales},0)
=0.25\cdot(48-44)=1
$$

竞品根据规则更新价格（是否提价/降价取决于库存比例、距入住日、近期销量是否达标）。例如“销量不达标”触发降价，则竞品新价格为：

$$
\text{competitor\_price}_{t+1}=500\cdot 0.85 = 425
$$

并扣减竞品库存 `remaining_inventory_competitor -= 1`。

### Step E：reward 计算与时间推进

当日 reward（归一化形式）：

$$
\text{reward} = \text{rooms\_sold\_today}\cdot \text{profit\_ratio} - \text{holding\_penalty\_alpha}\cdot \text{remaining\_inventory\_ratio}
$$

如果这是最后一天（`days_to_checkin == 0`）则会额外叠加“期末滞销惩罚”：

$$
\text{reward}\mathrel{-}= \text{expiration\_penalty\_weight}\cdot \text{unsold\_inventory\_ratio}
$$

最后 `days_to_checkin -= 1`，进入下一天或终止 episode。

