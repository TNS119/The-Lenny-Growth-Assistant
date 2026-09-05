# 🎙️ The Lenny Growth Assistant

An enterprise-grade, full-stack retrieval-augmented generation (RAG) web application that unlocks operational product and growth frameworks from **Lenny’s Podcast** transcripts. Features a dedicated **Ship 30 for 30 Content Engine**, a **Claude-style Sandboxed Artifact Viewer**, and a **Dual Model Layer** supporting both local Ollama and cloud providers.

---

## 📑 Table of Contents
1. [Core Features](#-core-features)
2. [System Architecture](#-system-architecture)
3. [Prerequisites](#-prerequisites)
4. [Quick Start (Single-Command Docker)](#-quick-start-single-command-docker)
5. [Local Standalone Setup (Without Docker)](#-local-standalone-setup-without-docker)
6. [Ingestion & Vector Indexing](#-ingestion--vector-indexing)
7. [Model Configuration & Toggling](#-model-configuration--toggling)
8. [Automated Testing](#-automated-testing)
9. [Video Demo Walkthrough Guide (2–3 Minutes)](#-video-demo-walkthrough-guide-23-minutes)
10. [Documentation & References](#-documentation--references)

---

## 🚀 Core Features

* **Grounded Answers:** Answers derived strictly from Lenny's Podcast transcripts with explicit citations: `[Episode: Guest Name, Timestamp/Topic]`.
* **Out-of-Domain Refusal:** Deterministic circuit-breaker returning *"I do not have sufficient information in Lenny's podcast archive to answer this"* when similarity falls below `0.65`.
* **Ship 30 for 30 Content Engine:** Transforms tactical answers into a high-retention, ~1,250-word essay with curiosity hooks, short paragraphs (1–3 sentences), bold anchors on bullets, and an actionable checklist conclusion.
* **Claude-Style Artifact Viewer:** Dual-pane split screen with an auto-opening right drawer. Renders Markdown or executes interactive HTML/JS tools inside a hardened container (`sandbox="allow-scripts"`, omitting `allow-same-origin`, sanitized via `DOMPurify`).
* **Dual Model Layer with In-Between Toggle:** Interactive UI header dropdown allowing live switching between:
  * **Local Ollama (Mandatory Demo - 100% Free):** `llama3.2:3b` / `llama3.1:8b`
  * **Cloud Anthropic:** `claude-3-5-sonnet-20241022`
  * **Cloud OpenAI:** `gpt-4o`
  * **Free Cloud Groq:** `llama-3.3-70b-versatile`
  * **Free Cloud Gemini:** `gemini-2.0-flash`
* **Enterprise Persistence:** PostgreSQL 16 + `pgvector` HNSW index, preserving conversation threads, source citations, and generated artifacts.

---

## 🏛️ System Architecture

```
+-----------------------------------------------------------------------------------------------+
|                                      CLIENT BROWSER                                           |
|  +---------------------------------------------------+  +----------------------------------+  |
|  |           Left Pane (Operate Mode)                |  |    Right Drawer (Read/Exp Mode)  |  |
|  |  - Model Toggle (Ollama, Claude, OpenAI, Groq)    |  |  - React-Markdown (GFM)          |  |
|  |  - Mode Switch (Grounded QA vs Ship 30 for 30)     |  |  - Sandboxed Iframe (HTML/JS)    |  |
|  |  - Streaming Bubbles & Clickable Citation Pills   |  |    (DOMPurify + allow-scripts)   |  |
|  +---------------------------------------------------+  +----------------------------------+  |
+-----------------------------------------------------------------------------------------------+
                                               │ HTTP / SSE Stream
                                               ▼
+-----------------------------------------------------------------------------------------------+
|                                      FASTAPI BACKEND                                          |
|  - API Gateway: POST /api/chat, GET /api/sessions, GET /api/health                            |
|  - RAG Retriever: pgvector HNSW cosine search (threshold >= 0.65)                             |
|  - Unified Provider Layer: OllamaProvider, ClaudeProvider, OpenAIProvider                     |
|  - Skill Engine: Ship 30 for 30 prompt compiler, XML <artifact> parser                        |
+-----------------------------------------------------------------------------------------------+
                                               │ Async Engine (SQLAlchemy + asyncpg)
                                               ▼
+-----------------------------------------------------------------------------------------------+
|                              POSTGRESQL 16 + PGVECTOR ENGINE                                  |
|  - sessions, messages (with JSONB sources), artifacts, transcript_chunks (HNSW index)         |
+-----------------------------------------------------------------------------------------------+
```

---

## 📋 Prerequisites

* **Docker & Docker Compose:** Docker Desktop v24.x+ installed.
* **Ollama (Local LLM):** Downloaded from [ollama.com](https://ollama.com) and running.
  * Pull the recommended model:
    ```powershell
    ollama pull llama3.2:3b
    ```
* **Hardware:** 4+ cores, 16 GB RAM (Tested on AMD Ryzen 7 7735HS with 16GB RAM).

---

## ⚡ Quick Start (Single-Command Docker)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/The-Lenny-Growth-Assistant.git
   cd "The Lenny Growth Assistant"
   ```

2. **Configure Environment:**
   ```bash
   cp .env.example .env
   ```

3. **Start with Single Command:**
   ```bash
   docker-compose up --build
   ```

4. **Access the Application:**
   * **Frontend UI:** [http://localhost:3000](http://localhost:3000)
   * **Backend API Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)
   * **Health Check:** [http://localhost:8000/api/health](http://localhost:8000/api/health)

---

## 💻 Local Standalone Setup (Without Docker)

### 1. Backend Setup (Python 3.11+)
```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt

# Run knowledge ingestion
python scripts/download_transcripts.py
python scripts/ingest.py

# Start FastAPI server
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend Setup (Node.js 18+ / 20+)
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

---

## 📥 Ingestion & Vector Indexing

The ingestion pipeline parses transcripts from the curated `ChatPRD/lennys-podcast-transcripts` archive:
1. **Metadata Extraction:** Extracts episode title, guest name, and timestamp headers from YAML frontmatter.
2. **Recursive Character Chunking:** Splits transcripts into $500\text{--}800$ token chunks with $100$-token overlap to maintain conversational context.
3. **Dense Embeddings:** Encodes chunks using `sentence-transformers/all-MiniLM-L6-v2` (384 dimensions).
4. **HNSW Cosine Index:** Creates an HNSW index (`m=16, ef_construction=64`) in PostgreSQL `pgvector` for sub-50ms nearest-neighbor queries.

To re-index:
```bash
python backend/scripts/ingest.py
```

---

## 🔄 Model Configuration & Toggling

The application features a **Dynamic Provider Factory**:
* **Local Ollama (Default):** Set `DEFAULT_LLM_PROVIDER=ollama`. Streams from `http://host.docker.internal:11434` with zero API cost.
* **Cloud Claude:** Set `ANTHROPIC_API_KEY=your_key`.
* **Cloud OpenAI:** Set `OPENAI_API_KEY=your_key`.
* **Free Cloud Groq:** Set `GROQ_API_KEY=your_key` (Free from [console.groq.com](https://console.groq.com)).
* **Free Cloud Gemini:** Set `GEMINI_API_KEY=your_key` (Free from [aistudio.google.com](https://aistudio.google.com)).

Users can switch between models on the fly using the **Model Selector** dropdown in the top header without losing session state.

---

## 🧪 Automated Testing

Execute the test suite with `pytest`:
```bash
cd backend
pytest tests/ -v
```

Test coverage includes:
* `test_api.py`: Session CRUD, chat payload validation, and `/api/health` probes.
* `test_retrieval.py`: Recursive character chunking, frontmatter parsing, artifact extraction, and Ship 30 prompt compilation.
* `test_providers.py`: Provider initialization, missing key handling, and graceful fallback to Ollama.

---

## 🎥 Video Demo Walkthrough Guide (2–3 Minutes)

When recording your demonstration video with your camera enabled:

* **0:00 – 0:30 (Context & Problem):**
  * Introduce yourself and state the problem: Growth PMs need battle-tested tactics from *Lenny's Podcast* without spending 200+ hours listening to audio.
  * Show the Impeccable dual-pane interface in dark slate Obsidian.
* **0:30 – 1:15 (Grounded QA with Local Ollama):**
  * Select `Local Ollama (llama3.2:3b)`.
  * Ask: *"What did Brian Chesky say about founder mode and unscalable tactics?"*
  * Highlight the real-time token streaming ($< 1\text{s}$ TTFT) and click a citation pill to show the verbatim transcript quote with timestamp.
* **1:15 – 1:45 (Ship 30 for 30 Content Engine):**
  * Toggle mode to `Ship 30 for 30`.
  * Query: *"Elena Verna's B2B viral loops"*.
  * Show the generated 1,250-word essay: point out the lines 1–3 hook, short 1–3 sentence paragraphs, bold anchors on bullets, and the operational checklist conclusion.
* **1:45 – 2:15 (Claude-Style Sandboxed Artifact Viewer):**
  * Ask: *"Build an interactive HTML calculator for Viral Coefficient K-Factor"*.
  * Watch the Artifact Drawer slide open automatically.
  * Demonstrate the interactive calculator running inside the sandbox and explain the two-tier security guarantee (`DOMPurify` + `sandbox="allow-scripts"` without `allow-same-origin`).
* **2:15 – 2:30 (Technical Trade-offs & Wrap-Up):**
  * Explain the trade-off: Local 3B/8B model constraints vs. zero-cost evaluator autonomy. Show the live Model Toggle dropdown.
  * Conclude with single-command `docker-compose up` deployment readiness.

---

## 📚 Documentation & References

* **PRD:** [`docs/PRD.md`](docs/PRD.md)
* **Architecture Spec:** [`docs/architecture.md`](docs/architecture.md)
* **Design Spec:** [`docs/design.md`](docs/design.md)
* **Resource Catalog:** [`resources/README.md`](resources/README.md)
* **Agent Scaffolding Transcript:** [`agent_transcripts/01_initial_scaffolding.md`](agent_transcripts/01_initial_scaffolding.md)
* **Vector Indexing & Security Transcript:** [`agent_transcripts/02_debugging_pgvector_indexing.md`](agent_transcripts/02_debugging_pgvector_indexing.md)
