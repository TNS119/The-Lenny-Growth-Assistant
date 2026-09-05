# ARCHITECTURE SPECIFICATION: THE LENNY GROWTH ASSISTANT

**Document Version:** 1.1.0  
**Status:** Approved for Implementation  
**System Target:** Enterprise RAG Platform with Multi-Model Routing & Sandboxed Artifact Execution  
**File Location:** `docs/architecture.md`  

---

## 1. Architectural Overview & System Topology

The Lenny Growth Assistant is a containerized, full-stack retrieval-augmented generation (RAG) web application architected to surface operational product and growth frameworks from *Lenny’s Podcast* transcripts (~2.5M words).

```mermaid
graph TD
    Client[Client Browser - Next.js 14]
    
    subgraph UI_Layer [Frontend Workspace Tier]
        Sidebar[Full-Height Sidebar & Sessions]
        ChatPane[Operate Pane - Streaming & Citations]
        ModelSelector[Embedded DropUp Model Switcher]
        ArtifactDrawer[Sandboxed Artifact Viewer - DOMPurify + Iframe]
    end
    
    subgraph API_Layer [FastAPI Backend Service - Port 8000]
        Router[FastAPI ASGI Router]
        SSE[SSE Streaming Pipeline - text/event-stream]
        Retriever[TranscriptRetriever - pgvector HNSW / Fallback]
        PromptEngine[Prompt & Skill Compiler - /ship 30 + Grounding]
        ProviderFactory[Dynamic Provider Factory]
    end
    
    subgraph Model_Layer [Multi-LLM Inference Tier]
        Ollama[Local Ollama - llama3.2:3b Free]
        Groq[Groq API - llama-3.3-70b Free]
        Gemini[Google Gemini 2.0 Flash Free]
        Claude[Anthropic Claude 3.5 Sonnet]
        OpenAI[OpenAI GPT-4o]
    end
    
    subgraph Storage_Layer [Persistence Tier]
        PG[(PostgreSQL 16 + pgvector 384-dim)]
        MemFallback[(In-Memory Session & JSON Transcripts Fallback)]
    end

    Client --> Sidebar
    Client --> ChatPane
    ChatPane --> ModelSelector
    ChatPane --> ArtifactDrawer
    
    ChatPane -->|HTTP / SSE Stream| Router
    Router --> SSE
    SSE --> Retriever
    Retriever --> PG
    Retriever -.->|Offline Fallback| MemFallback
    
    SSE --> PromptEngine
    PromptEngine --> ProviderFactory
    ProviderFactory --> Ollama
    ProviderFactory --> Groq
    ProviderFactory --> Gemini
    ProviderFactory --> Claude
    ProviderFactory --> OpenAI
    
    ProviderFactory -->|Yield Tokens & XML Tags| SSE
    SSE -->|Stream Status, Sources, Tokens, Artifacts| ChatPane
    ChatPane -->|Auto-Expand & Mount| ArtifactDrawer
```

---

## 2. Component Boundaries & Responsibilities

### 2.1 Frontend Workspace (`frontend/`)
- **Framework:** Next.js 14 (App Router), React 18, TypeScript 5, Tailwind CSS 3.4.
- **Key Modules:**
  - `src/app/page.tsx`: Full-height layout coordinator (`h-screen w-screen`), managing sidebar toggling, top header transitions, and dual workspace splits.
  - `src/components/Chat/ChatPane.tsx`: Real-time streaming conversation container, dynamic initial-query titling, and `/ship` slash command trigger.
  - `src/components/Chat/ModelSelector.tsx`: DropUp model switcher with masked API key configuration modal (`gsk_••••••••••••3x9A`).
  - `src/components/Artifact/ArtifactViewer.tsx` & `SandboxedIframe.tsx`: Hardened iframe sandbox (`sandbox="allow-scripts"` without `allow-same-origin`) sanitized via `DOMPurify`.

### 2.2 Backend Application Tier (`backend/app/`)
- **Framework:** FastAPI (Python 3.10+), Uvicorn ASGI server, Pydantic v2.
- **Key Modules:**
  - `app/api/chat.py`: SSE streaming endpoint (`/api/chat`), refusal circuit-breaker gating ($<0.65$ cosine similarity), and initial-query session namer.
  - `app/api/sessions.py`: Session CRUD with PostgreSQL and resilient in-memory fallbacks (`IN_MEMORY_SESSIONS`).
  - `app/api/providers.py`: Live provider status probes and masked API key validators.
  - `app/rag/retriever.py` & `embeddings.py`: SentenceTransformers (`all-MiniLM-L6-v2`, 384-dim) vector retrieval and local cosine similarity fallback.
  - `app/skills/ship30_writer.py` & `artifact_generator.py`: Prompt builder (~1,250-word essay) and multi-stage XML artifact cleaners.

---

## 3. Database Schema & Data Contracts

```mermaid
erDiagram
    SESSIONS ||--o{ MESSAGES : contains
    MESSAGES ||--o{ ARTIFACTS : generates
    TRANSCRIPT_CHUNKS {
        uuid id PK
        string episode_title
        string guest_name
        string timestamp_ref
        string chunk_text
        vector_384 embedding
    }
    SESSIONS {
        uuid id PK
        string title
        datetime created_at
        datetime updated_at
    }
    MESSAGES {
        uuid id PK
        uuid session_id FK
        string role
        text content
        jsonb sources
        datetime created_at
    }
    ARTIFACTS {
        uuid id PK
        uuid message_id FK
        string artifact_type
        string title
        text content
        datetime created_at
    }
```

---

## 4. Ingestion & Retrieval Flow

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Frontend as Next.js Client
    participant FastAPI as FastAPI Backend
    participant Retriever as TranscriptRetriever
    participant PG as PostgreSQL / pgvector
    participant LLM as Active LLM Provider

    User->>Frontend: Submit Query (e.g. "/ship Elena Verna loops")
    Frontend->>FastAPI: POST /api/chat (SSE Stream)
    FastAPI->>Retriever: Query vector embedding (all-MiniLM-L6-v2)
    Retriever->>PG: Cosine Similarity Search (HNSW Index)
    PG-->>Retriever: Top matching transcript chunks + scores
    
    alt Cosine Similarity < 0.65
        Retriever-->>FastAPI: Refusal trigger
        FastAPI-->>Frontend: Stream Refusal message & [DONE]
    else Cosine Similarity >= 0.65
        Retriever-->>FastAPI: Return relevant chunks with timestamps
        FastAPI-->>Frontend: SSE event: "sources" (Citation Pills)
        FastAPI->>LLM: Stream prompt with context chunks
        loop Token Streaming
            LLM-->>FastAPI: Yield token delta
            FastAPI-->>Frontend: SSE event: "token"
        end
        alt Artifact Tag Detected (<artifact>)
            FastAPI-->>Frontend: SSE event: "artifact"
            Frontend->>Frontend: Auto-Open Artifact Drawer & Mount Sandbox
        end
        FastAPI-->>Frontend: SSE event: "[DONE]"
    end
```

---

## 5. Security & Isolation Architecture

1. **Two-Tier Iframe Sandbox:** All HTML/JS tools execute in `SandboxedIframe.tsx` using `sandbox="allow-scripts"` and strictly **omitting** `allow-same-origin`. This forces the iframe into a unique origin (`null`), blocking access to parent `document.cookie`, `localStorage`, and DOM trees.
2. **DOMPurify Sanitization:** HTML strings are cleansed of malicious script injections before mounting.
3. **API Key Safety:** Credentials in the frontend UI are masked (`gsk_••••••••••••3x9A`), sent via volatile session headers (`X-LLM-Key`), and never logged or persisted in plain text.
