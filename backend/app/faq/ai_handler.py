"""
AI Handler - manages all AI reply modes for the FAQ engine.

Supports OpenAI-compatible API format (works with OpenAI, Anthropic proxy, custom endpoints).
"""
from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)


@dataclass
class AIResponse:
    """Wrapper for AI API responses."""

    content: str
    tokens_used: int = 0
    prompt_tokens: int = 0
    completion_tokens: int = 0
    model: str = ""
    latency_ms: float = 0.0


@dataclass
class AIConfig:
    """Runtime AI configuration."""

    base_url: str
    api_key: str
    model: str = "gpt-3.5-turbo"
    max_tokens: int = 500
    temperature: float = 0.7
    system_prompt: str = ""
    timeout: float = 30.0
    api_format: str = "openai_chat"  # 'openai_chat' or 'anthropic_responses'


class AIHandler:
    """
    Handles all AI reply modes for the FAQ engine.

    Each method corresponds to a reply_mode defined in FAQ_ENGINE.md.
    Uses httpx async client to call OpenAI-compatible chat completions API.
    """

    def __init__(self) -> None:
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=60.0)
        return self._client

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    async def _call_ai(
        self,
        messages: List[Dict[str, str]],
        config: AIConfig,
    ) -> AIResponse:
        """
        Call an OpenAI-compatible chat completions endpoint.

        Returns an AIResponse with content and token usage.
        """
        client = await self._get_client()
        logger.info("_call_ai: api_format=%s, base_url=%s, model=%s", config.api_format, config.base_url, config.model)

        base = config.base_url.rstrip("/")

        # Build URL based on api_format
        if config.api_format == "anthropic_responses":
            # Anthropic Responses format (CRS: /openai/v1/responses)
            if "/responses" in base:
                url = base
            else:
                url = base + "/v1/responses"
        else:
            # OpenAI Chat Completions format (default)
            if "/chat/completions" in base or "/completions" in base:
                url = base
            elif base.endswith("/v1") or base.endswith("/v1/chat") or base.endswith("/chat"):
                url = base + "/completions"
            else:
                url = base + "/chat/completions"

        headers = {
            "Authorization": f"Bearer {config.api_key}",
            "x-api-key": config.api_key,
            "Content-Type": "application/json",
        }

        # Build payload based on api_format
        if config.api_format == "anthropic_responses":
            # CRS GPT Responses format: uses "input" + stream=true
            input_items = []
            for msg in messages:
                role = msg.get("role", "user")
                text = msg.get("content", "")
                if role == "system":
                    input_items.append({
                        "role": "developer",
                        "content": [{"type": "input_text", "text": text}],
                    })
                else:
                    input_items.append({
                        "role": role,
                        "content": [{"type": "input_text", "text": text}],
                    })
            payload: Dict[str, Any] = {
                "model": config.model,
                "input": input_items,
                "stream": True,  # CRS requires streaming
            }
            if config.max_tokens:
                payload["max_output_tokens"] = config.max_tokens
        else:
            # Standard OpenAI Chat Completions format
            payload = {
                "model": config.model,
                "messages": messages,
                "max_tokens": config.max_tokens,
                "temperature": config.temperature,
            }

        start = time.monotonic()

        if config.api_format == "anthropic_responses":
            # Handle SSE streaming response from CRS
            try:
                content = ""
                tokens_used = 0
                prompt_tokens = 0
                completion_tokens = 0
                model_name = config.model

                async with client.stream(
                    "POST", url, headers=headers, json=payload, timeout=config.timeout,
                ) as resp:
                    # For streaming, check status before reading body
                    if resp.status_code >= 400:
                        error_body = ""
                        async for chunk in resp.aiter_bytes():
                            error_body += chunk.decode("utf-8", errors="replace")
                            if len(error_body) > 500:
                                break
                        logger.error("AI API streaming error %s: %s", resp.status_code, error_body)
                        raise Exception(f"AI API error {resp.status_code}: {error_body[:200]}")
                    async for line in resp.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        data_str = line[6:]
                        if not data_str.strip():
                            continue
                        try:
                            event_data = json.loads(data_str)
                        except json.JSONDecodeError:
                            continue

                        event_type = event_data.get("type", "")
                        logger.info("SSE event: %s", event_type)

                        # Collect text deltas
                        if event_type == "response.output_text.delta":
                            delta = event_data.get("delta", "")
                            content += delta

                        # Get usage from completed response
                        elif event_type == "response.completed":
                            resp_obj = event_data.get("response", {})
                            usage = resp_obj.get("usage", {})
                            tokens_used = usage.get("total_tokens", 0)
                            prompt_tokens = usage.get("input_tokens", 0)
                            completion_tokens = usage.get("output_tokens", 0)
                            model_name = resp_obj.get("model", config.model)

                content = content.strip()
                logger.info("AI streaming result: content_len=%d, tokens=%d, model=%s", len(content), tokens_used, model_name)

            except httpx.HTTPStatusError as exc:
                logger.error("AI API streaming HTTP error: %s", str(exc))
                raise
            except Exception:
                logger.exception("AI API (CRS streaming) call failed")
                raise
        else:
            # Standard non-streaming request
            try:
                resp = await client.post(
                    url, headers=headers, json=payload, timeout=config.timeout,
                )
                resp.raise_for_status()
                data = resp.json()
            except httpx.HTTPStatusError as exc:
                logger.error("AI API HTTP error %s: %s", exc.response.status_code, exc.response.text)
                raise
            except Exception:
                logger.exception("AI API call failed")
                raise

            choice = data.get("choices", [{}])[0]
            content = choice.get("message", {}).get("content", "").strip()
            usage = data.get("usage", {})
            tokens_used = usage.get("total_tokens", 0)
            prompt_tokens = usage.get("prompt_tokens", 0)
            completion_tokens = usage.get("completion_tokens", 0)
            model_name = data.get("model", config.model)

        latency = (time.monotonic() - start) * 1000

        return AIResponse(
            content=content,
            tokens_used=tokens_used,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            model=model_name,
            latency_ms=latency,
        )

    def _build_messages(
        self,
        system: str,
        user_content: str,
    ) -> List[Dict[str, str]]:
        msgs: List[Dict[str, str]] = []
        if system:
            msgs.append({"role": "system", "content": system})
        msgs.append({"role": "user", "content": user_content})
        return msgs

    # ----------------------------------------------------------------
    # Mode 1: direct - pure passthrough, no AI involved
    # ----------------------------------------------------------------
    async def reply_direct(self, answer: str) -> str:
        """Return the preset answer directly. No AI call."""
        return answer

    # ----------------------------------------------------------------
    # Mode 2: ai_only - pure AI reply
    # ----------------------------------------------------------------
    async def reply_ai_only(
        self,
        question: str,
        config: AIConfig,
    ) -> AIResponse:
        """Send the user question directly to AI and return the response."""
        system = config.system_prompt or "You are a helpful customer service assistant. Answer concisely and professionally."
        messages = self._build_messages(system, question)
        return await self._call_ai(messages, config)

    # ----------------------------------------------------------------
    # Mode 3: ai_polish - FAQ answer + AI rewrite
    # ----------------------------------------------------------------
    async def reply_ai_polish(
        self,
        question: str,
        answer: str,
        config: AIConfig,
    ) -> AIResponse:
        """Match a FAQ answer then have AI polish/rewrite it naturally."""
        system = config.system_prompt or (
            "You are a professional copywriter for customer service. "
            "Rewrite the given answer to be more natural and friendly, "
            "but do NOT change the core information."
        )
        user_content = (
            f"User question: {question}\n\n"
            f"Original answer: {answer}\n\n"
            "Please rewrite this answer to sound more natural and engaging, "
            "while keeping all factual information intact."
        )
        messages = self._build_messages(system, user_content)
        return await self._call_ai(messages, config)

    # ----------------------------------------------------------------
    # Mode 4: ai_fallback - FAQ first, AI if no match
    # ----------------------------------------------------------------
    async def reply_ai_fallback(
        self,
        question: str,
        faq_answer: Optional[str],
        config: AIConfig,
    ) -> AIResponse | str:
        """
        If faq_answer is available, return it directly.
        Otherwise, fall back to AI for an answer.
        """
        if faq_answer:
            return faq_answer
        return await self.reply_ai_only(question, config)

    # ----------------------------------------------------------------
    # Mode 5: ai_intent - AI classifies intent then route to FAQ category
    # ----------------------------------------------------------------
    async def reply_ai_intent(
        self,
        question: str,
        categories: List[str],
        config: AIConfig,
    ) -> AIResponse:
        """
        AI analyzes user intent and classifies it into one of the given categories.
        Returns a JSON-parseable response with category and confidence.
        """
        categories_str = ", ".join(categories)
        system = (
            "You are an intent classification system. "
            "Analyze the user's question and return the most matching category. "
            "Respond ONLY with valid JSON in this format: "
            '{"category": "xxx", "confidence": 0.95}'
        )
        user_content = (
            f"Available categories: [{categories_str}]\n"
            f"User question: {question}\n"
            "Return the classification result as JSON."
        )
        messages = self._build_messages(system, user_content)
        return await self._call_ai(messages, config)

    # ----------------------------------------------------------------
    # Mode 6: ai_template - template + AI fills variables
    # ----------------------------------------------------------------
    async def reply_ai_template(
        self,
        question: str,
        template: str,
        config: AIConfig,
    ) -> AIResponse:
        """
        Given a template with {variable} placeholders,
        AI fills in the variables based on user question context.
        """
        system = config.system_prompt or (
            "You are a template-filling assistant. "
            "Fill in the template variables based on context. "
            "Return ONLY the completed template text, nothing else."
        )
        user_content = (
            f"Template: {template}\n\n"
            f"User question: {question}\n\n"
            "Fill in all the {{variable}} placeholders in the template "
            "with appropriate values based on the user's question. "
            "Return only the completed text."
        )
        messages = self._build_messages(system, user_content)
        return await self._call_ai(messages, config)

    # ----------------------------------------------------------------
    # Mode 8: ai_classify_and_answer - AI answers with FAQ context
    # ----------------------------------------------------------------
    async def reply_ai_classify_and_answer(
        self,
        question: str,
        faq_context: str,
        config: AIConfig,
    ) -> AIResponse:
        """
        AI comprehensively understands the question and answers
        using FAQ knowledge base as reference context.
        """
        system = config.system_prompt or (
            "You are a knowledgeable customer service assistant. "
            "Use the provided FAQ knowledge base as reference to answer the user's question. "
            "If the answer is in the knowledge base, use that information. "
            "If not, provide a helpful response based on your understanding."
        )
        user_content = (
            f"FAQ Knowledge Base:\n{faq_context}\n\n"
            f"User Question: {question}\n\n"
            "Please answer the user's question based on the knowledge base above."
        )
        messages = self._build_messages(system, user_content)
        return await self._call_ai(messages, config)

    # ----------------------------------------------------------------
    # Test connection
    # ----------------------------------------------------------------
    async def test_connection(self, config: AIConfig) -> AIResponse:
        """Test the AI API connection with a simple prompt."""
        messages = [
            {"role": "user", "content": "Hello, please respond with 'OK' to confirm the connection works."}
        ]
        return await self._call_ai(messages, config)


# Module-level singleton
ai_handler = AIHandler()


async def log_ai_usage(
    session,
    ai_config_id: int | None,
    tg_user_id: int | None,
    ai_resp: AIResponse,
    reply_mode: str | None = None,
) -> None:
    """Persist an AI usage log row with token breakdown and cost estimate."""
    from app.models.ai_config import AiUsageLog
    from app.utils.model_pricing import estimate_cost

    cost = estimate_cost(ai_resp.model, ai_resp.prompt_tokens, ai_resp.completion_tokens)
    session.add(AiUsageLog(
        ai_config_id=ai_config_id,
        tg_user_id=tg_user_id,
        tokens_used=ai_resp.tokens_used,
        prompt_tokens=ai_resp.prompt_tokens,
        completion_tokens=ai_resp.completion_tokens,
        model=ai_resp.model or None,
        reply_mode=reply_mode,
        cost_estimate=cost,
    ))
