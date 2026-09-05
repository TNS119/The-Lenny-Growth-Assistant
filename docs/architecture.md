# ARCHITECTURE SPECIFICATION: THE LENNY GROWTH ASSISTANT

**Document Version:** 1.0.0  
**Status:** Approved for Implementation  
**System Target:** Enterprise RAG Platform with Dual-Model Routing & Sandboxed Artifact Rendering  
**File Location:** `docs/architecture.md`

---

## 1. Architectural Overview & System Topology

The Lenny Growth Assistant is a containerized, full-stack, retrieval-augmented generation (RAG) system architected to surface operational product and growth frameworks from *Lenny’s Podcast* transcripts. The system features a decoupled, multi-tier topology designed for low-latency streaming, strict source attribution, resilient model routing, and secure client-side artifact execution.

### 1.1 High-Level Architecture Diagram

```
                              +-------------------------------------------------------------+
                              |                      CLIENT BROWSER                         |
                              |  +------------------------------+  +---------------------+  |
                              |  |       Chat Interface         |  |   Artifact Drawer   |  |
                              |  |  - Model/Mode Selector       |  |  - React-Markdown   |  |
                              |  |  - SSE Event Consumer        |  |  - Sandboxed Iframe |  |
                              |  |  - Citations Accordion       |  |    (DOMPurify +     |  |
                              |  +------------------------------+  |     allow-scripts)  |  |
                              |                 |                  +---------------------+  |
                              +-----------------|-----------------------------^-------------+
                                                | HTTP / SSE                  |
                                                v                             |
+-----------------------------------------------------------------------------|-------------+
|                                    FASTAPI APPLICATION (ASGI)               |             |
|                                                                             |             |
|  +--------------------------------------------------------------------------+----------+  |
|  |                              API Gateway & Routing Layer                            |  |
|  |  - POST /api/sessions          - GET /api/sessions/{session_id}                     |  |
|  |  - POST /api/chat (SSE Stream) - GET /api/health                                    |  |
|  +-------------------+--------------------------------------+--------------------------+  |
|                      |                                      |                             |
|                      v                                      v                             |
|  +---------------------------------------+  +------------------------------------------+  |
|  |            RAG & Retrieval Subsystem  |  |           Skill & Prompt Engine          |  |
|  |  - Embedding Engine (SentenceTransf)  |  |  - Grounded QA Synthesizer               |  |
|  |  - Cosine Distance Threshold Gating   |  |  - Ship 30 for 30 Engine (1,250 words)   |  |
|  |  - Citation Metadata Formatting       |  |  - Artifact Tag Extractor (<artifact>)   |  |
|  +-------------------+-------------------+  +-------------------+----------------------+  |
|                      |                                          |                         |
|                      v                                          v                         |
|  +-------------------------------------------------------------------------------------+  |
|  |                             Unified LLM Provider Layer                              |  |
|  |  +---------------------------------------+  +------------------------------------+  |  |
|  |  | OllamaProvider                        |  | CloudProvider                      |  |  |
|  |  | - Protocol: Native HTTP streaming     |  | - Protocol: Anthropic Messages SDK |  |  |
|  |  | - Target: llama3.2:3b / llama3.1:8b   |  | - Target: claude-3-5-sonnet        |  |  |
|  |  | - Endpoint: host.docker.internal:11434|  | - Target: gpt-4o (Fallback)        |  |  |
|  |  +---------------------------------------+  +------------------------------------+  |  |
|  +-------------------------------------------------------------------------------------+  |
+------------------------------------------+------------------------------------------------+
                                           | Async Pool (SQLAlchemy 2.0 + asyncpg)
                                           v
+-------------------------------------------------------------------------------------------+
|                              POSTGRESQL 16 + PGVECTOR ENGINE                              |
|                                                                                           |
|  +-----------------------+  +-----------------------+  +-------------------------------+  |
|  | Table: sessions       |  | Table: messages       |  | Table: artifacts              |  |
|  | - UUID PK             |  | - UUID PK             |  | - UUID PK                     |  |
|  | - Title, timestamps   |  | - Role, text, sources |  | - Message FK, HTML/MD content |  |
|  +-----------------------+  +-----------------------+  +-------------------------------+  |
|                                                                                           |
|  +-------------------------------------------------------------------------------------+  |
|  | Table: transcript_chunks                                                            |  |
|  | - Text chunk (500-800 tokens)    - Episode title, guest, timestamp reference       |  |
|  | - Vector embedding (384-dim)      - HNSW Cosine Index (m=16, ef_construction=64)   |  |
|  +-------------------------------------------------------------------------------------+  |
+-------------------------------------------------------------------------------------------+
```

---

## 2. Component Boundaries & Responsibilities

### 2.1 Frontend Tier (`frontend/`)
* **Framework:** Next.js (App Router) / React 18+ with TypeScript.
* **Responsibilities:**
  * Render the dual-pane workspace: Left Pane (Chat, Sessions, Controls) and Right Pane (Collapsible Claude-style Artifact Viewer).
  * Manage real-time Server-Sent Events (SSE) streaming connections using the `useChatStream` hook.
  * Dynamically extract and parse `<artifact type="..." title="...">` XML tokens from raw assistant text streams.
  * Render Markdown artifacts using `react-markdown` and `remark-gfm` with syntax-highlighted codeblocks.
  * Securely render HTML/CSS/JS artifacts inside an isolated `<iframe>` with `sandbox="allow-scripts"` and `DOMPurify` input sanitization.
  * Provide visual indicators for model selection (`Ollama` vs. `Claude`) and execution modes (`Default Grounded QA` vs. `Ship 30 for 30`).

### 2.2 API & Application Tier (`backend/app/`)
* **Framework:** FastAPI (Python 3.11+) hosted on Uvicorn ASGI server.
* **Responsibilities:**
  * Enforce input contracts using Pydantic v2 schemas (`ChatRequest`, `SessionCreate`, `HealthResponse`).
  * Orchestrate retrieval-augmented generation pipelines through `TranscriptRetriever`.
  * Manage conversation and artifact state persistence using SQLAlchemy Async sessions and `asyncpg`.
  * Stream token deltas, citation metadata, and status events to the client over an SSE connection.
  * Provide a unified provider abstraction (`BaseLLMProvider`) to dynamically route inference between local Ollama instances and cloud models without modifying business logic.

### 2.3 Persistence & Vector Tier (`db`)
* **Engine:** PostgreSQL 16 with the `pgvector` extension enabled.
* **Responsibilities:**
  * Store transactional conversation histories, messages, and persisted artifact snapshots.
  * Maintain vector embeddings of transcript chunks ($384$ dimensions for `all-MiniLM-L6-v2` or $768$ dimensions for `nomic-embed-text`).
  * Accelerate nearest-neighbor cosine similarity search using a Hierarchical Navigable Small World (`HNSW`) vector index.

### 2.4 Model Layer (Local & Cloud)
* **Local Daemon:** Ollama running `llama3.2:3b` or `llama3.1:8b` via `http://host.docker.internal:11434`.
* **Cloud API:** Anthropic Claude Messages API (`claude-3-5-sonnet-20241022`) or OpenAI API (`gpt-4o`).

---

## 3. Database Schema & Data Contracts

```
 +--------------------+       1:N       +--------------------+       1:N       +--------------------+
 |      sessions      |----------------<|      messages      |----------------<|     artifacts      |
 +--------------------+                 +--------------------+                 +--------------------+
 | id: UUID (PK)      |                 | id: UUID (PK)      |                 | id: UUID (PK)      |
 | title: VARCHAR     |                 | session_id: FK     |                 | message_id: FK     |
 | created_at: TZ     |                 | role: VARCHAR      |                 | artifact_type: STR |
 | updated_at: TZ     |                 | content: TEXT      |                 | title: VARCHAR     |
 +--------------------+                 | sources: JSONB     |                 | content: TEXT      |
                                        | created_at: TZ     |                 | created_at: TZ     |
                                        +--------------------+                 +--------------------+

                                        +-----------------------------------------------------------+
                                        |                    transcript_chunks                      |
                                        +-----------------------------------------------------------+
                                        | id: BIGSERIAL (PK)                                        |
                                        | episode_title: VARCHAR(255)                               |
                                        | guest_name: VARCHAR(255)                                  |
                                        | publication_date: DATE                                    |
                                        | timestamp_ref: VARCHAR(100)                               |
                                        | chunk_text: TEXT                                          |
                                        | token_count: INTEGER                                      |
                                        | embedding: VECTOR(384) [HNSW: vector_cosine_ops]          |
                                        +-----------------------------------------------------------+
```

### 3.1 Relational Tables (SQLAlchemy)

#### 1. `sessions`
Represents an independent conversational session.
```sql
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL DEFAULT 'New Conversation',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 2. `messages`
Stores multi-turn dialogue with source attribution metadata.
```sql
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    sources JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_messages_session_id ON messages(session_id);
```

#### 3. `artifacts`
Persists extracted Markdown documents or HTML/JS tools generated by the assistant.
```sql
CREATE TABLE artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    artifact_type VARCHAR(50) NOT NULL CHECK (artifact_type IN ('markdown', 'html')),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_artifacts_message_id ON artifacts(message_id);
```

#### 4. `transcript_chunks`
Stores segmented podcast dialogue and high-dimensional vector representations.
```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE transcript_chunks (
    id BIGSERIAL PRIMARY KEY,
    episode_title VARCHAR(255) NOT NULL,
    guest_name VARCHAR(255) NOT NULL,
    publication_date DATE NULL,
    timestamp_ref VARCHAR(100) NOT NULL,
    chunk_text TEXT NOT NULL,
    token_count INTEGER NOT NULL,
    embedding VECTOR(384) NOT NULL
);
```

### 3.2 Pgvector HNSW Index Specification
Cosine similarity search speed is paramount for low-latency agent execution. The index uses HNSW on cosine operator space:
```sql
CREATE INDEX idx_transcript_chunks_hnsw_cosine
ON transcript_chunks 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```
* **$M = 16$:** Maximum number of bidirectional links per vector node, optimizing recall-to-memory footprint.
* **$ef\_construction = 64$:** Size of dynamic candidate list during graph building, balancing ingestion throughput with high-accuracy query routing.

---

## 4. Ingestion & Retrieval Pipeline Specification

```
Raw Episode Files (.md / .txt)
           |
           v
[Metadata Parser] ---> Extracts: Episode Title, Guest Name, Date, Timestamps
           |
           v
[Recursive Character Text Splitter] ---> Chunk Size: 500-800 tokens, Overlap: 100 tokens
           |
           v
[Embedding Generator] ---> Model: all-MiniLM-L6-v2 (Output: 384-dimensional dense float vector)
           |
           v
[Batch Upsert] ---> PostgreSQL transcript_chunks (Batches of 100 with HNSW indexing)
```

### 4.1 Ingestion Specifications (`backend/scripts/ingest.py`)
1. **Source Acquisition:** Transcripts are pulled from the public Lenny's Podcast repository into `backend/data/transcripts/`.
2. **Text Segmentation:**
   * Method: Recursive character splitting on boundaries `["\n\n## ", "\n\n", "\n", ". ", " "]`.
   * Target Chunk Size: $500\text{--}800$ tokens ($\approx 2,000\text{--}3,200$ characters).
   * Chunk Overlap: $100$ tokens ($\approx 400$ characters) to preserve contextual cohesion across dialogue boundaries.
3. **Embedding Generation:**
   * Default Model: `sentence-transformers/all-MiniLM-L6-v2`.
   * Normalized vectors inserted directly into `embedding VECTOR(384)`.

### 4.2 Retrieval Query & Similarity Threshold Logic
Retriever executes an asynchronous cosine similarity query using the pgvector distance operator `<=>`:
$$\text{Cosine Similarity} = 1 - (\text{embedding} \Leftrightarrow \vec{v}_{\text{query}})$$

```python
# Raw SQL executed via SQLAlchemy asyncpg driver
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
```
* **Parameters:**
  * `:threshold = 0.65` (Hard floor; chunks scoring below $0.65$ are discarded).
  * `:limit = 5` (Top $K$ most relevant contexts).
* **Refusal Circuit Breaker:**
  If the result set is empty (all chunks $< 0.65$), the RAG pipeline bypasses LLM synthesis and immediately returns the standard fallback message:
  `"I do not have sufficient information in Lenny's podcast archive to answer this."`

---

## 5. Multi-Provider LLM & Dynamic Routing Layer

```
                        +---------------------------+
                        |      BaseLLMProvider      |
                        |      (Abstract Class)     |
                        +-------------+-------------+
                                      |
                     +----------------+----------------+
                     |                                 |
                     v                                 v
        +-------------------------+       +-------------------------+
        |     OllamaProvider      |       |     ClaudeProvider      |
        +-------------------------+       +-------------------------+
        | - Endpoint: /api/chat   |       | - Anthropic Messages    |
        | - Stream: ndjson lines  |       | - Stream: SSE chunks    |
        | - Model: llama3.2:3b    |       | - Model: claude-3-5-... |
        +-------------------------+       +-------------------------+
```

### 5.1 Provider Interface Contract
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
        """Asynchronously streams generated tokens from the provider."""
        pass
```

### 5.2 Dynamic Provider Factory & Routing Rules
1. **Selection Precedence:**
   * **Explicit Request Parameter:** `provider="claude"` or `provider="ollama"` passed in `POST /api/chat`.
   * **HTTP Header:** `X-LLM-Provider: claude` or `X-LLM-Provider: ollama`.
   * **Environment Variable:** `DEFAULT_LLM_PROVIDER=ollama` (default).
2. **Fallback & Health Verification:**
   * If `provider="claude"` is requested but `ANTHROPIC_API_KEY` is unset or invalid, the factory automatically falls back to `OllamaProvider` and emits a status warning event over SSE.
   * If `OllamaProvider` fails to establish a connection (`httpx.ConnectError`), the stream returns an actionable diagnostic message prompting the user to verify `ollama serve`.

---

## 6. Prompt Engineering & Skill Engines

### 6.1 Grounded QA Agent Prompt
Enforces precise attribution and anti-hallucination guardrails:
```
System Prompt:
You are "The Lenny Growth Assistant", an elite product and growth advisor. 
You answer questions exclusively using insights from Lenny's Podcast transcripts.

Operational Rules:
1. Strict Grounding: Base every assertion strictly on the provided Context Material.
2. Mandatory Attribution: Attribute all tactics, metrics, and insights using the format: 
   [Episode: <Guest Name>, <Timestamp/Section>].
3. Gap Acknowledgment: If the context material is insufficient to answer the query, reply with: 
   "I do not have sufficient information in Lenny's podcast archive to answer this."
4. Artifact Emission: When producing reusable documents, spreadsheets, or interactive tools, wrap them in:
   <artifact type="markdown|html" title="<Descriptive Title>">
   <content>
   </artifact>
```

### 6.2 "Ship 30 for 30" Skill Engine
When `mode="ship30"` is selected, the query is routed through a dedicated structural prompt compiler enforcing the writing heuristics of the *Ship 30 for 30* framework:

```python
# backend/app/skills/ship30_writer.py
SHIP_30_PROMPT_TEMPLATE = """You are an expert ghostwriter trained in the Ship 30 for 30 methodology.
Your task is to transform the provided podcast transcript context into a high-retention, 1,250-word essay.

Strict Framework Heuristics:
1. Word Count: Approximately 1,250 words.
2. The Hook (Lines 1-3): Open with an immediate curiosity gap, counterintuitive growth truth, or operational tension.
3. Rhythm & Formatting:
   - Ultra-skimmable: Short paragraphs (1 to 3 sentences maximum).
   - Clear Markdown section headers (H2 and H3).
   - Bold anchor words at the beginning of bullet points (e.g., "**Velocity:** Shipping weekly...").
   - Single-sentence impact lines separated by whitespace.
4. Grounded Substance:
   - Attribute core lessons directly to the guests in the context [Episode: Guest Name, Topic].
   - Provide concrete examples over abstract philosophy.
5. Actionable Conclusion:
   - End with a tactical step-by-step checklist or implementation framework.

Context Material:
{context_data}

User Topic / Request:
{user_query}
"""
```

---

## 7. API Specifications & Streaming Protocol

### 7.1 REST Endpoints

| Endpoint | Method | Input Schema | Response Schema | Description |
| :--- | :--- | :--- | :--- | :--- |
| `/api/sessions` | `POST` | `{ "title": Optional[str] }` | `{ "id": UUID, "title": str, "created_at": str }` | Create a new conversational session. |
| `/api/sessions` | `GET` | None | `List[SessionSummary]` | List recent sessions sorted by `updated_at DESC`. |
| `/api/sessions/{id}` | `GET` | `id: UUID` | `SessionDetail` (Includes messages & artifacts) | Fetch message history and persisted artifacts. |
| `/api/chat` | `POST` | `ChatRequest` | `text/event-stream` (SSE) | Stream assistant tokens, citations, and artifacts. |
| `/api/health` | `GET` | None | `HealthResponse` | Probe DB, vector index count, and Ollama status. |

### 7.2 SSE Event Stream Data Contract (`POST /api/chat`)
The streaming response uses the `text/event-stream` format with JSON-encoded payloads:

```
event: status
data: {"type": "status", "content": "Retrieving transcript chunks..."}

event: sources
data: {"type": "sources", "data": [{"episode": "Brian Chesky on Airbnb", "guest": "Brian Chesky", "timestamp": "00:14:10", "score": 0.88, "text": "Do things that don't scale..."}]}

event: token
data: {"type": "token", "content": "According"}

event: token
data: {"type": "token", "content": " to"}

event: artifact_open
data: {"type": "artifact_open", "artifact_type": "html", "title": "Viral Loop Simulator"}

event: artifact_chunk
data: {"type": "artifact_chunk", "content": "<!DOCTYPE html><html><head><style>body { font-family: sans-serif; }</style></head><body>..."}

event: artifact_close
data: {"type": "artifact_close"}

event: done
data: [DONE]
```

---

## 8. Frontend Architecture & Sandboxed Artifact Viewer

```
+-----------------------------------------------------------------------------------------------+
|                                      NEXT.JS / REACT APP                                      |
|                                                                                               |
|  +----------------------------------------------------+  +---------------------------------+  |
|  |                 useChatStream Hook                 |  |       Artifact State Store      |  |
|  |  - Reads SSE buffer via ReadableStream             |  |  - activeArtifact: Artifact     |  |
|  |  - Emits: tokens, sources, status                  |  |  - isDrawerOpen: boolean        |  |
|  |  - Regex Parser: /<artifact[\s\S]*?<\/artifact>/  |  |  - viewMode: 'preview' | 'code' |  |
|  +-------------------------+--------------------------+  +----------------+----------------+  |
|                            |                                              |                   |
|                            v                                              v                   |
|  +----------------------------------------------------+  +---------------------------------+  |
|  |                    ChatPane                        |  |         ArtifactViewer          |  |
|  |  - MessageList (MessageItem with Citations)        |  |  - Header with Copy & Close     |  |
|  |  - PromptInput with Model & Mode dropdowns         |  |  - Tab 1: Rendered Output       |  |
|  |  - Citation Pills & Source Modal                   |  |  - Tab 2: Raw Code Inspection   |  |
|  +----------------------------------------------------+  +----------------+----------------+  |
|                                                                           |                   |
|                                                                           v                   |
|                                                          +---------------------------------+  |
|                                                          |        SandboxedIframe          |  |
|                                                          |  - DOMPurify.sanitize(html)     |  |
|                                                          |  - sandbox="allow-scripts"      |  |
|                                                          |  - (NO allow-same-origin)       |  |
|                                                          +---------------------------------+  |
+-----------------------------------------------------------------------------------------------+
```

### 8.1 Claude-Style Artifact Parsing Heuristic
As tokens stream from the backend, the client parser detects artifact openings:
1. When `<artifact type="html|markdown" title="...">` is encountered, token streaming to the chat bubble pauses or displays an interactive **"Artifact Generated: [Title]"** pill.
2. Enclosed tokens are routed to the Artifact State Store and streamed live into the open Artifact Drawer.
3. When `</artifact>` is received, the drawer finalizes the artifact and triggers persistence.

### 8.2 Security & Sandbox Isolation Architecture
To protect users against arbitrary code execution, script injection, and CSRF/data exfiltration, HTML artifacts are subject to a **Two-Tier Isolation Boundary**:

1. **Tier 1: HTML Sanitization (`DOMPurify`):**
   * Pre-processes markup before mounting:
   ```typescript
   const cleanHtml = DOMPurify.sanitize(rawHtml, {
     WHOLE_DOCUMENT: true,
     ADD_TAGS: ['style', 'link', 'script'],
     ADD_ATTR: ['target', 'id', 'class', 'style', 'onclick']
   });
   ```
2. **Tier 2: Iframe Sandbox Hardening (`SandboxedIframe.tsx`):**
   * Mounted with strict isolation attributes:
   ```html
   <iframe
     title="Artifact Preview"
     srcdoc={cleanHtml}
     sandbox="allow-scripts"
     className="w-full h-full border-0"
   />
   ```
   * **Security Guarantee:**
     * `allow-scripts`: Permits JavaScript execution so interactive calculators, charts, and formulas function correctly.
     * **OMISSION of `allow-same-origin`**: **Critical.** Forces the iframe into a unique origin (`null`). This prevents injected JavaScript from accessing:
       * Parent `window.localStorage` and `sessionStorage`.
       * Parent authentication cookies (`document.cookie`).
       * Parent DOM manipulation (`window.parent.document`).
       * Origin-scoped HTTP requests to `/api/*` endpoints.

---

## 9. Containerization & Deployment Topology

The entire system is orchestratable via a single command: `docker-compose up --build`.

```
                         Docker Compose Network ("lenny_network")
+---------------------------------------------------------------------------------------+
|                                                                                       |
|   +-----------------------+     +-----------------------+     +--------------------+  |
|   |       frontend        |     |        backend        |     |         db         |  |
|   |  - Next.js / Nginx    |---->|  - FastAPI (Python)   |---->|  - Postgres 16     |  |
|   |  - Port 3000:3000     |     |  - Port 8000:8000     |     |  - pgvector        |  |
|   +-----------------------+     +-----------+-----------+     |  - Port 5432:5432  |  |
|                                             |                 +--------------------+  |
+---------------------------------------------|-----------------------------------------+
                                              | host-gateway
                                              v
                              +-------------------------------+
                              |    Host Machine (Local OS)    |
                              |  - Ollama Daemon (Port 11434) |
                              |  - llama3.2:3b / llama3.1:8b  |
                              +-------------------------------+
```

### 9.1 Network Boundaries & Service Definitions
1. **`db` (PostgreSQL 16 + pgvector):**
   * Image: `pgvector/pgvector:pg16`
   * Internal Port: `5432`, exposed to host for local debugging.
   * Persistent Volume: `postgres_data:/var/lib/postgresql/data`.
   * Healthcheck: `CMD-SHELL pg_isready -U postgres`.
2. **`backend` (FastAPI):**
   * Context: `./backend`
   * Dependencies: Waits for `db` service to reach `service_healthy` state.
   * Host Routing: Uses `extra_hosts: ["host.docker.internal:host-gateway"]` to enable Linux and Windows containers to reach the host's native Ollama instance on port 11434.
3. **`frontend` (Next.js):**
   * Context: `./frontend`
   * Exposes port `3000`. Connects to backend via `NEXT_PUBLIC_API_URL=http://localhost:8000`.

---

## 10. Resilience, Observability & Error Handling

### 10.1 Failure Modes & Recovery Matrix

| Failure Mode | Detection Mechanism | System Behavior & Fallback |
| :--- | :--- | :--- |
| **Ollama Daemon Offline** | `httpx.ConnectError` during model dispatch | Catches exception; emits SSE status error: `"Local Ollama offline. Please verify 'ollama serve' is running."` |
| **Missing Cloud API Key** | `ANTHROPIC_API_KEY` validation on startup/dispatch | Degrades to `OllamaProvider`; notifies client via SSE status event. |
| **Out-of-Domain Retrieval** | All chunks score $< 0.65$ similarity | Halts LLM call; returns deterministic string: `"I do not have sufficient information in Lenny's podcast archive to answer this."` |
| **Database Disconnection** | `asyncpg.CannotConnectNowError` | Health endpoint `/api/health` reports `503 Service Unavailable`; API endpoints return HTTP 500 with structured JSON error. |
| **Malformed Artifact Output** | Unclosed `<artifact>` tags | Client regex stream handler falls back to rendering raw markdown in chat bubble without breaking drawer state. |

### 10.2 Structured Logging Contract
All backend modules emit structured JSON logs with correlation context:
```json
{
  "timestamp": "2026-09-05T08:53:42Z",
  "level": "INFO",
  "module": "app.rag.retriever",
  "session_id": "8a329d91-4cf1-4562-b91c-b5f7e31d4e08",
  "action": "similarity_search",
  "query_tokens": 14,
  "chunks_retrieved": 5,
  "top_score": 0.842,
  "latency_ms": 42.1
}
```
