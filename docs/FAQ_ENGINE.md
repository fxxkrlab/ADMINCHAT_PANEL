# ADMINCHAT Panel - FAQ 引擎与 AI 集成设计

## FAQ 匹配引擎

### 匹配流程

```
用户消息进入
    │
    ▼
[加载所有 is_active=true 的 faq_rules, 按 priority DESC 排序]
    │
    ▼
[遍历每条规则关联的 questions]
    │
    ▼
[对每个 question 按 match_mode 匹配]
    │
    ├── 命中 → 根据 reply_mode 处理
    │          → 记录 faq_hit_stats
    │          → 返回答案
    │
    └── 全部未命中
         → 记录到 unmatched_messages (用于遗漏知识点分析)
         → 如有 reply_mode='ai_fallback' 的兜底规则 → 走 AI
         → 否则 → 转人工 (推送到 Web 面板)
```

### 匹配模式 (match_mode) - 共 5 种

| 模式 | 说明 | 示例 keyword | 匹配 "你好，请问价格多少？" |
|------|------|-------------|------------------------|
| `exact` | 完全匹配 | "请问价格多少" | 否 |
| `prefix` | 从头匹配 | "你好" | 是 |
| `contains` | 包含匹配 | "价格" | 是 |
| `regex` | 正则表达式 | `价格\|多少钱\|费用` | 是 |
| `catch_all` | 兜底匹配 (匹配所有消息) | `*` (自动填充) | 是 |

#### catch_all 模式说明

`catch_all` 是一种特殊的兜底匹配模式，无论用户输入什么内容都会命中。适用于需要对所有未被更高优先级规则匹配的消息做统一处理的场景（如 AI 兜底回复）。

- 关键词自动填充为 `*`（前端自动处理）
- 匹配函数 `match_catch_all()` 在 `matcher.py` 中实现，始终返回 `True`
- 应设置较低的 priority，确保其他精确规则优先匹配
- 通常与 `reply_mode=ai_fallback` 或 `reply_mode=ai_only` 配合使用

### 匹配优先级

1. `priority` 字段越大越优先
2. 同 priority 下，`exact` > `prefix` > `contains` > `regex` > `catch_all`
3. 命中第一条即停止 (不做多规则叠加)

### 响应模式 (response_mode)

| 模式 | 说明 |
|------|------|
| `single` | 规则关联的多个答案中取第一个 |
| `random` | 规则关联的多个答案中随机取一个 |
| `all` | 依次发送所有关联答案 (多条消息) |

## AI 回复模式 (reply_mode) - 共 8 种

### 模式 1: `direct` — 纯正则匹配

```
用户消息 → 匹配关键词 → 返回预设答案
```

不涉及 AI，最快速。

### 模式 2: `ai_only` — 纯 AI 回复

```
用户消息 → 直接发给 AI → 返回 AI 生成的回答
```

**限制措施 (防白嫖):**

- `daily_ai_limit`: 每用户每日 AI 回复次数上限
- `max_tokens`: 控制回答长度
- `cooldown_seconds`: 两次 AI 请求最小间隔
- 可按用户 tag 差异化配置 (如 VIP 用户额度更高)

**AI 配置参数:**

```json
{
  "max_tokens": 200,
  "temperature": 0.7,
  "style": "professional",
  "system_prompt": "你是XXX的客服助手，请简洁专业地回答...",
  "forbidden_topics": ["政治", "色情"],
  "language": "zh-CN"
}
```

### 模式 3: `ai_polish` — 正则匹配 + AI 润色

```
用户消息 → 匹配关键词 → 获取预设答案 → AI 润色改写 → 返回
```

AI Prompt 模板:

```
请将以下客服回答改写得更自然、更有亲和力，但不要改变核心信息:

原始回答: {faq_answer}
用户问题: {user_question}

要求: {style_requirements}
```

### 模式 4: `ai_fallback` — FAQ 优先，未命中则 AI 兜底

```
用户消息 → 匹配关键词
    ├── 命中 → 返回预设答案
    └── 未命中 → 发给 AI → 返回 AI 回答
```

最实用的模式，建议作为默认推荐。

### 模式 5: `ai_intent` — AI 意图识别 → 路由到 FAQ 分类

```
用户消息 → AI 分析意图/分类 → 在对应分类的 FAQ 中匹配 → 返回答案
```

AI Prompt 模板:

```
分析用户问题的意图，返回最匹配的分类:
可用分类: [价格, 注册, 退款, 使用方法, 其他]
用户问题: {user_question}
返回格式: {"category": "xxx", "confidence": 0.95}
```

适用于用户表述方式多变但问题本质固定的场景。

### 模式 6: `ai_template` — 模板 + AI 动态填充

```
预设答案模板: "您好 {user_name}，您查询的 {product} 价格是 {price}，
              目前{promotion_status}，有效期至 {date}。"

用户消息 → 匹配关键词 → 获取模板 → AI 根据上下文填充变量 → 返回
```

适用于答案结构固定但细节动态的场景。

### 模式 7: `rag` — RAG 知识库检索

```
用户消息 → RAG Provider 检索 Top-K 相关片段 → 拼接 context → AI 综合回答
```

**模块化架构:**

```python
# backend/app/faq/rag/
RAGProvider (抽象基类)
  ├── DifyRAGProvider      ← 当前实现 (Dify Knowledge API)
  ├── 未来: PgvectorRAGProvider
  └── 未来: CustomRAGProvider
```

**当前实现 (Dify):**
- 调用 Dify Knowledge API: `POST /datasets/{dataset_id}/retrieve`
- 支持 hybrid_search (向量 + 关键词混合检索)
- 嵌入模型: GTE-multilingual-base
- 向量存储: pgvector (通过 Dify 管理)

**配置 (环境变量):**

```bash
RAG_PROVIDER=dify
DIFY_BASE_URL=http://your-dify-api:5001/v1
DIFY_API_KEY=dataset-xxx
DIFY_DATASET_ID=uuid-of-dataset
RAG_TOP_K=3
```

**扩展新 Provider:**
继承 `RAGProvider` 基类，实现 `search()` 方法，在 `get_rag_provider()` 工厂函数中注册即可。

### 模式 8: `ai_classify_and_answer` — AI 综合理解后回答

```
用户消息 → AI 综合理解问题 + 参考 FAQ 知识库 → 生成回答
```

区别于 `ai_only`: 这个模式会把 FAQ 知识库作为 context 注入 prompt，让 AI 基于已有知识回答，而非完全自由发挥。

## 遗漏知识点分析

### 数据收集

每条未被 FAQ 命中的用户消息 → 存入 `unmatched_messages` 临时表:

```sql
CREATE TABLE unmatched_messages (
    id              SERIAL PRIMARY KEY,
    tg_user_id      INTEGER,
    text_content    TEXT NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### 凌晨 3 点定时任务

```python
async def analyze_missed_knowledge():
    """
    1. 从 unmatched_messages 取最近24h的消息
    2. 提取高频关键词 (jieba/TF-IDF)
    3. 合并到 missed_keywords 表
       - 已存在的 → occurrence_count += N
       - 新的 → INSERT
    4. 清理超过30天的 unmatched_messages
    """
```

关键词提取方案:
- 中文: jieba 分词 + TF-IDF
- 英文: NLTK / spaCy
- 也可以用 AI 做聚类摘要 (高级方案，后期可选)

### 管理员操作流

```
查看遗漏知识点排行 → 选择某个关键词
→ 跳转到 FAQ 编辑器 → 创建新的 FAQ 规则
→ 保存后 → 标记该 missed_keyword 为 is_resolved=true
```

### Missed Keyword Filters (遗漏关键词过滤器)

在凌晨3点定时分析任务中，系统会根据管理员配置的过滤规则自动排除无意义的关键词（如语气词、问候语等），减少人工审核成本。

**过滤器数据模型 (`missed_keyword_filters` 表):**

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | SERIAL PK | 主键 |
| `pattern` | VARCHAR(500) | 过滤模式 (关键词/正则) |
| `match_mode` | VARCHAR(20) | 匹配方式: `exact` / `contains` / `regex` |
| `description` | TEXT | 过滤规则描述 (可选) |
| `is_active` | BOOLEAN | 是否启用 |
| `created_at` | TIMESTAMPTZ | 创建时间 |
| `updated_at` | TIMESTAMPTZ | 更新时间 |

**过滤逻辑:**

```python
def keyword_matches_filter(keyword: str, filters: list[MissedKeywordFilter]) -> bool:
    """检查关键词是否匹配任一过滤规则，匹配则跳过不记录"""
    for f in filters:
        if f.match_mode == "exact" and keyword == f.pattern:
            return True
        elif f.match_mode == "contains" and f.pattern in keyword:
            return True
        elif f.match_mode == "regex" and re.search(f.pattern, keyword):
            return True
    return False
```

**Scheduler 集成:**

定时任务在提取关键词后，会加载所有 `is_active=True` 的过滤规则，对提取结果做过滤，被命中的关键词不会写入 `missed_keywords` 表。

**前端交互:**

MissedKnowledge 页面顶部提供可折叠的过滤器管理面板，支持:
- 查看所有过滤规则
- 新增过滤规则 (pattern + match_mode + description)
- 删除过滤规则

**API 端点:**

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/v1/faq/missed-keyword-filters` | 列表所有过滤规则 |
| POST | `/api/v1/faq/missed-keyword-filters` | 创建过滤规则 |
| DELETE | `/api/v1/faq/missed-keyword-filters/{id}` | 删除过滤规则 |

## FAQ 编辑器 UI 设计 (左右分屏)

```
┌─────────────────────────────────────────────────┐
│ FAQ 规则编辑器                        [保存] [取消] │
├─────────────────────┬───────────────────────────┤
│                     │                           │
│  📋 问题/关键词 (蓝)  │  📋 答案 (绿)              │
│                     │                           │
│  ☑ "价格"           │  ☑ "我们的价格是..."       │
│  ☑ "多少钱"         │  ☐ "详情请访问官网..."     │
│  ☑ "费用"           │  ☑ "目前有优惠活动..."     │
│  ☐ "怎么收费"       │  ☐ "请联系销售..."         │
│                     │                           │
│  [+ 新增问题]        │  [+ 新增答案]              │
│                     │                           │
├─────────────────────┴───────────────────────────┤
│ 规则设置                                         │
│ ┌─────────────┐ ┌──────────────┐ ┌───────────┐  │
│ │匹配模式: contains▼│ │响应模式: random▼│ │回复模式: ai_polish▼│ │
│ └─────────────┘ └──────────────┘ └───────────┘  │
│ 优先级: [10]  每日AI限额: [5次/用户]              │
└─────────────────────────────────────────────────┘
```
