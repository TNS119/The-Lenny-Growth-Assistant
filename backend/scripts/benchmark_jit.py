# backend/scripts/benchmark_jit.py
import time
import json
import httpx

BASE_URL = "http://localhost:8000/api/chat"

def measure_stream_query(query: str, label: str):
    print(f"\n=======================================================")
    print(f"TEST: {label}")
    print(f"QUERY: '{query}'")
    print(f"=======================================================")

    payload = {
        "message": query,
        "mode": "default",
        "provider": "ollama"
    }

    t0 = time.perf_counter()
    first_token_time = None
    first_status_time = None
    status_updates = []
    response_tokens = []
    sources = []

    with httpx.Client(timeout=120.0) as client:
        with client.stream("POST", BASE_URL, json=payload) as response:
            for line in response.iter_lines():
                if not line or not line.startswith("data: "):
                    continue
                data_str = line[6:].strip()
                if data_str == "[DONE]":
                    break
                try:
                    event = json.loads(data_str)
                    etype = event.get("type")
                    if etype == "status":
                        if first_status_time is None:
                            first_status_time = time.perf_counter() - t0
                        status_updates.append(event.get("content"))
                        print(f"  [STATUS @ {time.perf_counter() - t0:.2f}s] {event.get('content')}")
                    elif etype == "sources":
                        sources = event.get("data", [])
                        print(f"  [SOURCES @ {time.perf_counter() - t0:.2f}s] {len(sources)} chunks retrieved")
                    elif etype == "token":
                        if first_token_time is None:
                            first_token_time = time.perf_counter() - t0
                        response_tokens.append(event.get("content", ""))
                except Exception:
                    pass

    total_time = time.perf_counter() - t0
    full_text = "".join(response_tokens).strip()

    print(f"\n--- METRICS SUMMARY ---")
    print(f"Time to first status: {first_status_time * 1000 if first_status_time else 0:.1f} ms")
    print(f"Time to first token : {first_token_time * 1000 if first_token_time else 0:.1f} ms ({first_token_time:.2f} s)")
    print(f"Total stream duration: {total_time:.2f} s")
    print(f"Total response length: {len(full_text)} chars")
    print(f"First 150 chars: {full_text[:150]}...")
    return {
        "label": label,
        "first_status_ms": round((first_status_time or 0) * 1000, 1),
        "first_token_ms": round((first_token_time or 0) * 1000, 1),
        "total_s": round(total_time, 2),
        "sources_count": len(sources),
        "sample": full_text[:120]
    }

if __name__ == "__main__":
    results = []

    # 1. Existing cached episode (Brian Chesky)
    r1 = measure_stream_query("What is Brian Chesky's view on founder mode?", "1. CACHED EPISODE (Brian Chesky)")
    results.append(r1)

    # 2. Off-topic ungrounded query (Cooking)
    r2 = measure_stream_query("How to cook delicious chicken biryani?", "2. OFF-TOPIC REFUSAL (Cooking)")
    results.append(r2)

    # 3. New episode via JIT (Christina Wodtke - OKRs)
    r3 = measure_stream_query("How should a product team implement OKRs?", "3. BRAND-NEW EPISODE JIT (Christina Wodtke on OKRs)")
    results.append(r3)

    # 4. Repeat query on newly ingested episode (Christina Wodtke)
    r4 = measure_stream_query("What are the 3 key results in Christina Wodtke's OKRs?", "4. REPEAT QUERY ON NEW EPISODE (Now Cached in DB)")
    results.append(r4)

    print("\n\n" + "=" * 70)
    print("FINAL REAL-TIME PERFORMANCE BENCHMARK MATRIX")
    print("=" * 70)
    print(f"{'Scenario':<42} | {'1st Token':<12} | {'Total Time':<10} | {'Sources'}")
    print("-" * 75)
    for r in results:
        print(f"{r['label']:<42} | {r['first_token_ms']:>8.1f} ms | {r['total_s']:>8.2f} s | {r['sources_count']} chunks")
    print("=" * 70)
