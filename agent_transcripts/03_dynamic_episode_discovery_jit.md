# Agent Transcript 03: Dynamic Episode Discovery & Additive JIT Ingestion

## Overview
This transcript documents the engineering trajectory for upgrading **The Lenny Growth Assistant** from a static 7-episode seed database to a dynamic, Just-In-Time (JIT) 269-episode discovery and additive ingestion engine connected to `ChatPRD/lennys-podcast-transcripts`.

---

## Technical Challenges, Failures & Architectural Resolutions

### 1. The Substring Collision Trap in Topic Matching
- **Issue:** Early regex implementation used simple substring matching (`kw.lower() in query.lower()`). When testing with queries containing words like *"Qatar"* or *"market"*, short keywords like `"AR"` (Augmented Reality) or `"mar"` triggered false positive downloads for episodes the user never asked about.
- **Attempted Fix:** Filtering keywords by length $> 3$.
- **Failure:** Legitimate 2- and 3-letter acronyms like `"PLG"`, `"OKR"`, `"SEO"`, and `"CAC"` were ignored.
- **Resolution:** Implemented regex word-boundary matching in `backend/app/rag/discovery.py`:
  ```python
  pattern = r"\b" + re.escape(kw) + r"\b"
  if re.search(pattern, clean_query, flags=re.IGNORECASE):
      # Match confirmed
  ```
  Added a curated discard list of generic dictionary terms (`code`, `world`, `system`, `data`, `work`) so only domain-rich terminology triggers automated indexing.

### 2. GitHub REST API Rate Limiting vs. Fastly CDN Streaming
- **Issue:** Attempting to query GitHub's REST API (`api.github.com/repos/...`) during chat turns exhausted the unauthenticated rate limit (60 requests/hour) almost immediately.
- **Resolution:** Sourced transcripts strictly through GitHub's Fastly CDN endpoint:
  `https://raw.githubusercontent.com/ChatPRD/lennys-podcast-transcripts/main/transcripts/{slug}/transcript.md`.
  This endpoint is completely unauthenticated, cached edge-wide, and immune to API rate limits, streaming raw markdown in $<1.5\text{s}$.

### 3. Destruction vs. Additive Upsert in pgvector
- **Issue:** The original `ingest.py` batch script executed `DELETE FROM transcript_chunks` before re-indexing. In a multi-user runtime, triggering dynamic ingestion would wipe all pre-indexed episodes.
- **Resolution:** Architected `process_single_transcript_file` and `ingest_single_episode` in `backend/app/rag/ingest.py`:
  ```python
  # Checks existing chunk count for episode slug
  existing = db.execute(select(func.count(TranscriptChunk.id)).where(TranscriptChunk.episode_title.ilike(f"%{match.guest}%")))
  if count == 0:
      db.bulk_save_objects(new_chunks)
      await db.commit()
  ```
  Existing chunks are strictly preserved, allowing the database to incrementally grow from 516 chunks $\to$ 556 chunks $\to$ full coverage without downtime.

### 4. Real-Time User Feedback via SSE Status Events
- **Issue:** When a user asked about an unindexed guest (e.g. Casey Winters), download and embedding took ~4.5 seconds before the first LLM token arrived. Without feedback, users assumed the backend had hung.
- **Resolution:** Integrated intermediate SSE status events into `backend/app/api/chat.py`:
  1. `{"type": "status", "content": "Scanning Lenny's 269-episode catalog..."}`
  2. `{"type": "status", "content": "Found episode: Casey Winters. Fetching transcript..."}`
  3. `{"type": "status", "content": "Indexing Casey Winters into vector archive (40 chunks)..."}`
  4. `{"type": "status", "content": "Retrieving grounded insights..."}`
  The frontend UI renders these dynamically in the status indicator pill.

---

## Verification & Metric Results

1. **Discovery Unit Tests (`backend/tests/test_discovery.py`):**
   - 8/8 unit tests passed in $0.624\text{s}$.
   - Verified guest matching (`casey-winters`), slug matching (`elena-verna`), and multi-word topic matching (`OKR`).
   - Verified strict rejection of off-topic queries (`"How do I bake lasagna?"`, `"Who won the soccer match?"`).
2. **Live JIT Additive Ingestion (`backend/tests/test_jit_ingest.py`):**
   - CDN Download Time: $1,210\text{ms}$
   - Parsing & `all-MiniLM-L6-v2` Embedding Time (40 chunks): $3,340\text{ms}$
   - Supabase pgvector Additive Upsert: Database chunk count grew from 516 to 556 chunks.
   - Vector Retrieval Execution: $95.9\text{ms}$ returning verified similarity score of $0.803$.
3. **Live Server Health Probe:**
   - `http://localhost:8000/api/health` $\to$ `{"status": "ok", "database": "healthy", "pgvector_chunks_indexed": 556}`.
