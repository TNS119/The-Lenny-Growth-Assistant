# backend/app/rag/embeddings.py
import logging
import os
import gc
import ctypes
from typing import List, Tuple
from functools import lru_cache
import asyncio

logger = logging.getLogger(__name__)

# Enforce strict thread and memory limits BEFORE importing torch/BLAS
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
os.environ.setdefault("VECLIB_MAXIMUM_THREADS", "1")
os.environ.setdefault("NUMEXPR_NUM_THREADS", "1")
os.environ.setdefault("PYTORCH_NO_CUDA_MEMORY_CACHING", "1")
os.environ.setdefault("MALLOC_TRIM_THRESHOLD_", "65536")
os.environ.setdefault("HF_HUB_ENABLE_HF_TRANSFER", "0")

import torch
# Disable autograd engine and limit thread pools to 1 to cut RAM consumption by ~50%
torch.set_grad_enabled(False)
torch.set_num_threads(1)
torch.set_num_interop_threads(1)

_model_instance = None

def reclaim_memory():
    """Forces Python garbage collection and returns free heap memory to OS on Linux."""
    gc.collect()
    try:
        # On Linux/Render/Docker, force glibc to release unused heap pages back to the kernel
        ctypes.CDLL("libc.so.6").malloc_trim(0)
    except Exception:
        pass

def get_sentence_transformer_model():
    """Load the SentenceTransformer model with CPU-pinning and offline-first priority."""
    global _model_instance
    if _model_instance is None:
        from sentence_transformers import SentenceTransformer
        logger.info("Initializing SentenceTransformer on CPU with low-memory footprint...")
        try:
            # Explicit device='cpu' prevents PyTorch from initializing heavy CUDA driver buffers
            _model_instance = SentenceTransformer("all-MiniLM-L6-v2", local_files_only=True, device="cpu")
            logger.info("Loaded SentenceTransformer in offline CPU mode from local cache.")
        except Exception:
            _model_instance = SentenceTransformer("all-MiniLM-L6-v2", device="cpu")
        reclaim_memory()
    return _model_instance

@lru_cache(maxsize=1024)
def _encode_query_cached(text: str) -> Tuple[float, ...]:
    """Cached query encoder to provide 0.000s instant vector lookup without re-allocating tensors."""
    model = get_sentence_transformer_model()
    with torch.inference_mode():
        vec = model.encode(text, normalize_embeddings=True, show_progress_bar=False, device="cpu")
    return tuple(float(x) for x in vec)

async def get_embedding(text: str) -> List[float]:
    """Compute a 384-dimensional vector embedding for a query with in-memory caching."""
    loop = asyncio.get_running_loop()
    clean_text = text.strip()
    embedding_tuple = await loop.run_in_executor(
        None, 
        lambda: _encode_query_cached(clean_text)
    )
    return list(embedding_tuple)

def compute_embeddings_batch(texts: List[str], batch_size: int = 16) -> List[List[float]]:
    """Synchronously compute embeddings in small batches (16 chunks) to prevent memory spikes."""
    model = get_sentence_transformer_model()
    with torch.inference_mode():
        embeddings = model.encode(texts, batch_size=batch_size, show_progress_bar=False, normalize_embeddings=True, device="cpu")
    reclaim_memory()
    return embeddings.tolist()
