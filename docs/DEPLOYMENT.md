# ADMINCHAT Panel - 部署文档

## Docker 镜像

### 镜像列表

| 镜像 | 说明 |
|------|------|
| `ghcr.io/<owner>/adminchat-backend` | 后端 (FastAPI + Bot) |
| `ghcr.io/<owner>/adminchat-frontend` | 前端 (Nginx 托管静态文件) |

### 后端 Dockerfile

```dockerfile
FROM python:3.12-slim

WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# 安装 Python 依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制代码
COPY . .

# 创建媒体缓存目录
RUN mkdir -p /app/media

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 前端 Dockerfile

```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# Production stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

## Docker Compose

```yaml
version: '3.8'

services:
  backend:
    image: ghcr.io/<owner>/adminchat-backend:latest
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    env_file: .env
    volumes:
      - media_cache:/app/media
    ports:
      - "8000:8000"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    image: ghcr.io/<owner>/adminchat-frontend:latest
    restart: unless-stopped
    ports:
      - "3000:80"

  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-adminchat}
      POSTGRES_USER: ${POSTGRES_USER:-adminchat}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-adminchat}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --appendonly yes
    volumes:
      - redisdata:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # 可选: Caddy 反向代理 (自动 HTTPS)
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config

volumes:
  pgdata:
  redisdata:
  media_cache:
  caddy_data:
  caddy_config:
```

## 环境变量 (.env)

```bash
# ===== 数据库 =====
POSTGRES_DB=adminchat
POSTGRES_USER=adminchat
POSTGRES_PASSWORD=<strong_password>
DATABASE_URL=postgresql+asyncpg://adminchat:<password>@postgres:5432/adminchat

# ===== Redis =====
REDIS_URL=redis://redis:6379/0

# ===== JWT =====
JWT_SECRET_KEY=<random_64_char_string>
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=60
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

# ===== Bot =====
BOT_MODE=webhook  # webhook | polling
WEBHOOK_BASE_URL=https://yourdomain.com
WEBHOOK_PATH=/webhook/bot

# ===== Cloudflare Turnstile =====
TURNSTILE_SITE_KEY=<site_key>
TURNSTILE_SECRET_KEY=<secret_key>
TURNSTILE_TTL_DAYS=30

# ===== 媒体缓存 =====
MEDIA_CACHE_TTL_DAYS=7
MEDIA_CACHE_DIR=/app/media

# ===== 初始管理员 =====
INIT_ADMIN_USERNAME=admin
INIT_ADMIN_PASSWORD=<initial_password>

# ===== AI (可选) =====
# AI_BASE_URL=https://api.openai.com/v1
# AI_API_KEY=sk-xxx
# AI_MODEL=gpt-4o-mini
```

## Caddyfile 示例

```
yourdomain.com {
    # 前端
    handle {
        reverse_proxy frontend:80
    }

    # 后端 API
    handle /api/* {
        reverse_proxy backend:8000
    }

    # WebSocket
    handle /ws/* {
        reverse_proxy backend:8000
    }

    # Webhook (Telegram)
    handle /webhook/* {
        reverse_proxy backend:8000
    }
}
```

## GitHub Actions CI/CD

```yaml
# .github/workflows/build-and-push.yml
name: Build and Push Docker Images

on:
  push:
    tags: ['v*']

env:
  REGISTRY: ghcr.io

jobs:
  build-backend:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v5
        with:
          context: ./backend
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ github.repository }}-backend:latest
            ${{ env.REGISTRY }}/${{ github.repository }}-backend:${{ github.ref_name }}

  build-frontend:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v5
        with:
          context: ./frontend
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ github.repository }}-frontend:latest
            ${{ env.REGISTRY }}/${{ github.repository }}-frontend:${{ github.ref_name }}
```

## 部署步骤

```bash
# 1. 克隆仓库 (仅需 docker-compose.yml + .env)
git clone <repo> && cd adminchat-panel

# 2. 配置环境变量
cp .env.example .env
vim .env  # 填写密码、密钥等

# 3. 启动
docker compose up -d

# 4. 首次运行: 自动执行数据库迁移 + 创建初始管理员

# 5. 检查状态
docker compose ps
docker compose logs -f backend
```

## 备份策略

```bash
# PostgreSQL 备份
docker compose exec postgres pg_dump -U adminchat adminchat > backup_$(date +%Y%m%d).sql

# 恢复
cat backup_20260321.sql | docker compose exec -T postgres psql -U adminchat adminchat
```
