# backend/tests/test_jit_ingest.py
import asyncio
import time
import unittest
from pathlib import Path
from dotenv import load_dotenv

# Load env variables from root .env
_ROOT_ENV = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(_ROOT_ENV, override=True)

import asyncpg
from app.config import get_settings
from app.rag.discovery import discovery_service
from app.rag.ingest import ingest_single_episode
from app.rag.retriever import TranscriptRetriever
from app.rag.embeddings import get_embedding

class TestJITIngestAndMetrics(unittest.TestCase):

    def test_jit_pipeline_and_latency_metrics(self):
        async def run_pipeline():
            settings = get_settings()
            dsn = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
            conn = await asyncpg.connect(dsn)
            initial_count = await conn.fetchval("SELECT count(*) FROM transcript_chunks")
            await conn.close()

            print(f"\n[METRICS] Initial Supabase chunk count: {initial_count}")

            # 1. Measure Discovery & Download
            slug = "casey-winters"
            t0 = time.perf_counter()
            local_path = discovery_service.fetch_and_cache_transcript(slug)
            t_download = time.perf_counter() - t0
            print(f"[METRICS] Fetch & Cache '{slug}' transcript: {t_download * 1000:.1f} ms (Path: {local_path.name})")

            # 2. Measure Ingestion (Chunking + Embeddings + Upsert)
            t1 = time.perf_counter()
            ingested_chunks = await ingest_single_episode(local_path)
            t_ingest = time.perf_counter() - t1
            print(f"[METRICS] Ingest '{slug}' ({ingested_chunks} chunks): {t_ingest:.2f} s")

            # 3. Verify Non-Destructive Addition
            conn = await asyncpg.connect(dsn)
            updated_count = await conn.fetchval("SELECT count(*) FROM transcript_chunks")
            await conn.close()
            self.assertGreaterEqual(updated_count, initial_count, "Chunk count must remain or increase additively without data loss")
            self.assertGreaterEqual(ingested_chunks, 1, "Must ingest at least one chunk")

            # 4. Measure Retrieval Latency for Freshly Indexed Episode
            retriever = TranscriptRetriever(None, get_embedding) # local fallback test
            query = "What did Casey Winters say about growth loops?"
            t2 = time.perf_counter()
            chunks = await retriever.retrieve_relevant_chunks(query, similarity_threshold=0.65)
            t_retrieval = time.perf_counter() - t2
            print(f"[METRICS] Retrieval for '{query}': {t_retrieval * 1000:.1f} ms ({len(chunks)} chunks found)")
            self.assertGreater(len(chunks), 0, "Should retrieve chunks for Casey Winters")
            print(f"[METRICS] Top chunk: {chunks[0]['guest']} - Score: {chunks[0]['score']}")

            return {
                "download_ms": round(t_download * 1000, 1),
                "ingest_s": round(t_ingest, 2),
                "retrieval_ms": round(t_retrieval * 1000, 1),
                "initial_count": initial_count,
                "updated_count": updated_count,
                "chunks_added": updated_count - initial_count
            }

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        metrics = loop.run_until_complete(run_pipeline())
        loop.close()
        self.assertIsNotNone(metrics)

if __name__ == "__main__":
    unittest.main()
