# Agent Transcript 01: Initial Scaffolding, RAG Pipeline & Dual Model Layer

## Overview
This transcript documents the initial construction and scaffolding of **The Lenny Growth Assistant**, including environment configuration, pgvector database integration, dual-model streaming (Ollama + Cloud providers), and the Ship 30 for 30 essay engine.

---

## Step-by-Step Trajectory

### 1. Ingestion Pipeline & Embedding Generation
- **Action:** Created `backend/app/rag/embeddings.py` and `backend/app/rag/retriever.py`.
- **Target:** Ingest 269 podcast transcripts from `ChatPRD/lennys-podcast-transcripts`.
- **Encountered Issue:** Some transcripts contained non-standard YAML frontmatter and missing timestamp delimiters.
- **Correction:** Implemented resilient frontmatter parser using `yaml.safe_load` fallback and regex-based timestamp matching (`HH:MM:SS` or `MM:SS`). Added recursive character chunking (500-800 tokens with 100-token overlap).

### 2. Database Schema & pgvector Setup
- **Action:** Defined SQLAlchemy 2.0 async models for `sessions`, `messages`, `artifacts`, and `transcript_chunks` with 384-dimensional vector columns.
- **Encountered Issue:** Standalone development environments without active PostgreSQL/pgvector raised connection errors during local tests.
- **Correction:** Implemented transparent in-memory fallbacks (`IN_MEMORY_SESSIONS`) and local cosine similarity search over raw JSON transcript archives when PostgreSQL is unreachable.

### 3. Multi-LLM Provider Layer
- **Action:** Built `BaseLLMProvider` with concrete implementations:
  - `OllamaProvider`: Local `llama3.2:3b` streaming via `http://localhost:11434`.
  - `CloudProvider`: Support for Groq (`llama-3.3-70b-versatile`), Gemini (`gemini-2.0-flash`), Claude (`claude-3-5-sonnet`), and OpenAI (`gpt-4o`).
- **Encountered Issue:** Cloud providers failed abruptly when API keys were missing from `.env`.
- **Correction:** Added graceful fallback to local Ollama with status alert events streamed via SSE so the user is never left with an unhandled exception.

---

## Resulting State
- FastAPI server running on port 8000 with SSE streaming endpoints (`/api/chat`, `/api/sessions`, `/api/providers/status`, `/api/health`).
- Clean separation between local 100% free Ollama inference and high-throughput cloud endpoints.
