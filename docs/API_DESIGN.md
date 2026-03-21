# ADMINCHAT Panel - API 接口设计文档

## 基础信息

- Base URL: `/api/v1`
- 认证: JWT Bearer Token (Header: `Authorization: Bearer <token>`)
- 响应格式: JSON
- 时间格式: ISO 8601 (UTC)
- 分页: `?page=1&page_size=20`

## 通用响应格式

```json
{
  "code": 200,
  "message": "success",
  "data": { ... }
}
```

```json
{
  "code": 400,
  "message": "error description",
  "data": null
}
```

---

## 1. 认证 (Auth)

| Method | Path | 说明 | 权限 |
|--------|------|------|------|
| POST | `/auth/login` | 登录 | 公开 |
| POST | `/auth/refresh` | 刷新 Token | 已登录 |
| POST | `/auth/logout` | 登出 | 已登录 |
| GET | `/auth/me` | 当前用户信息 | 已登录 |

### POST /auth/login

```json
// Request
{ "username": "admin", "password": "xxx" }

// Response
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer",
  "expires_in": 3600,
  "user": {
    "id": 1,
    "username": "admin",
    "role": "super_admin",
    "display_name": "Administrator"
  }
}
```

---

## 2. 统计 (Stats)

| Method | Path | 说明 | 权限 |
|--------|------|------|------|
| GET | `/stats/dashboard` | 面板统计数据 | agent+ |

### GET /stats/dashboard

```json
// Response
{
  "total_conversations": 1523,
  "open_conversations": 89,
  "resolved_conversations": 1400,
  "blocked_users": 34,
  "total_messages_today": 456,
  "faq_hit_rate": 0.72,
  "active_bots": 3
}
```

---

## 3. 会话 (Conversations)

| Method | Path | 说明 | 权限 |
|--------|------|------|------|
| GET | `/conversations` | 会话列表 | agent+ |
| GET | `/conversations/:id` | 会话详情 | agent+ |
| PATCH | `/conversations/:id/status` | 更新状态 (已处理/未处理) | agent+ |
| PATCH | `/conversations/:id/assign` | 分配客服 | admin+ |

### GET /conversations

```
Query Params:
  status: open | resolved | blocked
  source_type: private | group
  assigned_to: admin_id (可选)
  search: 关键字搜索
  page, page_size
  sort: last_message_at | created_at
```

```json
// Response item
{
  "id": 1,
  "user": {
    "tg_uid": 123456789,
    "username": "john",
    "first_name": "John",
    "tags": [{"name": "VIP", "color": "#EF4444"}],
    "photo_url": "/api/v1/users/1/photo"
  },
  "source_type": "group",
  "source_group": {
    "title": "HALO",
    "tg_chat_id": -100123456
  },
  "status": "open",
  "assigned_to": null,
  "primary_bot": {"bot_username": "mybot1"},
  "last_message": {
    "text_content": "你好，请问...",
    "created_at": "2026-03-21T10:30:00Z"
  },
  "unread_count": 3,
  "last_message_at": "2026-03-21T10:30:00Z"
}
```

---

## 4. 消息 (Messages)

| Method | Path | 说明 | 权限 |
|--------|------|------|------|
| GET | `/conversations/:id/messages` | 获取消息历史 | agent+ |
| POST | `/conversations/:id/messages` | 发送消息 | agent+ |
| GET | `/messages/:id/media` | 获取媒体文件 | agent+ |

### POST /conversations/:id/messages

```json
// 发送文本
{
  "content_type": "text",
  "text_content": "**加粗** 的回复内容",
  "parse_mode": "MarkdownV2"
}

// 发送图片
// Content-Type: multipart/form-data
// file: <binary>
// text_content: "图片描述 (可选)"
```

---

## 5. TG 用户 (Users)

| Method | Path | 说明 | 权限 |
|--------|------|------|------|
| GET | `/users` | 用户列表 (Grid) | agent+ |
| GET | `/users/:id` | 用户详情 | agent+ |
| GET | `/users/search` | 搜索 (TGUID/tag/用户名) | agent+ |
| POST | `/users/:id/block` | 拉黑 | admin+ |
| POST | `/users/:id/unblock` | 取消拉黑 | admin+ |
| POST | `/users/:id/tags` | 添加标签 | agent+ |
| DELETE | `/users/:id/tags/:tag_id` | 移除标签 | agent+ |
| POST | `/users/:id/groups` | 加入分组 | agent+ |
| GET | `/users/:id/photo` | 获取头像 | agent+ |

### GET /users/search

```
Query Params:
  tg_uid: 123456789
  username: john
  tag: VIP
  group_id: 1
```

### GET /users/:id 响应

```json
{
  "id": 1,
  "tg_uid": 123456789,
  "username": "john_doe",
  "first_name": "John",
  "last_name": "Doe",
  "language_code": "en",
  "is_premium": true,
  "dc_id": 5,
  "phone_region": "US",
  "is_blocked": false,
  "tags": [{"id": 1, "name": "VIP", "color": "#EF4444"}],
  "groups": [{"id": 1, "name": "付费用户"}],
  "turnstile_verified": true,
  "turnstile_expires_at": "2026-04-21T00:00:00Z",
  "first_seen_at": "2026-01-15T08:00:00Z",
  "last_active_at": "2026-03-21T10:30:00Z",
  "total_messages": 156,
  "conversations_count": 3
}
```

---

## 6. Bot 池 (Bots)

| Method | Path | 说明 | 权限 |
|--------|------|------|------|
| GET | `/bots` | Bot 列表 | admin+ |
| POST | `/bots` | 添加 Bot | super_admin |
| PATCH | `/bots/:id` | 更新 Bot | super_admin |
| DELETE | `/bots/:id` | 删除 Bot | super_admin |
| GET | `/bots/:id/status` | Bot 实时状态 | admin+ |
| POST | `/bots/:id/restart` | 重启 Bot | admin+ |

---

## 7. FAQ 管理

| Method | Path | 说明 | 权限 |
|--------|------|------|------|
| GET | `/faq/questions` | 问题(关键词)列表 | admin+ |
| POST | `/faq/questions` | 创建问题 | admin+ |
| PATCH | `/faq/questions/:id` | 更新问题 | admin+ |
| DELETE | `/faq/questions/:id` | 删除问题 | admin+ |
| GET | `/faq/answers` | 答案列表 | admin+ |
| POST | `/faq/answers` | 创建答案 | admin+ |
| PATCH | `/faq/answers/:id` | 更新答案 | admin+ |
| DELETE | `/faq/answers/:id` | 删除答案 | admin+ |
| GET | `/faq/rules` | 规则列表 | admin+ |
| POST | `/faq/rules` | 创建规则 (关联问题+答案) | admin+ |
| PATCH | `/faq/rules/:id` | 更新规则 | admin+ |
| DELETE | `/faq/rules/:id` | 删除规则 | admin+ |

### POST /faq/rules

```json
{
  "name": "价格相关",
  "question_ids": [1, 3, 5],
  "answer_ids": [2, 7],
  "response_mode": "random",
  "reply_mode": "ai_polish",
  "ai_config": {
    "max_tokens": 200,
    "temperature": 0.7,
    "style": "professional"
  },
  "priority": 10,
  "daily_ai_limit": 5
}
```

---

## 8. FAQ 排行榜

| Method | Path | 说明 | 权限 |
|--------|------|------|------|
| GET | `/faq/ranking` | FAQ 命中排行榜 | agent+ |
| GET | `/faq/missed-keywords` | 遗漏知识点排行 | admin+ |
| DELETE | `/faq/missed-keywords/:id` | 删除遗漏关键词 | admin+ |

---

## 9. AI 配置

| Method | Path | 说明 | 权限 |
|--------|------|------|------|
| GET | `/ai/configs` | AI 配置列表 | super_admin |
| POST | `/ai/configs` | 创建 AI 配置 | super_admin |
| PATCH | `/ai/configs/:id` | 更新配置 | super_admin |
| DELETE | `/ai/configs/:id` | 删除配置 | super_admin |
| POST | `/ai/configs/:id/test` | 测试 AI 连接 | super_admin |
| GET | `/ai/usage` | AI 用量统计 | admin+ |

---

## 10. 管理员管理

| Method | Path | 说明 | 权限 |
|--------|------|------|------|
| GET | `/admins` | 管理员列表 | admin+ |
| POST | `/admins` | 创建管理员 | super_admin |
| PATCH | `/admins/:id` | 更新管理员 | super_admin |
| DELETE | `/admins/:id` | 删除管理员 | super_admin |
| PATCH | `/admins/:id/permissions` | 更新权限 | super_admin |

---

## 11. 系统设置

| Method | Path | 说明 | 权限 |
|--------|------|------|------|
| GET | `/settings` | 获取所有设置 | admin+ |
| PATCH | `/settings` | 批量更新设置 | super_admin |

---

## 12. 标签和分组

| Method | Path | 说明 | 权限 |
|--------|------|------|------|
| GET | `/tags` | 标签列表 | agent+ |
| POST | `/tags` | 创建标签 | admin+ |
| DELETE | `/tags/:id` | 删除标签 | admin+ |
| GET | `/user-groups` | 分组列表 | agent+ |
| POST | `/user-groups` | 创建分组 | admin+ |
| DELETE | `/user-groups/:id` | 删除分组 | admin+ |

---

## 13. 黑名单

| Method | Path | 说明 | 权限 |
|--------|------|------|------|
| GET | `/blacklist` | 黑名单列表 | agent+ |

---

## WebSocket 接口

### WS /ws/chat

连接: `ws://host/ws/chat?token=<jwt_token>`

#### 服务端推送事件

```json
// 新消息
{
  "event": "new_message",
  "data": {
    "conversation_id": 1,
    "message": { ... }
  }
}

// 会话状态更新
{
  "event": "conversation_updated",
  "data": {
    "conversation_id": 1,
    "status": "open",
    "unread_count": 5
  }
}

// Bot 状态变化
{
  "event": "bot_status",
  "data": {
    "bot_id": 1,
    "is_rate_limited": true,
    "rate_limit_until": "2026-03-21T10:35:00Z"
  }
}

// 在线客服状态
{
  "event": "agent_status",
  "data": {
    "admin_id": 2,
    "is_online": true
  }
}
```

#### 客户端发送

```json
// 标记已读
{
  "action": "mark_read",
  "conversation_id": 1
}

// 正在输入
{
  "action": "typing",
  "conversation_id": 1
}
```

---

## Turnstile 验证流程

```
1. 用户私聊 Bot → Bot 检查 turnstile_verified
2. 未验证 → Bot 返回验证链接: https://domain/verify?uid=<tg_uid>&bot=<bot_id>
3. 用户打开链接 → 前端加载 CF Turnstile Widget
4. 用户完成验证 → 前端提交 token 到后端
5. 后端调用 CF API 验证 → 成功 → 更新 tg_users.turnstile_verified_at
6. 用户再次私聊 → 检查通过 → 正常处理消息
```

| Method | Path | 说明 | 权限 |
|--------|------|------|------|
| POST | `/turnstile/verify` | 验证 Turnstile Token | 公开 |
| GET | `/turnstile/status/:tg_uid` | 检查验证状态 | Bot内部 |
