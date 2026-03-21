"""
RAG Handler - Abstract interface for future RAG (Retrieval-Augmented Generation) implementation.

This is a stub/interface that will be implemented when a vector database
(pgvector, Milvus, Pinecone, etc.) is integrated.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List


@dataclass
class Document:
    """A document chunk retrieved from the vector store."""

    content: str
    metadata: dict = field(default_factory=dict)
    score: float = 0.0
    source: str = ""


class RAGHandler:
    """
    Abstract interface for RAG (Retrieval-Augmented Generation).

    Future implementations should subclass this and implement
    the search() and generate() methods for their chosen vector DB.

    Supported backends (planned):
    - PostgreSQL pgvector
    - Milvus
    - Pinecone
    - Qdrant
    """

    async def search(self, query: str, top_k: int = 5) -> List[Document]:
        """
        Search the vector database for relevant document chunks.

        Args:
            query: The user's question to search for.
            top_k: Number of top results to return.

        Returns:
            List of Document objects with content and relevance scores.

        Raises:
            NotImplementedError: RAG is not yet implemented.
        """
        raise NotImplementedError("RAG search is not yet implemented. Future integration required.")

    async def generate(self, query: str, context: List[Document]) -> str:
        """
        Generate an answer using the retrieved context documents.

        Args:
            query: The user's original question.
            context: List of relevant Document objects from search().

        Returns:
            AI-generated answer string.

        Raises:
            NotImplementedError: RAG is not yet implemented.
        """
        raise NotImplementedError("RAG generation is not yet implemented. Future integration required.")

    async def index_document(self, content: str, metadata: dict | None = None) -> str:
        """
        Index a new document into the vector store.

        Args:
            content: The text content to index.
            metadata: Optional metadata dict.

        Returns:
            Document ID string.

        Raises:
            NotImplementedError: RAG is not yet implemented.
        """
        raise NotImplementedError("RAG indexing is not yet implemented.")

    async def delete_document(self, document_id: str) -> bool:
        """
        Delete a document from the vector store.

        Raises:
            NotImplementedError: RAG is not yet implemented.
        """
        raise NotImplementedError("RAG deletion is not yet implemented.")


# Module-level singleton
rag_handler = RAGHandler()
