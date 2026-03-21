# ADMINCHAT Panel - Bot 管理与消息路由设计

## 多 Bot 架构

### Bot Manager (生命周期管理)

```
BotManager
├── 启动时从 DB 加载所有 is_active=true 的 bot
├── 为每个 bot 创建独立的 aiogram.Bot + Dispatcher 实例
├── 共享同一个 webhook server 或各自 polling
├── 动态增删 bot (管理员从 Web 操作 → 通知 BotManager 热加载)
└── 健康检查: 定期 getMe() 确认 bot 在线
```

### 启动方式选择

| 方式 | 优点 | 缺点 | 推荐场景 |
|------|------|------|----------|
| Webhook | 省资源，生产推荐 | 需要 HTTPS + 公网域名 | 生产部署 |
| Long Polling | 简单，无需公网 | 每个 bot 一个连接 | 开发/测试 |

**推荐**: 生产用 Webhook，开发用 Polling，通过环境变量切换。

### Webhook 路由

```
POST /webhook/bot/<bot_token_hash>
→ 根据 URL 路由到对应 bot 的 Dispatcher
```

## 消息处理流程

### 私聊消息 (Private)

```
用户私聊 Bot_A
    │
    ▼
[Turnstile 检查] ──未验证──→ 发送验证链接 → END
    │ 已验证
    ▼
[黑名单检查] ──已拉黑──→ 忽略 → END
    │ 正常
    ▼
[FAQ Engine 匹配]
    │
    ├── 命中 → 自动回复 (通过 Bot_A) → 记录消息 → 通知Web
    │
    └── 未命中 → 记录消息 → 创建/更新 Conversation
                  → Redis PUBLISH → WebSocket 推送到 Web 面板
                  → 记录未匹配问题 (用于遗漏知识点统计)
```

### 群组 @Bot 消息 (Group)

```
用户在群内 @Bot_A
    │
    ▼
[检查是否 @了 本池内的 bot] ──否──→ 忽略
    │ 是
    ▼
[提取 @ 后的文本内容]
    │
    ▼
[黑名单检查]
    │
    ▼
[FAQ Engine 匹配]
    │
    ├── 命中 → 通过 Bot_A reply 用户消息 → 记录
    │
    └── 未命中 → 记录消息 → Conversation (source=group)
                  → WebSocket 推送 Web (显示 "群HALO - 用户xxx")
```

### Web 管理员回复 → TG

```
管理员在 Web 输入回复内容
    │
    ▼
[REST API: POST /conversations/:id/messages]
    │
    ▼
[Bot Dispatcher 选择发送 bot]
    │
    ▼
[判断 source_type]
    │
    ├── private → 通过 conversation.primary_bot_id 发送
    │               如限流 → 该私聊只能等待 (私聊必须原路 bot)
    │
    └── group → 优先 primary_bot_id
                  │
                  ├── 发送成功 → 记录 → 完成
                  │
                  └── 429 限流 → [Bot Dispatcher 轮转]
                                    │
                                    ▼
                              [Redis 分布式锁: msg_{conv_id}_{msg_uuid}]
                                    │
                                    ▼
                              [从 bot 池选择未限流的 bot]
                                    │
                                    ├── 找到 → 发送 (reply 原消息) → 记录
                                    │
                                    └── 全部限流 → 加入 Redis 延迟队列
                                                    → 等待限流解除后重试
```

## Bot 限流管理

### Redis 数据结构

```
# 每个 bot 的令牌桶
bot:rate:{bot_id}:tokens    → INT (剩余令牌数)
bot:rate:{bot_id}:last      → TIMESTAMP (上次补充时间)

# 群组限流状态
bot:limited:{bot_id}        → TIMESTAMPTZ (限流解除时间, TTL 自动过期)

# 消息发送锁 (防重复)
msg:lock:{conversation_id}:{msg_uuid}  → bot_id (TTL: 60s)

# 延迟重试队列
bot:retry:queue             → Sorted Set (score=重试时间)
```

### 限流检测逻辑

```python
async def send_with_failover(conversation, content, reply_to):
    """
    发送消息，带 bot 故障转移
    """
    # 1. 优先原路 bot
    primary_bot = get_bot(conversation.primary_bot_id)

    # 2. 获取分布式锁 (防止重复发送)
    msg_uuid = uuid4()
    lock_key = f"msg:lock:{conversation.id}:{msg_uuid}"

    if not await redis.set(lock_key, primary_bot.id, nx=True, ex=60):
        return  # 已有其他进程在发送

    # 3. 尝试发送
    try:
        if not await is_rate_limited(primary_bot.id):
            await primary_bot.send_message(...)
            return
    except TelegramRetryAfter as e:
        await mark_rate_limited(primary_bot.id, e.retry_after)

    # 4. 群组消息才做 failover (私聊必须原路)
    if conversation.source_type != 'group':
        await enqueue_retry(conversation, content, reply_to)
        return

    # 5. 从 bot 池选替代 bot
    available_bots = await get_available_bots(exclude=primary_bot.id)
    for bot in available_bots:
        try:
            await bot.send_message(
                chat_id=conversation.source_group.tg_chat_id,
                reply_to_message_id=reply_to,
                ...
            )
            return
        except TelegramRetryAfter as e:
            await mark_rate_limited(bot.id, e.retry_after)

    # 6. 全部限流 → 延迟队列
    await enqueue_retry(conversation, content, reply_to)
```

### Telegram 限流参数参考

| 场景 | 限制 |
|------|------|
| 私聊 | 约 30 msg/s (全局) |
| 同一群组 | 约 20 msg/min |
| 同一群组 (同一 bot) | 更严格，约 1 msg/s |

## Bot 指令处理

### 普通用户指令

无。Bot 只响应私聊消息和群内 @。

### 管理员群内指令

```
/FAQRanking
→ 检查发送者 tg_user_id 是否在 admins 表且 tg_user_id 匹配
→ 是管理员 → 查询 faq_hit_stats → 返回 Top 10 关键词
→ 非管理员 → 忽略
```

输出格式:

```
📊 FAQ 问题排行榜 (Top 10)

1. 价格相关 — 523 次
2. 如何注册 — 412 次
3. 退款政策 — 389 次
...
```

## Bot 状态监控

通过 WebSocket 实时推送到 Web 面板:

- Bot 在线/离线状态
- 当前是否被限流 + 剩余冷却时间
- 今日发送消息数
- 最近一次发送时间
