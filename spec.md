# SPECIFICATION DOCUMENT: THE LENNY GROWTH ASSISTANT
**Document Version:** 1.2.0  
**System Name:** The Lenny Growth Assistant  
**Target Environment:** Single-command Local Deployment (`docker-compose up`)

---

## 1. Executive Summary

### 1.1 Engagement Context & Problem Statement
Product managers and growth leaders operate in high-velocity environments requiring rapid, battle-tested tactical decisions (pricing adjustments, viral loop mechanics, activation funnel optimization, PM hiring). While *Lenny’s Podcast* contains 269 candid, operational interviews (~3.5M words) from the world’s top product and growth practitioners, this knowledge remains locked in dense audio and linear transcripts. 

**The Lenny Growth Assistant** is an enterprise-grade, full-stack Retrieval-Augmented Generation (RAG) conversational platform designed to unlock this archive. It transforms unstructured interview dialogue into grounded, source-attributed answers, features **Just-In-Time (JIT) Dynamic Episode Discovery & Additive Ingestion** across the entire 269-episode universe, produces structured 1,250-word essays formatted via the *Ship 30 for 30* framework, and renders dynamic Markdown and interactive HTML/CSS operational artifacts in a secure, sandboxed side-by-side drawer.

### 1.2 Target Persona & User Journey
* **Primary Persona:** Growth Product Manager, VP of Product, or Early-Stage Founder.
* **Core Job-to-be-Done (JTBD):** "When I face an ambiguous growth problem, I want to query vetted product wisdom from world-class operators with verified timestamps and turn that synthesis into an actionable essay or interactive tool, so that my team can implement proven tactics immediately without 20+ hours of manual research."
* **Pain Points Addressed:**
  1. *Information Density:* Inability to scan audio/lengthy transcripts efficiently.
  2. *Hallucination & Speculation:* Generic LLMs offering ungrounded or fabricated growth frameworks.
  3. *Archive Fragmentation:* Need to access any of the 269 episodes on demand without requiring massive upfront vector database compute.
  4. *Actionability Gap:* Answers remaining theoretical rather than formatted into operational blueprints.
  5. *Security & Isolation Risk:* Code and UI snippets executing directly in the client DOM without isolation.

### 1.3 Key Success Metrics
* **Retrieval Citation Accuracy:** $\ge 90\%$ of generated factual claims must include precise source citations `[Episode: Guest Name, Timestamp/Topic]`.
* **Grounded Rejection Rate:** $100\%$ refusal on out-of-domain queries below the cosine similarity threshold with the standard fallback string:  
  `"I do not have sufficient information in Lenny's podcast archive to answer this."`
* **JIT Episode Ingestion & Retrieval Latency:** $< 1.5\text{s}$ CDN download, $< 3.5\text{s}$ embedding computation, $< 100\text{ms}$ pgvector retrieval.
* **Local Inference Latency:** Time-to-First-Token (TTFT) $< 4.0\text{s}$ when executing locally via Ollama (`llama3.2:3b` / `llama3.1:8b`).
* **Artifact Render Safety:** $0$ Cross-Site Scripting (XSS) vulnerabilities via strict iframe sandboxing (`allow-scripts`, no `allow-same-origin`) and `DOMPurify` HTML sanitization.
* **Operational Time-to-Demo:** $< 5$ minutes from fresh clone to full running system using single-command `docker-compose up`.

### 1.4 Scope Boundaries & Architectural Trade-offs
* **In Scope:**
  * Ingestion and HNSW vector indexing of Lenny's Podcast transcripts.
  * **Just-In-Time Dynamic Episode Discovery:** Live scanning of 269-episode catalog (`episodes_manifest.json`), dynamic raw transcript fetching from GitHub Fastly CDN, and additive non-destructive upserts into Supabase/PostgreSQL pgvector.
  * Dual-layer LLM architecture: Local inference via Ollama (`llama3.2:3b`) and cloud fallback/toggle via Anthropic Claude (`claude-3-5-sonnet-20241022`), Groq Qwen 27B, Google Gemini 2.0 Flash, or OpenAI (`gpt-4o`).
  * Dedicated "Ship 30 for 30" writing skill engine producing ~1,250-word essays with hooks, short paragraphs, bold anchors, and actionable frameworks.
  * Dual-pane responsive UI featuring chat on the left and a collapsible Claude-style Artifact viewer on the right.
  * Multi-session persistence in PostgreSQL with conversation history and artifact tracking.
  * Resilient health probes, structured logging, and automated test coverage.
* **Out of Scope (Intentionally Excluded):**
  * Real-time audio processing or live speech-to-text (transcripts ingested from pre-transcribed text archives).
  * External web-search integration (retrieval is strictly bounded to the podcast archive).
  * Multi-tenant authentication/OAuth (designed as an internal deployment ready for single-organization SSO integration).
* **Key Architectural Trade-offs:**
  * *On-Demand JIT Ingestion vs. Complete Upfront Batch Indexing:* Indexing all 269 transcripts upfront requires significant time and database storage. By pairing an in-memory 269-episode manifest with Fastly CDN streaming and additive vector upserts, the system starts in seconds and dynamically indexes new episodes in $<5$ seconds on first query.
  * *Local 3B/8B Parameter Models vs. Cloud Frontier Models:* Local 3B/8B models offer zero API cost, data privacy, and complete local portability for developers, but possess smaller context windows and stricter reasoning limits. The architecture uses a unified provider interface allowing instant switching to Claude 3.5 Sonnet or Gemini 2.0 Flash for high-capacity production synthesis.
  * *Client-Side Sandboxed Iframe vs. Server-Side Rendering:* Sandboxing the HTML artifact rendering in an iframe (`sandbox="allow-scripts"`, omitting `allow-same-origin`) eliminates browser state contamination (cookies/localStorage) while allowing interactive UI components.

---

## 2. System Architecture & Data Contracts

```
+------------------------------------------------------------------------------------------------+
|                                         CLIENT BROWSER                                         |
|  +--------------------------------------------------+  +------------------------------------+  |
|  |                    Left Pane                     |  |             Right Pane             |  |
|  |   - Session Selector (Full-Height Sidebar)       |  |   - Claude-Style Artifact Viewer   |  |
|  |   - Model Selector (DropUp / Local / Cloud)      |  |   - React-Markdown (MD)            |  |
|  |   - Chat Interface (Real-Time SSE Stream)        |  |   - Sandboxed Iframe (HTML/JS)     |  |
|  |   - Citations Drawer & Dynamic JIT Status Pills  |  |     (null origin, DOMPurify)       |  |
|  +--------------------------------------------------+  +------------------------------------+  |
+-----------------------------------------------^------------------------------------------------+
                                                | HTTP / SSE (EventSource/Fetch)
                                                v
+------------------------------------------------------------------------------------------------+
|                                      FASTAPI BACKEND                                           |
|  +---------------------+  +-------------------------+  +-------------------------------------+ |
|  | Session & Chat API  |  | Retrieval Engine        |  | Ship 30 for 30 Skill Engine         | |
|  | - SSE Event Stream  |  | - HNSW Cosine Search    |  | - 1,250-word Essay Heuristics       | |
|  | - Artifact Parser   |  | - Grounding Circuit     |  | - Guest Attribution Anchor         | |
|  +----------+----------+  +------------+------------+  +------------------+------------------+ |
|             |                          |                                  |                    |
|             v                          v                                  v                    |
|  +---------------------+  +-------------------------+  +-------------------------------------+ |
|  | JIT Discovery Svc   |  | Additive Ingest Engine  |  | Dynamic Provider Factory            | |
|  | - 269 Manifest Scan |  | - Chunking & Embeddings |  | - Ollama, Groq, Gemini, Claude, OAI | |
|  +----------+----------+  +------------+------------+  +-------------------------------------+ |
+-------------|--------------------------|-------------------------------------------------------+
              |                          |
              v (Fetch on Cache Miss)    v (Upsert New Chunks)
+-----------------------------+   +--------------------------------------------------------------+
| GITHUB FASTLY CDN           |   | POSTGRESQL 16 + PGVECTOR                                     |
| raw.githubusercontent.com   |   | - Table: sessions                                            |
| 269 Markdown Transcripts    |   | - Table: messages (role, content, sources JSONB)            |
| Rate-limit immune CDN       |   | - Table: artifacts (message_id, artifact_type, content)     |
|                             |   | - Table: transcript_chunks (text, embedding vector(384))     |
+-----------------------------+   +--------------------------------------------------------------+
```

### 2.1 Database Schema & Pgvector Indexing
PostgreSQL 16 with `pgvector` extension enabled.

#### Tables
1. **`sessions`**
   * `id`: `UUID` (Primary Key, default `gen_random_uuid()`)
   * `title`: `VARCHAR(255)` (Derived from initial prompt or default)
   * `created_at`: `TIMESTAMP WITH TIME ZONE` (default `NOW()`)
   * `updated_at`: `TIMESTAMP WITH TIME ZONE` (default `NOW()`)

2. **`messages`**
   * `id`: `UUID` (Primary Key, default `gen_random_uuid()`)
   * `session_id`: `UUID` (Foreign Key $\to$ `sessions.id` ON DELETE CASCADE)
   * `role`: `VARCHAR(50)` (`"user"`, `"assistant"`, `"system"`)
   * `content`: `TEXT` (Raw message text including markdown and artifact tags)
   * `sources`: `JSONB` (Array of retrieved chunk objects: `[{episode, guest, text, timestamp, score}]`)
   * `created_at`: `TIMESTAMP WITH TIME ZONE` (default `NOW()`)

3. **`artifacts`**
   * `id`: `UUID` (Primary Key, default `gen_random_uuid()`)
   * `message_id`: `UUID` (Foreign Key $\to$ `messages.id` ON DELETE CASCADE)
   * `artifact_type`: `VARCHAR(50)` (`"markdown"` | `"html"`)
   * `title`: `VARCHAR(255)`
   * `content`: `TEXT`
   * `created_at`: `TIMESTAMP WITH TIME ZONE` (default `NOW()`)

4. **`transcript_chunks`**
   * `id`: `BIGSERIAL` (Primary Key)
   * `episode_title`: `VARCHAR(255)`
   * `guest_name`: `VARCHAR(255)`
   * `publication_date`: `DATE` (nullable)
   * `timestamp_ref`: `VARCHAR(100)` (e.g., `"00:14:32"` or `"Section: Activation Loops"`)
   * `chunk_text`: `TEXT`
   * `token_count`: `INTEGER`
   * `embedding`: `VECTOR(384)` (for `sentence-transformers/all-MiniLM-L6-v2` or `VECTOR(768)` for `nomic-embed-text`)

#### Vector Index Definition (HNSW)
```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE INDEX IF NOT EXISTS idx_transcript_chunks_hnsw_cosine
ON transcript_chunks 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

### 2.2 Server-Sent Events (SSE) Streaming Protocol
`POST /api/chat` communicates responses token-by-token over HTTP SSE (`text/event-stream`).

* **Status Event:**
  ```json
  data: {"type": "status", "content": "Searching Lenny's Podcast transcripts..."}
  ```
* **Sources Event:**
  ```json
  data: {"type": "sources", "data": [{"episode": "Brian Chesky on Scaling Airbnb", "guest": "Brian Chesky", "timestamp": "00:18:22", "score": 0.84, "text": "..."}]}
  ```
* **Token Event:**
  ```json
  data: {"type": "token", "content": "To"}
  ```
* **Artifact Open/Close Event:**
  ```json
  data: {"type": "artifact_open", "artifact_type": "html", "title": "Viral Growth Calculator"}
  data: {"type": "artifact_chunk", "content": "<!DOCTYPE html>..."}
  data: {"type": "artifact_close"}
  ```
* **Done Event:**
  ```json
  data: [DONE]
  ```

### 2.3 Artifact Contract & Tag Heuristics
The LLM is prompted to encapsulate reusable artifacts within custom XML-style delimiters:
```xml
<artifact type="html" title="Interactive LTV/CAC Model">
<!DOCTYPE html>
<html>
...
</html>
</artifact>
```
or
```xml
<artifact type="markdown" title="Growth Strategy Executive Memo">
# Executive Memo
...
</artifact>
```
The frontend stream processor extracts the `<artifact>` block, rendering standard text inside the chat pane and streaming the artifact content into the Artifact Drawer.

---

## 3. Technology Stack Specification

| Tier | Component | Selection | Version / Specification | Rationale |
| :--- | :--- | :--- | :--- | :--- |
| **Backend** | Runtime & Framework | Python + FastAPI | Python 3.11+, FastAPI $\ge 0.110.0$ | Async I/O, native Pydantic v2 validation, high throughput. |
| **Backend** | Server Engine | Uvicorn | $\ge 0.28.0$ (standard workers) | Production ASGI implementation. |
| **Backend** | ORM & DB Driver | SQLAlchemy (Async) + asyncpg | SQLAlchemy 2.0+, asyncpg $\ge 0.29.0$ | Pure asynchronous PostgreSQL pooling and query execution. |
| **Database** | Relational + Vector | PostgreSQL + pgvector | PostgreSQL 16 (`pgvector/pgvector:pg16`) | Unified persistence for conversations, artifacts, and HNSW vector search. |
| **Embedding** | Vectorizer | Sentence-Transformers | `all-MiniLM-L6-v2` (384-dim) | Fast local CPU/GPU embedding with high semantic retrieval quality. |
| **Catalog & CDN** | Transcript Distribution | GitHub Fastly CDN + Local Manifest | `raw.githubusercontent.com`, `episodes_manifest.json` | Zero-rate-limit static file delivery across all 269 podcast transcripts. |
| **Discovery Svc** | JIT Episode Matcher | Regex Word-Boundary Scanner | `EpisodeDiscoveryService` (Python) | Instant ($<2\text{ms}$) deterministic guest, slug, and topic matching with off-topic gating. |
| **LLM: Local** | Inference Engine | Ollama | Ollama 0.3+ (`llama3.2:3b`, `llama3.1:8b`) | Native local inference, zero API fees, air-gapped deployment readiness. |
| **LLM: Cloud** | Cloud Providers | Groq, Gemini, Claude, OpenAI | `qwen3.8-27b`, `gemini-2.0-flash`, `claude-3-5-sonnet`, `gpt-4o` | Frontier model synthesis for complex 1,250-word essays and UI artifacts. |
| **Frontend** | Framework | Next.js 14 (App Router) | React 18+ (TypeScript 5) | Type safety, component architecture, fast streaming re-renders. |
| **Frontend** | Styling | Tailwind CSS | $\ge 3.4.0$ | Utility-first responsive design, Warm Editorial palette tokens. |
| **Frontend** | Markdown Engine | `react-markdown` + `remark-gfm` | `react-markdown` v9+ | GitHub-flavored markdown parsing, table, and codeblock support. |
| **Frontend** | Sandboxing & Security | `DOMPurify` + HTML Iframe | `dompurify` $\ge 3.0.0$, `sandbox="allow-scripts"` | Zero parent context leak (`allow-same-origin` omitted), sanitized HTML. |
| **DevOps** | Container Orchestration | Docker & Docker Compose | Docker Compose v2 (v24.x+) | Single-command reproducible startup for database, backend, and frontend. |

---

## 4. Exact Project Directory Structure

```
lenny-growth-assistant/
├── .env.example
├── docker-compose.yml
├── README.md
├── spec.md
├── AGENTS.md
├── docs/
│   ├── PRD.md
│   ├── architecture.md
│   └── design.md
├── agent_transcripts/
│   ├── 01_initial_scaffolding.md
│   ├── 02_ui_refinement_and_security.md
│   └── 03_dynamic_episode_discovery_jit.md
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── data/
│   │   ├── episodes_manifest.json
│   │   └── transcripts/
│   ├── scripts/
│   │   ├── sync_manifest.py
│   │   └── ingest.py
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── db_models.py
│   │   │   └── schemas.py
│   │   ├── providers/
│   │   │   ├── __init__.py
│   │   │   ├── base.py
│   │   │   ├── ollama_provider.py
│   │   │   └── cloud_provider.py
│   │   ├── rag/
│   │   │   ├── __init__.py
│   │   │   ├── discovery.py
│   │   │   ├── retriever.py
│   │   │   ├── embeddings.py
│   │   │   └── ingest.py
│   │   ├── skills/
│   │   │   ├── __init__.py
│   │   │   ├── ship30_writer.py
│   │   │   └── artifact_generator.py
│   │   └── api/
│   │       ├── __init__.py
│   │       ├── sessions.py
│   │       ├── chat.py
│   │       ├── providers.py
│   │       └── health.py
│   └── tests/
│       ├── __init__.py
│       ├── test_discovery.py
│       ├── test_jit_ingest.py
│       ├── test_api.py
│       ├── test_retrieval.py
│       └── test_providers.py
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── tailwind.config.js
    ├── tsconfig.json
    ├── PRODUCT.md
    ├── DESIGN.md
    └── src/
        ├── app/
        │   ├── layout.tsx
        │   └── page.tsx
        ├── components/
        │   ├── Chat/
        │   │   ├── ChatPane.tsx
        │   │   ├── MessageItem.tsx
        │   │   └── ModelSelector.tsx
        │   └── Artifact/
        │       ├── ArtifactViewer.tsx
        │       └── SandboxedIframe.tsx
        ├── hooks/
        │   └── useChatStream.ts
        └── lib/
            └── api.ts
```

---

## 5. Step-by-Step Implementation Blueprint

### Step 1: Forward Deployment Discovery & Documentation
1. **`docs/PRD.md`**: Author the complete Product Requirements Document:
   * Formalize persona definitions (Growth PM, Head of Growth, Solo Founder).
   * Specify quantifiable success metrics: Retrieval Citation Precision ($\ge 90\%$), TTFT ($< 4\text{s}$), Zero-XSS Sandbox assurance.
   * Document key user stories:
     * *Story 1:* Ask deep questions on retention, pricing, and onboarding with citations.
     * *Story 2:* Transform tactical answers into 1,250-word Ship 30 for 30 essays.
     * *Story 3:* Generate interactive tools (e.g., CAC calculators) rendered natively in the Artifact Viewer.
   * List explicit scope inclusions/exclusions and technical trade-offs.
2. **`docs/architecture.md`**: Document end-to-end data contracts, pgvector HNSW indexing, streaming SSE schemas, and LLM abstraction layers.
3. **`docs/design.md`**: Detail dual-column desktop and responsive mobile layout, state machines (idle, retrieving, streaming, artifact rendering), and accessibility (ARIA labels, keyboard navigation).

### Step 2: Knowledge Ingestion & JIT Vector Indexing Pipeline
1. **Catalog Manifest Synchronization (`backend/scripts/sync_manifest.py`):**
   * Fetch `index/episodes.md` from `ChatPRD/lennys-podcast-transcripts` via Fastly CDN.
   * Parse 269 episode rows: slug, guest name, episode title, publication date, raw transcript CDN URL, and extract domain keywords.
   * Generate lightweight in-memory catalog `backend/data/episodes_manifest.json` (~120KB).
2. **Just-In-Time Dynamic Discovery Service (`backend/app/rag/discovery.py`):**
   * Perform instantaneous ($<2\text{ms}$) word-boundary regex matching across guest names, slugs, and domain keywords.
   * Apply strict off-topic discard filters (cooking, sports, generic programming queries) to prevent spurious downloads.
3. **Additive Ingestion Pipeline (`backend/app/rag/ingest.py`):**
   * Fetch individual raw markdown transcripts from GitHub Fastly CDN with streaming timeout handling.
   * Parse YAML frontmatter and apply recursive character text splitting ($500\text{--}800$ tokens with $100$-token overlap).
   * Compute embeddings using `sentence-transformers/all-MiniLM-L6-v2` (384 dimensions).
   * Perform non-destructive additive upsert into PostgreSQL/Supabase table `transcript_chunks` (`ingest_single_episode`).
   * Preserve all pre-existing chunks; ensure HNSW cosine index `idx_transcript_chunks_hnsw_cosine` remains active.

### Step 3: Multi-Provider LLM & Routing Layer
1. **Base Interface (`backend/app/providers/base.py`):**
   * Declare abstract base class `BaseLLMProvider` with asynchronous generator method:
     `generate_response(messages: List[Dict[str, str]], system_prompt: str, temperature: float) -> AsyncGenerator[str, None]`.
2. **Concrete Ollama Driver (`backend/app/providers/ollama_provider.py`):**
   * Connect to Ollama endpoint (`http://localhost:11434` or `http://host.docker.internal:11434`).
   * Stream tokens from `/api/chat` via asynchronous `httpx.AsyncClient`.
   * Include connection retry logic and clear error handling for unpulled models or stopped services.
3. **Concrete Cloud Driver (`backend/app/providers/cloud_provider.py`):**
   * Implement `ClaudeProvider` using the official Anthropic SDK / HTTP API (`claude-3-5-sonnet-20241022`).
   * Implement fallback to `OpenAIProvider` (`gpt-4o`) if configured.
4. **Dynamic Provider Factory:**
   * Runtime selection based on `DEFAULT_LLM_PROVIDER` environment variable, overridable via request parameter `provider="ollama" | "claude"`.

### Step 4: Core Retrieval & "Ship 30 for 30" Skill Engine
1. **Retriever Module (`backend/app/rag/retriever.py`):**
   * Receive user query, compute embedding vector.
   * Execute cosine similarity search against `transcript_chunks` using `1 - (embedding <=> :vector)`.
   * Filter chunks below strict threshold (default `0.65`). Retrieve top $K$ ($K=4\text{--}6$).
   * If all results fall below threshold, return empty set to trigger refusal fallback.
2. **Prompt Formulation:**
   * Formulate system prompt enforcing factual grounding and citation formatting:
     `"Cite your claims explicitly using [Episode: Guest Name, Timestamp/Topic]. If the provided context does not contain sufficient information, state: 'I do not have sufficient information in Lenny\'s podcast archive to answer this.'"`.
3. **Ship 30 for 30 Engine (`backend/app/skills/ship30_writer.py`):**
   * When `mode="ship30"` is requested, wrap retrieved chunks into the Ship 30 for 30 ghostwriting prompt:
     * Hook: Counterintuitive insight or operational tension (lines 1–3).
     * Word count: $\approx 1,250$ words.
     * Skimmability: 1–3 sentence paragraphs, bold anchors on bullets, H2/H3 headers.
     * Substance: Strictly attributed to episode guests.
     * Takeaway: Operational checklist or framework.

### Step 5: FastAPI Backend & Persistence Layer
1. **Application Initialization (`backend/app/main.py`):**
   * Configure CORS (`allow_origins=["http://localhost:3000"]`).
   * Register lifespan events for database table verification and connection pooling.
   * Add structured logging middleware.
2. **Database Models (`backend/app/models/db_models.py`):**
   * Define SQLAlchemy declarative models for `Session`, `Message`, `Artifact`, `TranscriptChunk`.
3. **API Routes:**
   * `POST /api/sessions`: Create new session; return UUID.
   * `GET /api/sessions`: List past chat sessions.
   * `GET /api/sessions/{session_id}`: Return message history and associated artifacts.
   * `POST /api/chat`: SSE endpoint streaming token generation, retrieval citations, and parsing artifact blocks into database records.
   * `GET /api/health`: Health probe reporting PostgreSQL status, vector index chunk count, and Ollama connectivity.

### Step 6: Frontend Development with Claude-Style Artifact Viewer
1. **Layout & Layout State (`frontend/src/app/page.tsx`):**
   * Dual-pane responsive layout. Left pane: Chat (default full width on mobile, 50% or 60% on desktop). Right pane: Collapsible Artifact Viewer drawer (opens automatically when an artifact is streamed or clicked).
2. **Chat Interface (`frontend/src/components/Chat/`):**
   * Session selector sidebar.
   * Model selector toggle (`Ollama (Local)` vs `Claude 3.5 Sonnet (Cloud)`).
   * Mode toggle (`Grounded QA` vs `Ship 30 for 30 Essay`).
   * Streaming bubble displaying live tokens, status indicator, and citation pills.
3. **Artifact Viewer (`frontend/src/components/Artifact/`):**
   * **Markdown Renderer:** `react-markdown` with `remark-gfm` for tables, headers, and code highlighting.
   * **HTML/JS Sandboxed Iframe (`SandboxedIframe.tsx`):**
     * Sanitize incoming HTML using `DOMPurify.sanitize(content, { WHOLE_DOCUMENT: true, ADD_TAGS: ['style', 'link', 'script'] })`.
     * Render inside an `<iframe>` with `sandbox="allow-scripts"` (strictly omitting `allow-same-origin` to prevent cookie and localStorage access).
     * Include header controls: Copy code, full-screen toggle, download HTML.

### Step 7: Containerization & Operational Handoff
1. **Multi-Container Composition (`docker-compose.yml`):**
   * `db`: `pgvector/pgvector:pg16` with healthcheck.
   * `backend`: FastAPI with Uvicorn, port 8000, mapped to `host.docker.internal` for local Ollama connectivity.
   * `frontend`: Next.js / React, port 3000.
2. **Environment Configuration (`.env.example`):**
   * Clear defaults for `DATABASE_URL`, `OLLAMA_BASE_URL`, `ANTHROPIC_API_KEY`, `DEFAULT_PROVIDER`.
3. **Automated Test Suite (`backend/tests/`):**
   * `test_api.py`: Session creation, health checks, chat request validation.
   * `test_retrieval.py`: Vector search similarity scores, threshold refusal triggers.
   * `test_providers.py`: Mocked token streaming for Ollama and Claude providers.
4. **Agent Transcripts Documentation (`agent_transcripts/`):**
   * Store agent trajectories, debugging sessions, and resolution logs in `agent_transcripts/`.

---

## 6. Code Contracts & Implementation References

### 6.1 LLM Provider Interface (`backend/app/providers/`)
```python
# backend/app/providers/base.py
from abc import ABC, abstractmethod
from typing import AsyncGenerator, Dict, Any, List

class BaseLLMProvider(ABC):
    @abstractmethod
    async def generate_response(
        self,
        messages: List[Dict[str, str]],
        system_prompt: str,
        temperature: float = 0.3
    ) -> AsyncGenerator[str, None]:
        """Stream generated tokens from the LLM provider."""
        pass
```

```python
# backend/app/providers/ollama_provider.py
import httpx
import json
from typing import AsyncGenerator, Dict, Any, List
from .base import BaseLLMProvider

class OllamaProvider(BaseLLMProvider):
    def __init__(self, base_url: str = "http://localhost:11434", model: str = "llama3.2:3b"):
        self.base_url = base_url.rstrip("/")
        self.model = model

    async def generate_response(
        self,
        messages: List[Dict[str, str]],
        system_prompt: str,
        temperature: float = 0.3
    ) -> AsyncGenerator[str, None]:
        payload = {
            "model": self.model,
            "messages": [{"role": "system", "content": system_prompt}] + messages,
            "stream": True,
            "options": {"temperature": temperature}
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            try:
                async with client.stream("POST", f"{self.base_url}/api/chat", json=payload) as response:
                    if response.status_code != 200:
                        yield f"Error: Ollama service returned HTTP {response.status_code}"
                        return
                    async for line in response.aiter_lines():
                        if line:
                            chunk = json.loads(line)
                            content = chunk.get("message", {}).get("content", "")
                            if content:
                                yield content
            except httpx.ConnectError:
                yield "Error: Unable to connect to local Ollama instance at " + self.base_url
```

### 6.2 Knowledge Retrieval with Pgvector (`backend/app/rag/retriever.py`)
```python
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import List, Dict, Any

class TranscriptRetriever:
    def __init__(self, session: AsyncSession, embedding_fn):
        self.session = session
        self.embedding_fn = embedding_fn

    async def retrieve_relevant_chunks(
        self,
        query: str,
        top_k: int = 5,
        similarity_threshold: float = 0.65
    ) -> List[Dict[str, Any]]:
        query_vector = await self.embedding_fn(query)

        query_stmt = text("""
            SELECT
                episode_title,
                guest_name,
                chunk_text,
                timestamp_ref,
                1 - (embedding <=> :vector::vector) AS similarity_score
            FROM transcript_chunks
            WHERE 1 - (embedding <=> :vector::vector) >= :threshold
            ORDER BY similarity_score DESC
            LIMIT :limit;
        """)

        result = await self.session.execute(
            query_stmt,
            {
                "vector": str(query_vector),
                "threshold": similarity_threshold,
                "limit": top_k
            }
        )

        rows = result.fetchall()
        return [
            {
                "episode": r.episode_title,
                "guest": r.guest_name,
                "text": r.chunk_text,
                "timestamp": r.timestamp_ref,
                "score": float(r.similarity_score)
            }
            for r in rows
        ]
```

### 6.3 Ship 30 for 30 Skill Engine (`backend/app/skills/ship30_writer.py`)
```python
from typing import List, Dict, Any

SHIP_30_PROMPT_TEMPLATE = """You are an expert ghostwriter trained in the Ship 30 for 30 methodology.
Your task is to transform the provided source transcripts and context into a high-impact, actionable essay.

### Structural Requirements:
1. Target Word Count: Approximately 1,250 words.
2. The Hook (First 2-3 lines): Highlight a counterintuitive product/growth truth or urgent operational tension.
3. Formatting:
   - High skimmability using short paragraphs (1 to 3 sentences maximum).
   - Clear Markdown headers (H2 and H3).
   - Bold anchor words at the beginning of bullet points.
4. Grounded Substance:
   - Draw strictly upon the insights shared by guests in the context.
   - Attribute specific strategies to the corresponding guest/episode.
5. Actionable Conclusion: End with a step-by-step checklist or implementation framework.

Context Material:
{context_data}

User Request:
{user_query}
"""

def build_ship30_prompt(user_query: str, retrieved_chunks: List[Dict[str, Any]]) -> str:
    formatted_context = "\n\n".join([
        f"--- Episode: {c['episode']} (Guest: {c['guest']}) ---\n{c['text']}"
        for c in retrieved_chunks
    ])
    return SHIP_30_PROMPT_TEMPLATE.format(
        context_data=formatted_context,
        user_query=user_query
    )
```

### 6.4 Streaming Chat Route (`backend/app/api/chat.py`)
```python
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import json

from app.rag.retriever import TranscriptRetriever
from app.rag.embeddings import get_embedding
from app.providers.ollama_provider import OllamaProvider
from app.providers.cloud_provider import ClaudeProvider
from app.skills.ship30_writer import build_ship30_prompt
from app.database import get_db
from app.config import get_settings

router = APIRouter(prefix="/api/chat", tags=["Chat"])

class ChatRequest(BaseModel):
    session_id: str
    message: str
    mode: Optional[str] = "default"  # "default" | "ship30"
    provider: Optional[str] = "ollama"  # "ollama" | "claude"

@router.post("")
async def stream_chat(req: ChatRequest, db=Depends(get_db)):
    settings = get_settings()
    retriever = TranscriptRetriever(db, get_embedding)
    
    # 1. Retrieve knowledge
    chunks = await retriever.retrieve_relevant_chunks(req.message, top_k=5, similarity_threshold=0.65)
    
    # 2. Select Provider
    if req.provider == "claude" and settings.ANTHROPIC_API_KEY:
        llm = ClaudeProvider(api_key=settings.ANTHROPIC_API_KEY)
    else:
        llm = OllamaProvider(base_url=settings.OLLAMA_BASE_URL, model=settings.OLLAMA_MODEL)

    async def event_generator():
        # Yield retrieval metadata
        yield f"data: {json.dumps({'type': 'status', 'content': 'Analyzing transcripts...'})}\n\n"
        yield f"data: {json.dumps({'type': 'sources', 'data': chunks})}\n\n"

        if not chunks:
            refusal = "I do not have sufficient information in Lenny's podcast archive to answer this."
            yield f"data: {json.dumps({'type': 'token', 'content': refusal})}\n\n"
            yield "data: [DONE]\n\n"
            return

        if req.mode == "ship30":
            system_prompt = "You are an elite ghostwriter following the Ship 30 for 30 framework."
            prompt = build_ship30_prompt(req.message, chunks)
            messages = [{"role": "user", "content": prompt}]
        else:
            system_prompt = (
                "You are the Lenny Growth Assistant. Ground every answer strictly in the transcript context. "
                "Cite sources using [Episode: Guest Name, Timestamp/Topic]. If an artifact is requested, wrap it in "
                "<artifact type='markdown|html' title='...'>...</artifact> tags."
            )
            messages = [{"role": "user", "content": f"Context:\n{chunks}\n\nQuestion: {req.message}"}]

        async for token in llm.generate_response(messages, system_prompt):
            yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

        yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
```

### 6.5 Sandboxed Artifact Viewer (`frontend/src/components/Artifact/SandboxedIframe.tsx`)
```tsx
import React, { useMemo } from 'react';
import DOMPurify from 'dompurify';

interface SandboxedIframeProps {
  content: string;
  title: string;
}

export const SandboxedIframe: React.FC<SandboxedIframeProps> = ({ content, title }) => {
  // Sanitize markup prior to injecting into iframe srcDoc
  const cleanHtml = useMemo(() => {
    return DOMPurify.sanitize(content, {
      WHOLE_DOCUMENT: true,
      ADD_TAGS: ['style', 'link', 'script'],
      ADD_ATTR: ['target']
    });
  }, [content]);

  return (
    <div className="flex flex-col h-full border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-700 tracking-wide uppercase">
          Artifact: {title}
        </span>
        <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
          Sandboxed Preview
        </span>
      </div>
      <iframe
        title={title}
        srcDoc={cleanHtml}
        // Strict security isolation: allow scripts to run for interactivity,
        // but omit allow-same-origin to prevent access to parent cookies, local storage, and DOM.
        sandbox="allow-scripts"
        className="w-full h-full border-none"
      />
    </div>
  );
};
```

### 6.6 Docker Compose Deployment (`docker-compose.yml`)
```yaml
version: '3.8'

services:
  db:
    image: pgvector/pgvector:pg16
    container_name: lenny_postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password123
      POSTGRES_DB: lenny_assistant
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: lenny_backend
    environment:
      DATABASE_URL: postgresql+asyncpg://postgres:password123@db:5432/lenny_assistant
      OLLAMA_BASE_URL: http://host.docker.internal:11434
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:-}
      DEFAULT_PROVIDER: ollama
    ports:
      - "8000:8000"
    depends_on:
      db:
        condition: service_healthy
    extra_hosts:
      - "host.docker.internal:host-gateway"

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: lenny_frontend
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8000
    depends_on:
      - backend

volumes:
  postgres_data:
```

---

## 7. Working Verification & Test Strategy

### 7.1 Automated Unit & Integration Tests (`backend/tests/`)
* **Vector Retrieval Verification (`test_retrieval.py`):**
  * Assert cosine similarity search returns top matches sorted by descending score.
  * Assert out-of-domain query (e.g., *"How do I bake sourdough bread?"*) results in empty chunk list when threshold $> 0.65$.
* **Provider Switching & Fallback (`test_providers.py`):**
  * Test `OllamaProvider` connects and handles streaming tokens asynchronously.
  * Test graceful degradation to error message when local Ollama daemon is offline.
  * Test `ClaudeProvider` initiates when API key is present.
* **API Endpoints & Contracts (`test_api.py`):**
  * `POST /api/sessions`: Verify creation of session with UUID.
  * `GET /api/sessions/{session_id}`: Verify retrieving session messages.
  * `POST /api/chat`: Validate SSE event protocol structure (`status`, `sources`, `token`, `[DONE]`).
  * `GET /api/health`: Verify returns 200 with DB status `"healthy"`.

### 7.2 Manual Verification & Acceptance Matrix
1. **Grounded QA Verification:**
   * Query: *"What did Brian Chesky say about scaling Airbnb unscalably?"*
   * Expected: Specific quotes attributed to Brian Chesky with episode title and timestamp reference.
2. **Rejection Boundary Test:**
   * Query: *"What is the optimal fuel mixture for a Falcon 9 rocket?"*
   * Expected Output: *"I do not have sufficient information in Lenny's podcast archive to answer this."*
3. **Ship 30 for 30 Transformation:**
   * Query: Select Ship 30 for 30 mode and query *"How to design a viral loop"*.
   * Expected Output: ~1,250 words, hook in lines 1–3, short paragraphs, bold anchors on bullet points, tactical implementation framework.
4. **Artifact Isolation Test:**
   * Query: *"Create an interactive HTML calculator for viral coefficient K."*
   * Expected: An interactive calculator renders in the right-hand Artifact Drawer inside `<iframe sandbox="allow-scripts">`. Verify JavaScript functions operate, but attempt to read `window.parent.localStorage` throws a security exception.
5. **Model Toggle Test:**
   * Switch dropdown between Ollama and Claude in the UI. Confirm request headers propagate and response streams from the chosen engine.

---

## 8. Operational Handoff & Deployment Deliverables

1. **Repository Structure:** Clean Git history, modular package boundaries, zero hardcoded credentials.
2. **Documentation Suite:**
   * `README.md`: Quickstart guide, prerequisites, architecture summary, and troubleshooting commands.
   * `docs/PRD.md`: Complete Product Requirements Document with persona and metrics.
   * `docs/architecture.md`: Full technical architecture, vector schema, and API contracts.
   * `docs/design.md`: UX design rationale, dual-pane layout specs, and security boundaries.
3. **Agent Logs & Transcripts (`agent_transcripts/`):**
   * Transparent record of AI coding agent interactions, debugging pgvector indexing, and prompt tuning.
4. **Product Walkthrough Outline (2–3 minutes):**
   * *0:00–0:30:* Problem context and persona (Growth PM unlocking Lenny's Podcast).
   * *0:30–1:15:* Live demo of Grounded QA with local Ollama (`llama3.2:3b`), showing source citations.
   * *1:15–1:45:* Ship 30 for 30 skill execution and Side-by-Side Artifact Viewer rendering an interactive tool.
   * *1:45–2:15:* Deep dive into technical trade-off: Local Ollama latency/reasoning vs. Cloud API autonomy, and iframe sandbox security.
   * *2:15–2:30:* Handoff readiness and single-command deployment wrap-up.
