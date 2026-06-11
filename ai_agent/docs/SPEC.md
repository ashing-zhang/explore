
# Hotel Package Inventory Pricing Agent - SPEC.md

## Product Goal

构建一个基于 LLM 的 Hotel Package Inventory Pricing Agent，作为酒店包房收益管理系统中的智能决策模块。

Agent负责：
- 分析市场数据
- 识别 Booking Window
- 判断市场热度
- 评估库存风险
- 生成定价建议
- 生成库存处置策略
- 输出可解释的决策原因

Agent不直接执行价格修改，而是向 Workflow 输出建议，由人工或业务系统执行。

---

## System Architecture
---

## Workflow

### Step 1 Data Collection

输入数据：

- 包房库存
- 已售库存
- OTA价格
- 酒店剩余库存
- 竞品价格
- 历史订单
- 历史价格
- 节假日与活动信息

输出：

Market Snapshot

---

### Step 2 Booking Window Analysis

分析：

- 当前是否进入Booking Window
- Window长度变化
- 需求启动时间变化

输出：

```json
{
  "window_status": "NOT_STARTED | IN_WINDOW | PASSED",
  "confidence": 0.0
}
```

---

### Step 3 Market Analysis

分析：

- OTA价格趋势
- 竞品价格趋势
- 酒店库存变化

输出：

```json
{
  "market_status": "COLD | NORMAL | HOT | EXTREME_HOT",
  "confidence": 0.0
}
```

---

### Step 4 Inventory Risk Analysis

分析：

- 剩余库存
- 销售速度
- 距离入住天数
- 市场需求情况

输出：

```json
{
  "inventory_risk": "LOW | MEDIUM | HIGH | CRITICAL",
  "confidence": 0.0
}
```

---

### Step 5 Pricing Recommendation

输出：

```json
{
  "recommended_price": 0,
  "min_price": 0,
  "max_price": 0,
  "reasoning": []
}
```

---

### Step 6 Inventory Strategy Recommendation

可选策略：

- HOLD
- PARTIAL_SELL
- AGGRESSIVE_SELL
- PRICE_UP
- PRICE_DOWN

输出：

```json
{
  "strategy": "",
  "reasoning": []
}
```

---

### Step 7 Human Review

支持：

- Approve
- Modify
- Reject

---

### Step 8 Execution

同步至：

- OTA
- CRM
- 内部销售系统

---

## LLM Agent Design

### Agent Inputs

```json
{
  "market_snapshot": {},
  "historical_orders": [],
  "historical_prices": [],
  "competitor_prices": [],
  "inventory_status": {}
}
```

### Agent Outputs

```json
{
  "market_status": "",
  "booking_window_status": "",
  "inventory_risk": "",
  "recommended_price": 0,
  "recommended_strategy": "",
  "confidence": 0.0,
  "reasoning": []
}
```

### Agent Requirements

- 输出必须为结构化JSON
- 必须提供决策理由
- 必须提供置信度
- 支持工具调用
- 支持历史上下文记忆
- 支持人工反馈修正
- 支持多轮分析

---

## Tools

Agent可调用：

### Market Data Tool

获取：

- OTA价格
- 酒店库存
- 竞品价格

### Historical Data Tool

获取：

- 历史订单
- 历史价格
- 历史库存

### Analytics Tool

计算：

- Booking Window指标
- Pickup指标
- Pace指标
- 市场热度指标

---

## Dashboard

### Overview

- 总库存
- 已售库存
- 剩余库存
- 风险库存

### Booking Window

- Window状态
- Window变化趋势

### Market Monitor

- OTA价格趋势
- 酒店库存趋势

### AI Recommendation

- 推荐价格
- 推荐策略
- 决策原因
- 置信度

### Risk Alert

- 滞销风险
- 错失窗口风险
- 卖断风险

---

## Suggested Tech Stack

### Frontend

- Next.js
- React
- Tailwind CSS
- ECharts

### Backend

- NestJS

### Agent Framework

- LangGraph
- OpenAI Agents SDK
- PydanticAI

### Workflow

- Temporal

### Database

- PostgreSQL
- Redis

---

## Future Enhancements

- Demand Forecasting Agent
- Competitor Monitoring Agent
- Multi-Agent Collaboration
- Automated Experimentation
- Human Feedback Learning
