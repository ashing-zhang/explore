# Hotel Block Inventory Revenue Management RL

本项目实现了一个用于“酒店包房库存收益管理（Hotel Block Inventory Revenue Management）”的强化学习环境与训练/评估脚本，目标是让智能体在售卖窗口内动态定价，以最大化整个库存生命周期的总利润。

对应环境与业务假设见 [SPEC.md](./SPEC.md)。

## 归一化建模

为避免状态/动作/奖励直接依赖绝对货币数值：

- 动作为 `profit_ratio`（利润率），`selling_price = cost_price * (1 + profit_ratio)`
- Daily Reward 使用 `rooms_sold_today * profit_ratio`（不直接使用绝对利润）
- 状态空间中的价格与累计指标也以 ratio（相对 `cost_price` 或 `cost_price * initial_inventory`）表达

## 目录结构

```
rl/
├── configs/                # YAML 配置（配置驱动）
├── core/                   # 配置加载、日志、路径工具
├── docs/                   # 项目文档（README/SPEC/Details/requirements）
├── env/                    # Gymnasium/Gym 环境实现
├── simulator/              # 需求/竞品/预订模型（可替换组件）
├── training/               # 训练入口（SB3 + RLlib 可选）
├── evaluation/             # 评估入口（报告 + 曲线图）
└── notebooks/              # 分析 Notebook
```

## 快速开始

建议在 `rl/` 目录下执行所有命令（保证 `python -m` 的模块导入路径正确）。

### 1) 训练（Stable-Baselines3）

```
python -m training.train_ppo
python -m training.train_sac
```

### 2) 训练（Ray RLlib，可选）

```
python -m training.train_rllib_ppo
python -m training.train_rllib_sac
```

### 3) 评估

```
python -m evaluation.evaluate
```

## 配置

默认配置文件：`configs/default.yaml`

支持通过 `rl/.env` 文件（或系统环境变量）设置以下变量：

- `HOTEL_RL_CONFIG`：配置文件路径（不设置则使用默认配置）
- `HOTEL_RL_MODEL`：评估时的模型路径（不设置则自动寻找 `rl/outputs/trained_model.zip`，若不存在则回退到 `rl/trained_model.zip`）

可通过环境变量覆盖配置路径（等价于在 `.env` 中设置）：

```
HOTEL_RL_CONFIG=/path/to/your.yaml python -m training.train_ppo
```

评估时可通过环境变量指定模型：

```
HOTEL_RL_MODEL=/path/to/trained_model.zip python -m evaluation.evaluate
```

## 主要输出

运行训练/评估后，默认在 `rl/` 目录下产生（若依赖缺失会自动降级，例如未安装 matplotlib 则不生成 PNG）：

- `trained_model.zip`
- `training_logs/`
- `outputs/evaluation_report.html`
- `outputs/profit_curve.png`
- `outputs/inventory_curve.png`
- `outputs/price_curve.png`

## 依赖（按需）

- 基础：`numpy`, `pyyaml`, `gymnasium`（或 `gym`）
- 训练（可选）：`stable-baselines3`
- RLlib 训练（可选）：`ray[rllib]`
- 画图（可选）：`matplotlib`

## 使用 uv 安装依赖

在 `rl/` 目录下：

```bash
uv venv
uv pip install -r docs/requirements.txt
```

可选依赖（按需选择其一或多个）：

```bash
uv pip install -r docs/requirements-train.txt
uv pip install -r docs/requirements-rllib.txt
uv pip install -r docs/requirements-plot.txt
```
