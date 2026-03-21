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

### 匹配模式 (match_mode)

| 模式 | 说明 | 示例 keyword | 匹配 "你好，请问价格多少？" |
|------|------|-------------|------------------------|
| `exact` | 完全匹配 | "请问价格多少" | 否 |
| `prefix` | 从头匹配 | "你好" | 是 |
| `contains` | 包含匹配 | "价格" | 是 |
| `regex` | 正则表达式 | `价格\|多少钱\|费用` | 是 |

### 匹配优先级

1. `priority` 字段越大越优先
2. 同 priority 下，`exact` > `prefix` > `contains` > `regex`
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

### 模式 7: `rag` — RAG 知识库检索 (预留)

```
用户消息 → 向量化 → 知识库检索 Top-K 相关片段 → 组合 Prompt → AI 回答
```

**预留接口设计:**

```python
class RAGHandler:
    async def search(self, query: str, top_k: int = 5) -> list[Document]:
        """从向量数据库检索相关文档"""
        raise NotImplementedError("RAG 功能尚未实现")

    async def generate(self, query: str, context: list[Document]) -> str:
        """基于检索结果生成回答"""
        raise NotImplementedError("RAG 功能尚未实现")
```

未来接入时只需实现这个接口，可对接:
- PostgreSQL pgvector
- Milvus
- Pinecone
- 或其他向量数据库

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
