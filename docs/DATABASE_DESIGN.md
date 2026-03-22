# ADMINCHAT Panel - 数据库设计文档

## 数据库: PostgreSQL 16

## ER 关系概览

```
admins ──┬── conversations (assigned_to)
         │
tg_users ┤── messages
         │── user_tags
         │── conversations
         │── user_groups (多对多)
         │
bots ────┤── messages (via_bot_id)
         │── bot_group_members ── bot_groups
         │
groups ──┤── messages
         │── group_bots (多对多, 群内活跃bot)
         │
faq_groups ── faq_categories ── faq_rules ── faq_answers (多对多)
         │                          │── faq_questions (多对多)
         │
bot_groups ── bot_group_members (多对多)
         │── faq_groups.bot_group_id (路由)
         │── faq_categories.bot_group_id (路由)
         │
missed_keywords ── (独立统计表)
```

## 表结构设计

### 1. admins - 面板管理员/客服

```sql
CREATE TABLE admins (
    id              SERIAL PRIMARY KEY,
    username        VARCHAR(50) UNIQUE NOT NULL,
    email           VARCHAR(255) UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    display_name    VARCHAR(100),
    role            VARCHAR(20) NOT NULL DEFAULT 'agent',
                    -- 'super_admin', 'admin', 'agent'
    is_active       BOOLEAN DEFAULT TRUE,
    tg_user_id      BIGINT,              -- 可选: 关联TG账号用于群内指令验证
    permissions     JSONB DEFAULT '{}',   -- 细粒度权限覆盖
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

**权限字段 `permissions` JSONB 示例:**

```json
{
  "can_manage_faq": true,
  "can_manage_bots": false,
  "can_view_all_conversations": true,
  "can_block_users": true,
  "can_manage_admins": false,
  "can_access_ai_settings": false,
  "can_export_data": false
}
```

### 2. tg_users - Telegram 用户

```sql
CREATE TABLE tg_users (
    id              SERIAL PRIMARY KEY,
    tg_uid          BIGINT UNIQUE NOT NULL,       -- Telegram User ID
    username        VARCHAR(255),                  -- @username
    first_name      VARCHAR(255),
    last_name       VARCHAR(255),
    language_code   VARCHAR(10),
    is_premium      BOOLEAN DEFAULT FALSE,
    is_bot          BOOLEAN DEFAULT FALSE,
    dc_id           INTEGER,                       -- Datacenter ID
    phone_region    VARCHAR(50),                   -- IP/手机地区 (如可获取)
    photo_file_id   VARCHAR(255),                  -- 头像 file_id
    raw_info        JSONB DEFAULT '{}',            -- 其他TG API返回的原始信息
    is_blocked      BOOLEAN DEFAULT FALSE,
    block_reason    VARCHAR(500),
    turnstile_verified_at  TIMESTAMPTZ,            -- CF Turnstile 验证时间
    turnstile_expires_at   TIMESTAMPTZ,            -- 验证过期时间
    first_seen_at   TIMESTAMPTZ DEFAULT NOW(),
    last_active_at  TIMESTAMPTZ DEFAULT NOW(),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tg_users_tg_uid ON tg_users(tg_uid);
CREATE INDEX idx_tg_users_username ON tg_users(username);
CREATE INDEX idx_tg_users_is_blocked ON tg_users(is_blocked);
CREATE INDEX idx_tg_users_last_active ON tg_users(last_active_at);
```

### 3. user_tags - 用户标签

```sql
CREATE TABLE tags (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(50) UNIQUE NOT NULL,
    color           VARCHAR(7) DEFAULT '#3B82F6',  -- 显示颜色
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_tags (
    user_id         INTEGER REFERENCES tg_users(id) ON DELETE CASCADE,
    tag_id          INTEGER REFERENCES tags(id) ON DELETE CASCADE,
    created_by      INTEGER REFERENCES admins(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, tag_id)
);
```

### 4. user_groups - 用户分组

```sql
CREATE TABLE user_groups (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    description     TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_group_members (
    user_id         INTEGER REFERENCES tg_users(id) ON DELETE CASCADE,
    group_id        INTEGER REFERENCES user_groups(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, group_id)
);
```

### 5. bots - Bot 池

```sql
CREATE TABLE bots (
    id              SERIAL PRIMARY KEY,
    token           VARCHAR(255) NOT NULL,          -- Bot Token (加密存储)
    bot_username    VARCHAR(255),                   -- @bot_username
    bot_id          BIGINT UNIQUE,                  -- Bot 的 TG User ID
    display_name    VARCHAR(100),
    is_active       BOOLEAN DEFAULT TRUE,
    is_rate_limited BOOLEAN DEFAULT FALSE,          -- 当前是否被限流
    rate_limit_until TIMESTAMPTZ,                   -- 限流解除时间
    priority        INTEGER DEFAULT 0,              -- 优先级 (越大越优先)
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### 6. tg_groups - Telegram 群组

```sql
CREATE TABLE tg_groups (
    id              SERIAL PRIMARY KEY,
    tg_chat_id      BIGINT UNIQUE NOT NULL,        -- Telegram Chat ID
    title           VARCHAR(255),
    username        VARCHAR(255),                   -- 群组 @username
    group_type      VARCHAR(20),                    -- 'group', 'supergroup', 'channel'
    member_count    INTEGER,
    raw_info        JSONB DEFAULT '{}',
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 群内活跃的 bot 关联
CREATE TABLE group_bots (
    group_id        INTEGER REFERENCES tg_groups(id) ON DELETE CASCADE,
    bot_id          INTEGER REFERENCES bots(id) ON DELETE CASCADE,
    joined_at       TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (group_id, bot_id)
);
```

### 7. conversations - 会话

```sql
CREATE TABLE conversations (
    id              SERIAL PRIMARY KEY,
    tg_user_id      INTEGER REFERENCES tg_users(id) ON DELETE CASCADE,
    source_type     VARCHAR(20) NOT NULL,           -- 'private' | 'group'
    source_group_id INTEGER REFERENCES tg_groups(id),-- 如果来自群组
    status          VARCHAR(20) DEFAULT 'open',     -- 'open', 'resolved', 'blocked'
    assigned_to     INTEGER REFERENCES admins(id),  -- 分配的客服 (可为NULL)
    primary_bot_id  INTEGER REFERENCES bots(id),    -- 接收消息的原始 bot
    last_message_at TIMESTAMPTZ,
    resolved_at     TIMESTAMPTZ,
    resolved_by     INTEGER REFERENCES admins(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conv_status ON conversations(status);
CREATE INDEX idx_conv_user ON conversations(tg_user_id);
CREATE INDEX idx_conv_assigned ON conversations(assigned_to);
CREATE INDEX idx_conv_last_msg ON conversations(last_message_at DESC);
```

### 8. messages - 消息记录

```sql
CREATE TABLE messages (
    id              SERIAL PRIMARY KEY,
    conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
    tg_message_id   BIGINT,                        -- TG 消息 ID
    direction       VARCHAR(10) NOT NULL,           -- 'inbound' | 'outbound'
    sender_type     VARCHAR(10) NOT NULL,           -- 'user' | 'admin' | 'bot' | 'faq'
    sender_admin_id INTEGER REFERENCES admins(id),  -- 如果是管理员发的
    via_bot_id      INTEGER REFERENCES bots(id),    -- 通过哪个 bot 发送/接收
    content_type    VARCHAR(20) NOT NULL,           -- 'text','photo','video','document',
                                                    -- 'sticker','voice','animation','location'
    text_content    TEXT,                           -- 文本内容 (含 Markdown)
    media_file_id   VARCHAR(255),                  -- TG file_id
    media_cached    BOOLEAN DEFAULT FALSE,          -- 是否已本地缓存
    media_cache_path VARCHAR(500),                 -- 本地缓存路径
    media_cache_expires TIMESTAMPTZ,               -- 缓存过期时间
    reply_to_message_id BIGINT,                    -- 回复的消息 ID
    raw_data        JSONB DEFAULT '{}',            -- 原始 TG 消息数据
    faq_matched     BOOLEAN DEFAULT FALSE,         -- 是否被 FAQ 匹配
    faq_rule_id     INTEGER,                       -- 匹配的 FAQ 规则
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_msg_conv ON messages(conversation_id);
CREATE INDEX idx_msg_created ON messages(created_at);
CREATE INDEX idx_msg_direction ON messages(direction);
CREATE INDEX idx_msg_faq ON messages(faq_matched);
```

### 9. FAQ 相关表

```sql
-- FAQ 问题 (关键词)
CREATE TABLE faq_questions (
    id              SERIAL PRIMARY KEY,
    keyword         TEXT NOT NULL,                  -- 关键词/正则
    match_mode      VARCHAR(20) NOT NULL,           -- 'exact','prefix','contains','regex'
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- FAQ 答案
CREATE TABLE faq_answers (
    id              SERIAL PRIMARY KEY,
    content         TEXT NOT NULL,                  -- 答案内容 (支持 Markdown)
    content_type    VARCHAR(20) DEFAULT 'text',     -- 'text','photo','mixed'
    media_file_id   VARCHAR(255),                  -- 如果答案包含媒体
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- FAQ 规则 (问题-答案 多对多 关联)
CREATE TABLE faq_rules (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(200),                  -- 规则名称 (方便管理)
    response_mode   VARCHAR(30) NOT NULL,
                    -- 'single'       : 固定返回1个答案
                    -- 'random'       : 从关联答案中随机
                    -- 'all'          : 依次返回所有答案
    reply_mode      VARCHAR(30) NOT NULL DEFAULT 'direct',
                    -- 'direct'       : 直接返回预设答案
                    -- 'ai_only'      : 纯 AI 回复
                    -- 'ai_polish'    : 匹配答案 + AI 润色
                    -- 'ai_fallback'  : 先 FAQ, 未命中则 AI
                    -- 'ai_intent'    : AI 意图识别 → 路由
                    -- 'ai_template'  : 模板 + AI 填充
                    -- 'rag'          : RAG (预留)
    ai_config       JSONB DEFAULT '{}',            -- AI 相关配置
                    -- {"max_tokens":200,"temperature":0.7,"style":"friendly",...}
    priority        INTEGER DEFAULT 0,              -- 优先级 (多条规则命中时)
    is_active       BOOLEAN DEFAULT TRUE,
    daily_ai_limit  INTEGER,                       -- 每用户每日 AI 回复次数限制
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- FAQ 规则-问题 关联
CREATE TABLE faq_rule_questions (
    rule_id         INTEGER REFERENCES faq_rules(id) ON DELETE CASCADE,
    question_id     INTEGER REFERENCES faq_questions(id) ON DELETE CASCADE,
    PRIMARY KEY (rule_id, question_id)
);

-- FAQ 规则-答案 关联
CREATE TABLE faq_rule_answers (
    rule_id         INTEGER REFERENCES faq_rules(id) ON DELETE CASCADE,
    answer_id       INTEGER REFERENCES faq_answers(id) ON DELETE CASCADE,
    PRIMARY KEY (rule_id, answer_id)
);

CREATE INDEX idx_faq_q_keyword ON faq_questions(keyword);
CREATE INDEX idx_faq_rules_active ON faq_rules(is_active, priority DESC);
```

### 10. FAQ 统计

```sql
-- FAQ 命中统计
CREATE TABLE faq_hit_stats (
    id              SERIAL PRIMARY KEY,
    faq_rule_id     INTEGER REFERENCES faq_rules(id) ON DELETE CASCADE,
    question_id     INTEGER REFERENCES faq_questions(id),
    hit_count       INTEGER DEFAULT 0,
    last_hit_at     TIMESTAMPTZ,
    date            DATE NOT NULL,                 -- 按天统计
    UNIQUE(faq_rule_id, question_id, date)
);

-- 遗漏知识点 (未匹配的用户问题)
CREATE TABLE missed_keywords (
    id              SERIAL PRIMARY KEY,
    keyword         VARCHAR(500) NOT NULL,         -- 提取的关键词
    sample_messages TEXT[],                        -- 示例原始消息 (最多保存5条)
    occurrence_count INTEGER DEFAULT 1,
    is_resolved     BOOLEAN DEFAULT FALSE,         -- 管理员已创建FAQ后标记
    last_seen_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),     -- 由凌晨3点任务更新
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_missed_kw ON missed_keywords(keyword);
CREATE INDEX idx_missed_count ON missed_keywords(occurrence_count DESC);
CREATE INDEX idx_missed_resolved ON missed_keywords(is_resolved);
```

### 11. AI 配置

```sql
CREATE TABLE ai_configs (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,         -- 配置名称
    provider        VARCHAR(50) NOT NULL,          -- 'openai','anthropic','custom'
    base_url        VARCHAR(500) NOT NULL,
    api_key         VARCHAR(500) NOT NULL,         -- 加密存储
    model           VARCHAR(100),
    default_params  JSONB DEFAULT '{}',            -- 默认参数
                    -- {"max_tokens":500,"temperature":0.7}
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- AI 用量统计 (防白嫖)
CREATE TABLE ai_usage_logs (
    id              SERIAL PRIMARY KEY,
    tg_user_id      INTEGER REFERENCES tg_users(id),
    ai_config_id    INTEGER REFERENCES ai_configs(id),
    tokens_used     INTEGER,
    cost_estimate   DECIMAL(10,6),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_usage_user_date ON ai_usage_logs(tg_user_id, created_at);
```

### 12. 系统设置

```sql
CREATE TABLE system_settings (
    key             VARCHAR(100) PRIMARY KEY,
    value           JSONB NOT NULL,
    description     VARCHAR(500),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 预设 key:
-- 'turnstile_secret'        : CF Turnstile 密钥
-- 'turnstile_ttl_days'      : 验证有效天数
-- 'media_cache_ttl_days'    : 媒体缓存天数
-- 'session_assignment_enabled': 是否启用会话分配
-- 'missed_kw_update_hour'   : 遗漏知识点更新时间
```

### 13. 操作日志 (审计)

```sql
CREATE TABLE audit_logs (
    id              SERIAL PRIMARY KEY,
    admin_id        INTEGER REFERENCES admins(id),
    action          VARCHAR(50) NOT NULL,          -- 'block_user','send_message','update_faq',...
    target_type     VARCHAR(50),                   -- 'user','faq','bot','admin'
    target_id       INTEGER,
    details         JSONB DEFAULT '{}',
    ip_address      VARCHAR(45),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_admin ON audit_logs(admin_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_created ON audit_logs(created_at);
```

### 18. bot_groups - Bot 分组

```sql
CREATE TABLE bot_groups (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100) UNIQUE NOT NULL,
    description     TEXT,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### 19. bot_group_members - Bot 分组成员

```sql
CREATE TABLE bot_group_members (
    bot_group_id    INTEGER REFERENCES bot_groups(id) ON DELETE CASCADE,
    bot_id          INTEGER REFERENCES bots(id) ON DELETE CASCADE,
    PRIMARY KEY (bot_group_id, bot_id),
    CONSTRAINT uq_bot_group_members_bot_id UNIQUE (bot_id)
    -- 每个 bot 最多属于 1 个组
);
```

### 20. faq_groups - FAQ 分组 (一级)

```sql
CREATE TABLE faq_groups (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100) UNIQUE NOT NULL,
    description     TEXT,
    bot_group_id    INTEGER REFERENCES bot_groups(id) ON DELETE SET NULL,
                    -- 绑定 Bot 分组，匹配后用该组的 Bot 回复
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### 21. faq_categories - FAQ 分类 (二级)

```sql
CREATE TABLE faq_categories (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    faq_group_id    INTEGER NOT NULL REFERENCES faq_groups(id) ON DELETE CASCADE,
    bot_group_id    INTEGER REFERENCES bot_groups(id) ON DELETE SET NULL,
                    -- 可覆盖 faq_group 的 bot_group_id
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- faq_rules 新增字段:
ALTER TABLE faq_rules ADD COLUMN category_id INTEGER
    REFERENCES faq_categories(id) ON DELETE SET NULL;
```

**FAQ 路由继承逻辑:**
```
Rule 匹配 → category.bot_group_id 有值? → 用该 Bot Group
         → 为空? → category.faq_group.bot_group_id 有值? → 用该 Bot Group
         → 都为空? → 用接收消息的原路 Bot
```

## 媒体缓存策略

- 新消息媒体 → 通过 TG File API 下载到本地 `media/` 目录
- 存储路径: `media/{YYYY-MM}/{file_id_hash}.{ext}`
- `media_cache_expires` = `NOW() + system_settings['media_cache_ttl_days']`
- 定时任务清理过期缓存文件
- 前端请求过期媒体时 → 后端重新从 TG 拉取 → 更新缓存
