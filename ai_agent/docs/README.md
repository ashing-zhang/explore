# ai_agent 运行指南

本项目包含两个独立的 Node.js 应用：

- `ai_agent/backend`：NestJS API 服务（默认端口 `3001`，统一前缀 `/api`）
- `ai_agent/frontend`：Next.js 前端（默认端口 `3000`）

---

## 1. 启动 Backend（NestJS）

进入目录并安装依赖：

```bash
cd ai_agent/backend
npm install
```

启动开发模式（watch）：

```bash
npm run start:dev
```

默认 API Base URL：

- `http://localhost:3001/api`

常用接口示例：

- `GET /api/dashboard/overview`
- `GET /api/agent/market-snapshot`
- `GET /api/agent/recommendation`

---

## 2. 启动 Frontend（Next.js）

进入目录并安装依赖：

```bash
cd ai_agent/frontend
npm install
```

启动开发模式：

```bash
npm run dev
```

默认访问地址：

- `http://localhost:3000`

前端通过环境变量 `NEXT_PUBLIC_API_BASE_URL` 指向后端接口；未设置时默认使用：

- `http://localhost:3001/api`

相关实现见：`frontend/src/lib/api.ts`

---

## 3. 数据源（Mock / Postgres）切换

Backend 通过环境变量 `DATA_PROVIDER` 选择数据提供者：

- `DATA_PROVIDER=mock`（默认）：使用内置 Mock 数据
- `DATA_PROVIDER=postgres`：从 PostgreSQL 读取数据

如果启用 `postgres`，还需要设置以下连接参数：

- `PGHOST`
- `PGPORT`
- `PGDATABASE`
- `PGUSER`
- `PGPASSWORD`
- `PGSSLMODE`（可选，设为 `require` 时启用 TLS）

Backend 查询的表名可在 `backend/src/modules/data-provider/providers/postgres-data-provider.ts` 中看到，包括：

- `market_prices`
- `competitor_prices`
- `inventory_status`
- `orders`
- `historical_prices`

---

## 4. OpenAI（可选）

Backend 若设置了 `OPENAI_API_KEY` 会尝试调用 OpenAI 生成推荐；未设置时会自动降级为启发式策略，不影响服务启动。

可选环境变量：

- `OPENAI_API_KEY`
- `OPENAI_MODEL`（默认：`gpt-4.1-mini`）

---

## 5. 端口与跨域（可选）

Backend 相关环境变量：

- `PORT`（默认：`3001`）
- `CORS_ORIGIN`（默认：允许所有来源）

---

## 6. 使用 Docker 同时启动 Backend + Frontend

在 `ai_agent` 目录下使用 Docker Compose 一键启动：

```bash
cd ai_agent
docker compose up --build
```

启动后访问：

- Frontend：`http://localhost:3000`
- Backend：`http://localhost:3001/api`

Docker Compose 默认配置：

- Backend：`DATA_PROVIDER=mock`，并暴露 `3001:3001`
- Frontend：通过 `NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api` 访问后端，并暴露 `3000:3000`

相关配置文件位置：

- `ai_agent/docker-compose.yml`
- `ai_agent/backend/Dockerfile`
- `ai_agent/frontend/Dockerfile`

如果修改了 `docker-compose.yml` 中的环境变量（例如 `DATA_PROVIDER`），可先停止当前容器编排，再重新启动：

```bash
cd ai_agent
docker compose down
docker compose up -d
```

这样可以确保新的环境变量配置重新注入到容器中并生效。
