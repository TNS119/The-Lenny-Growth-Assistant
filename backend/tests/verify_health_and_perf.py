import os
import psutil
import time
import httpx
import json
import asyncio
from app.rag.embeddings import get_sentence_transformer_model, get_embedding, reclaim_memory

def run_diagnostics():
    p = psutil.Process(os.getpid())
    print("=== 1. MEMORY PROFILE CHECK ===")
    m = get_sentence_transformer_model()
    print(f"SentenceTransformer loaded RSS: {p.memory_info().rss / 1024 / 1024:.2f} MB")

    emb = asyncio.run(get_embedding("What is Kunal Shah's Delta 4 framework for products?"))
    print(f"Post-embedding RSS: {p.memory_info().rss / 1024 / 1024:.2f} MB, dimension: {len(emb)}")
    reclaim_memory()
    print(f"After reclaim_memory() RSS: {p.memory_info().rss / 1024 / 1024:.2f} MB")

    print("\n=== 2. LIVE CHAT STREAM VERIFICATION ===")
    t0 = time.time()
    ttfc = None
    tokens_count = 0
    sources_count = 0
    response_sample = []

    with httpx.stream(
        "POST",
        "http://localhost:8000/api/chat",
        json={
            "session_id": "verify-session-check-001",
            "message": "What is Kunal Shah's Delta 4 framework for products?",
            "provider": "groq"
        },
        timeout=30.0
    ) as resp:
        print(f"HTTP Status Code: {resp.status_code}")
        for line in resp.iter_lines():
            if not line or not line.startswith("data: "):
                continue
            if ttfc is None:
                ttfc = time.time() - t0
            payload = line[6:].strip()
            if payload == "[DONE]":
                break
            try:
                d = json.loads(payload)
                if d.get("type") == "token":
                    tokens_count += 1
                    response_sample.append(d.get("content", ""))
                elif d.get("type") == "sources":
                    sources_count = len(d.get("data", []))
            except Exception:
                pass

    t_total = time.time() - t0
    joined_text = "".join(response_sample)
    print(f"Time to First Chunk (TTFC): {ttfc:.3f}s")
    print(f"Total Response Time: {t_total:.3f}s")
    print(f"Tokens Received: {tokens_count}")
    print(f"Podcast Sources Linked: {sources_count}")
    print(f"Response Preview: {joined_text[:120]}...")
    
    # Assertions
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    assert tokens_count > 10, "Expected generated tokens"
    assert sources_count >= 1, "Expected verified podcast sources linked"
    print("\nALL LIVE CHECKS AND CORE ASSERTIONS PASSED!")

if __name__ == "__main__":
    run_diagnostics()
