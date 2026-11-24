from __future__ import annotations
import os
import sys
import types
import logging

# Ensure OPENAI_API_KEY is available so openai/langchain_openai client initialization succeeds
os.environ.setdefault("OPENAI_API_KEY", "ollama")

# Neutralize nest_asyncio in Python 3.14 to prevent loop task corruption with anyio/Starlette TestClient
try:
    import nest_asyncio
    nest_asyncio.apply = lambda *args, **kwargs: None
except ImportError:
    pass

# Compatibility shim for langchain_community 0.4.x where chat_models.vertexai was moved
try:
    import langchain_community.chat_models.vertexai  # type: ignore
except ImportError:
    try:
        from langchain_google_vertexai import ChatVertexAI  # type: ignore
    except Exception:
        ChatVertexAI = None
    shim = types.ModuleType("langchain_community.chat_models.vertexai")
    shim.ChatVertexAI = ChatVertexAI
    sys.modules["langchain_community.chat_models.vertexai"] = shim

# Import official RAGAS components
from ragas.llms import BaseRagasLLM, llm_factory
from ragas.run_config import RunConfig
from ragas.dataset_schema import SingleTurnSample
from ragas.metrics import (
    LLMContextPrecisionWithReference,
    NonLLMContextPrecisionWithReference,
    LLMContextRecall,
    NoiseSensitivity,
    Faithfulness,
    AnswerRelevancy,
)

logger = logging.getLogger(__name__)


def create_local_ragas_llm(
    model: str = "qwen2.5:3b",
    base_url: str = "http://localhost:11434/v1",
    max_workers: int = 2,
) -> BaseRagasLLM:
    """
    Creates a local RAGAS LLM pointing to local Ollama OpenAI-compatible endpoint
    with RunConfig(max_workers=2) to prevent choking on 16GB RAM hardware.
    """
    run_config = RunConfig(max_workers=max_workers)
    return llm_factory(model=model, base_url=base_url, run_config=run_config)
