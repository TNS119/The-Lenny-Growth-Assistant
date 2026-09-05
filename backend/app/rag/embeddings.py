# backend/app/rag/embeddings.py
import logging
from typing import List
from functools import lru_cache
import asyncio

logger = logging.getLogger(__name__)

_model_instance = None

def get_sentence_transformer_model():
    """Lazily load the SentenceTransformer model to optimize memory and startup."""
    global _model_instance
    if _model_instance is None:
        from sentence_transformers import SentenceTransformer
        logger.info("Loading SentenceTransformer model: all-MiniLM-L6-v2 (384 dimensions)...")
        _model_instance = SentenceTransformer("all-MiniLM-L6-v2")
    return _model_instance

async def get_embedding(text: str) -> List[float]:
    """Compute a 384-dimensional vector embedding for a single text query."""
    loop = asyncio.get_running_loop()
    model = get_sentence_transformer_model()
    # Run CPU-bound encoding in default thread pool executor to avoid blocking the async event loop
    embedding = await loop.run_in_executor(
        None, 
        lambda: model.encode(text, normalize_embeddings=True).tolist()
    )
    return embedding

def compute_embeddings_batch(texts: List[str], batch_size: int = 64) -> List[List[float]]:
    """Synchronously compute embeddings for a batch of texts (used in ingest.py)."""
    model = get_sentence_transformer_model()
    embeddings = model.encode(texts, batch_size=batch_size, show_progress_bar=True, normalize_embeddings=True)
    return embeddings.tolist()
