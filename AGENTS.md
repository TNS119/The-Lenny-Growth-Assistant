# AGENTS.md

## Project Overview
The Lenny Growth Assistant is an enterprise-grade AI advisor built on curated transcripts from Lenny's Podcast. It features hybrid RAG search over podcast archives, Ship 30 for 30 essay generation skills, and a Claude-style dual-pane UI with interactive sandboxed artifacts.

---

## Tech Stack
- **Frontend:** Next.js 14 (App Router), React 18, TypeScript 5, Tailwind CSS (Warm Editorial Palette), Lucide React.
- **Backend:** Python 3.10+, FastAPI, SQLAlchemy Async, Uvicorn, PostgreSQL + pgvector (with resilient local fallback).
- **RAG & Embeddings:** SentenceTransformers (`all-MiniLM-L6-v2` / 384-dim), cosine vector search.
- **LLM Providers:** Local Ollama (`llama3.2:3b`), Groq (`llama-3.3-70b`), Google Gemini 2.0 Flash, Anthropic Claude 3.5 Sonnet, OpenAI GPT-4o.

---

## Essential Commands

### Development Servers
```bash
# Backend (from ./backend)
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Frontend (from ./frontend)
npm run dev
```

### Build & Typecheck
```bash
# Build frontend and verify TypeScript/Lint validity
cd frontend && npm run build
```

### Testing
```bash
# Run full backend test suite (from ./backend)
pytest

# Run single test module
pytest tests/test_chat.py -v

# Run single test function
pytest tests/test_chat.py -k "test_grounded_answer" -v
```

### Data Ingestion
```bash
# Ingest raw transcript JSONs into vector database (from ./backend)
python -m app.rag.ingest
```

---

## Project Structure Map

```text
The Lenny Growth Assistant/
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx         # Root layout with globals.css & dark class
│   │   │   ├── page.tsx           # Main container: Full-width Navbar & section split
│   │   │   └── globals.css        # Warm Editorial palette tokens & scrollbars
│   │   ├── components/
│   │   │   ├── Chat/
│   │   │   │   ├── ChatPane.tsx       # Message thread, input bar, /ship autocomplete
│   │   │   │   ├── MessageItem.tsx    # Markdown renderer (no white boxes on bold/headings)
│   │   │   │   └── ModelSelector.tsx  # Multi-LLM dropdown with badges & descriptions
│   │   │   └── Artifact/
│   │   │       ├── ArtifactViewer.tsx # Claude-style preview/code viewer with copy & fullscreen
│   │   │       └── SandboxedIframe.tsx# Isolated iframe container for HTML artifacts
│   │   ├── hooks/
│   │   │   └── useChatStream.ts   # SSE event stream consumer (status, token, artifact)
│   │   └── lib/
│   │       └── api.ts             # REST client & TypeScript schema models
│   └── tailwind.config.js         # Warm Editorial color definitions (obsidian/brand)
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── chat.py            # SSE streaming endpoint, prompt dispatch, /ship detection
│   │   │   ├── sessions.py        # Session CRUD with in-memory fallback & validation sanitizers
│   │   │   └── health.py          # Health check endpoint
│   │   ├── rag/
│   │   │   ├── retriever.py       # pgvector search + local transcript similarity fallback
│   │   │   ├── embeddings.py      # Embedding generation pipeline
│   │   │   └── ingest.py          # Transcript chunking and vector indexing script
│   │   ├── providers/             # Multi-LLM adapters (Ollama, Groq, Gemini, Claude, OpenAI)
│   │   ├── skills/
│   │   │   ├── ship30_writer.py   # Ship 30 for 30 prompt builder (~1,250 words, hooks, anchors)
│   │   │   └── artifact_generator.py # Regex artifact extractor & text cleanup
│   │   ├── models/                # SQLAlchemy models and Pydantic schemas
│   │   └── main.py                # FastAPI factory, CORS middleware, lifespan events
│   └── tests/                     # Unit and integration tests
└── resources/transcripts/         # Lenny's Podcast transcript JSON source files
```

---

## Code Style & Standards

### Frontend (React / TypeScript)
```typescript
// ✅ Good - Explicit types, clean error boundaries, semantic palette tokens
interface ChatPaneProps {
  messages: Message[];
  isStreaming: boolean;
  onSendMessage: (text: string, mode: 'default' | 'ship' | 'ship30') => void;
}

export const MessageBubble: React.FC<{ content: string }> = ({ content }) => {
  return (
    <div className="bg-obsidian-850 border border-obsidian-600 rounded-xl p-4 text-obsidian-100">
      <strong className="font-bold text-obsidian-100">{content}</strong>
    </div>
  );
};

// ❌ Bad - Any types, hardcoded arbitrary hex colors, white highlight boxes
export const MessageBubble = ({ content }: any) => {
  return <div style={{ background: '#fff' }}><strong>{content}</strong></div>;
};
```

### Backend (FastAPI / Python)
```python
# ✅ Good - Pydantic model validation with UUID and timestamp normalization
async def _persist_conversation(
    session_id: uuid.UUID,
    user_msg: str,
    assistant_msg: str,
    sources: list,
    artifacts: list = None
):
    asst_id = str(uuid.uuid4())
    formatted_artifacts = [
        {
            "id": str(art.get("id") or uuid.uuid4()),
            "message_id": asst_id,
            "artifact_type": art.get("artifact_type", "markdown"),
            "title": art.get("title", "Artifact"),
            "content": art.get("content", ""),
            "created_at": datetime.utcnow().isoformat()
        }
        for art in (artifacts or [])
    ]

# ❌ Bad - Missing required fields, unhandled None database session
def save_chat(sess_id, msg):
    IN_MEMORY[sess_id].append({"msg": msg})
```

---

## Boundaries & Permissions

- ✅ **Always:**
  - Run `npm run build` before finalizing frontend changes to ensure zero compiler/lint errors.
  - Maintain the Warm Editorial palette (`#F5EBE0` Cream, `#EDEDE9` Alabaster, `#D6CCC2` Bone, `#E3D5CA` Sand, `#1C1917` Charcoal).
  - Ensure bold keywords (`strong`) and headings do **not** have white rectangular background boxes.
  - Keep SSE stream events conforming to standard contracts: `status`, `sources`, `token`, `artifact`, `[DONE]`.

- ⚠️ **Ask First:**
  - Modifying database schema models or pgvector chunking dimensions (384-dim).
  - Adding new third-party npm packages or Python dependencies.
  - Altering core system prompts for grounding refusal thresholds.

- 🚫 **Never:**
  - Run destructive git commands (`git reset --hard`, `git push -f`).
  - Commit API keys or plaintext secrets (`.env`).
  - Place static command bars permanently above input (must trigger conditionally on `/`).
  - Sever fallback in-memory session persistence when PostgreSQL is disconnected.
