"""
Dify RAG Provider - calls Dify Knowledge API to retrieve documents.

Requires:
  DIFY_BASE_URL  - e.g. http://docker-api-1:5001/v1
  DIFY_API_KEY   - dataset API key (dataset-xxx)
  DIFY_DATASET_ID - UUID of the dataset
"""
from __future__ import annotations

import logging
from typing import List

import httpx

from .base import RAGProvider, RAGResult

logger = logging.getLogger(__name__)

# Bounds for top_k parameter
_MIN_TOP_K = 1
_MAX_TOP_K = 20


class DifyRAGProvider(RAGProvider):
    """RAG provider backed by Dify Knowledge API."""

    def __init__(
        self,
        base_url: str,
        api_key: str,
        dataset_id: str,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key
        self._dataset_id = dataset_id
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=30.0)
        return self._client

    async def search(self, query: str, top_k: int = 3) -> List[RAGResult]:
        """
        Call Dify dataset retrieve API.

        POST {base_url}/datasets/{dataset_id}/retrieve
        Header: Authorization: Bearer {api_key}
        Body: {"query": "...", "retrieval_model": {"top_k": N, "search_method": "hybrid_search"}}
        """
        # Input validation
        if not query or not query.strip():
            return []
        top_k = max(_MIN_TOP_K, min(top_k, _MAX_TOP_K))

        client = await self._get_client()
        url = f"{self._base_url}/datasets/{self._dataset_id}/retrieve"
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "query": query,
            "retrieval_model": {
                "search_method": "hybrid_search",
                "reranking_enable": True,
                "reranking_mode": "reranking_model",
                "top_k": top_k,
                "score_threshold_enabled": False,
                "score_threshold": 0.0,
            },
        }

        try:
            resp = await client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
        except httpx.HTTPStatusError as exc:
            logger.error(
                "Dify API error %s: %s",
                exc.response.status_code,
                exc.response.text[:200],
            )
            return []
        except Exception:
            logger.exception("Dify API call failed")
            return []

        results: List[RAGResult] = []
        for record in data.get("records", []):
            segment = record.get("segment", {})
            content = segment.get("content", "")
            score = record.get("score", 0.0)
            source = record.get("document", {}).get("name", "")
            if content:
                results.append(RAGResult(
                    content=content,
                    score=score,
                    source=source,
                    metadata={
                        "segment_id": segment.get("id"),
                        "document_id": record.get("document", {}).get("id"),
                    },
                ))

        logger.debug("Dify search returned %d results", len(results))
        return results

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()
