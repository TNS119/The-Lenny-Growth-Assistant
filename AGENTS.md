# AGENTS.md

## Project Overview
The Lenny Growth Assistant (LENNY Growth-Assistant) is an enterprise-grade AI advisor and content generation engine built on 200+ curated transcripts from Lenny's Podcast (~2.5M words). It features hybrid RAG search over podcast archives, Ship 30 for 30 atomic essay generation (`/ship <topic>`), an interactive side-by-side Claude-style artifact workspace with sandboxed execution, and multi-model LLM generation (Local Ollama `llama3.2:3b`, Groq Llama 3.3 70B, Google Gemini 2.0 Flash, Claude 3.5 Sonnet, GPT-4o).

---

## Tech Stack
- **Frontend Framework & Language:** Next.js 14 (App Router), React 18, TypeScript 5, Tailwind CSS 3.4
- **UI Design System:** Warm Editorial Palette (`#F5EBE0` Cream, `#EDEDE9` Alabaster, `#D6CCC2` Bone, `#E3D5CA` Sand, `#1C1917` Charcoal), Lucide React
- **Backend Framework & Language:** Python 3.10+, FastAPI 0.115+, Uvicorn 0.32+, Pydantic v2
- **Database & Vector Retrieval:** PostgreSQL + pgvector (with resilient in-memory session & transcript fallback), SentenceTransformers (`all-MiniLM-L6-v2` / 384-dim)
- **LLM Providers:** Local Ollama (`llama3.2:3b`), Groq API (`llama-3.3-70b-versatile`), Google Gemini API (`gemini-2.0-flash`), Anthropic API (`claude-3-5-sonnet`), OpenAI API (`gpt-4o`)
- **Testing:** `pytest` (Backend), Vitest / TypeScript typecheck (Frontend)

---

## Essential Commands

### 🚀 Running the Development Servers

#### Backend (FastAPI on Port 8000)
```powershell
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### Frontend (Next.js on Port 3000)
```powershell
cd frontend
npm run dev
```

### 🏗️ Build & Typecheck Commands

#### Frontend Next.js Production Build
```powershell
cd frontend
npm run build
```

#### Frontend TypeScript Check
```powershell
cd frontend
npx tsc --noEmit
```

### 🧪 Testing Commands

#### Run Full Backend Test Suite
```powershell
cd backend
pytest tests/ -v
```

#### Run Single Test File
```powershell
cd backend
pytest tests/test_chat.py -v
```

#### Run Specific Test Method
```powershell
cd backend
pytest tests/test_chat.py -k "test_grounded_answer" -v
```

### 📦 Transcript Vector Ingestion
```powershell
cd backend
python -m app.rag.ingest
```

---

## Project Structure Map

```text
The Lenny Growth Assistant/
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx         # Root layout with Warm Editorial fonts and metadata
│   │   │   ├── page.tsx           # Full-height Sidebar + Main Container Header + Workspace Split
│   │   │   └── globals.css        # Palette tokens, scrollbar styling, no-whitebox bold text
│   │   ├── components/
│   │   │   ├── Chat/
│   │   │   │   ├── ChatPane.tsx       # Message thread, input bar, embedded DropUp LLM switcher
│   │   │   │   ├── MessageItem.tsx    # Markdown renderer (no white boxes on bold/headings)
│   │   │   │   └── ModelSelector.tsx  # Minimal DropUp switcher, no logos, masked API key modal
│   │   │   └── Artifact/
│   │   │       ├── ArtifactViewer.tsx # Claude-style preview/code viewer with sanitized text
│   │   │       └── SandboxedIframe.tsx# Isolated iframe container for HTML artifacts
│   │   ├── hooks/
│   │   │   └── useChatStream.ts   # SSE event stream consumer (status, sources, token, artifact)
│   │   └── lib/
│   │       └── api.ts             # REST client & TypeScript schemas
│   └── tailwind.config.js         # Warm Editorial color tokens (obsidian, brand-teal, brand-sand)
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── chat.py            # SSE streaming endpoint, initial-query session naming, /ship
│   │   │   ├── sessions.py        # Session CRUD with in-memory fallback & validation sanitizers
│   │   │   ├── providers.py       # Multi-LLM status checks and live API key verification
│   │   │   └── health.py          # Database and local Ollama health probes
│   │   ├── rag/
│   │   │   ├── retriever.py       # pgvector search + local transcript similarity fallback
│   │   │   ├── embeddings.py      # Embedding generation pipeline (all-MiniLM-L6-v2)
│   │   │   └── ingest.py          # Transcript chunking and vector indexing script
│   │   ├── providers/             # Multi-LLM adapters (Ollama, Groq, Gemini, Claude, OpenAI)
│   │   ├── skills/
│   │   │   ├── ship30_writer.py   # Ship 30 for 30 prompt builder (~1,250 words, hooks, anchors)
│   │   │   └── artifact_generator.py # Defense-in-depth artifact cleaner and regex extractor
│   │   ├── models/                # SQLAlchemy db models and Pydantic request/response schemas
│   │   └── main.py                # FastAPI factory, CORS middleware, router registrations
│   └── tests/                     # Unit and integration test suite
└── resources/transcripts/         # Lenny's Podcast raw JSON transcripts
```

---

## Code Style & Standards

### Frontend (React 18 / TypeScript 5 / Tailwind CSS)
- **Component Architecture:** Maintain full-height Sidebar (`h-screen`) on the left and the Main Container header starting from the right of the sidebar.
- **Branding:** Use **`LENNY`** in bold uppercase with tagline **`Growth-Assistant`** and archive subtitle **`200+ Episodes Indexed · 2.5M Words`**. Do not add redundant "Verified ..." badges.
- **Model Switcher:** Keep the LLM switcher embedded inside the chat input box (DropUp menu) with minimal trigger text, no inner model icons, and masked key views (`gsk_••••••••••••3x9A`).
- **Typography:** Strictly prohibit white background rectangular highlight boxes behind `<strong>`, `<b>`, or heading elements.

```typescript
// ✅ Good - Explicit interfaces, Warm Editorial palette tokens, semantic structure
interface ChatPaneProps {
  messages: Message[];
  isStreaming: boolean;
  currentStatus: string | null;
  currentProvider: ProviderType;
  onSelectProvider: (provider: ProviderType) => void;
  onSendMessage: (text: string, mode: "default" | "ship" | "ship30") => void;
  onStopStream: () => void;
  onOpenArtifact: (artifact: Artifact) => void;
}

export const MessageBubble: React.FC<{ content: string }> = ({ content }) => {
  return (
    <div className="bg-obsidian-800 border border-obsidian-600 rounded-xl p-4 text-obsidian-100">
      <strong className="font-bold text-obsidian-100">{content}</strong>
    </div>
  );
};

// ❌ Bad - Any types, hardcoded non-theme colors, white highlight boxes
export const MessageBubble = ({ content }: any) => {
  return <div style={{ background: '#fff' }}><strong>{content}</strong></div>;
};
```

### Backend (FastAPI / Python 3.10+ / Pydantic v2)
- **Session Titling:** Automatically generate concise session titles from the initial user query (`format_session_title`).
- **Artifact Sanitization:** Always run multi-stage cleaning (`clean_artifact_content`, `clean_response_text`) so raw XML tags never leak into chat narratives or artifact bodies.
- **Resilient Fallbacks:** Keep in-memory session persistence and local transcript cosine similarity operational even if PostgreSQL is offline.

```python
# ✅ Good - Pydantic model validation, sanitized artifact payloads, dynamic session naming
def format_session_title(query: str) -> str:
    clean = query.strip().replace("/ship", "").strip(""' ")
    return (clean[:36] + "...") if len(clean) > 36 else (clean or "Growth Discussion")

async def _persist_conversation(
    session_id: uuid.UUID,
    user_msg: str,
    assistant_msg: str,
    sources: list,
    artifacts: list = None
):
    sess = IN_MEMORY_SESSIONS.get(str(session_id))
    if sess and sess.get("title", "").startswith(("New", "Session")):
        sess["title"] = format_session_title(user_msg)
    # Persist sanitized records with valid UUIDs and timestamps...

# ❌ Bad - Missing required fields, unhandled None database session, raw uncleaned tags
def save_chat(sess_id, msg):
    IN_MEMORY[sess_id].append({"msg": msg})
```

---

## Boundaries & Permissions

### ✅ Always Do
- **Verify Builds:** Run `npm run build` or `npx tsc --noEmit` before concluding frontend changes to guarantee 0 compiler errors.
- **Maintain Theme Integrity:** Adhere to the Warm Editorial palette (`#F5EBE0`, `#EDEDE9`, `#D6CCC2`, `#E3D5CA`, `#1C1917`).
- **Keep SSE Protocol Intact:** Maintain standard streaming events: `status`, `sources`, `token`, `artifact`, `[DONE]`.
- **Sync AGENTS.md:** Proactively update this `AGENTS.md` whenever adding new API routes, UI components, or architectural patterns.

### ⚠️ Ask First
- **Database Schema Changes:** Modifying SQLAlchemy models, ChromaDB/pgvector chunking dimensions (384-dim).
- **Adding Heavy Dependencies:** Introducing large external npm or pip packages (>10MB).
- **Core Prompt Shifts:** Altering grounding refusal thresholds or Ship 30 core essay heuristics.

### 🚫 Never Do
- **Never run destructive git commands:** (`git reset --hard`, `git push -f`).
- **Never commit secrets:** Never hardcode plaintext API keys in code or `.env`.
- **Never place static command bars above input:** The `/ship` autocomplete must trigger dynamically only when typing `/`.
- **Never add white rectangular highlight backgrounds to bold markdown text or headings.**

---

## 🔄 Continuous Maintenance & `/learn` Protocol

### 1. Automatic `AGENTS.md` Evolution
Any AI agent operating in this repository must keep this file up-to-date:
- **Sync Directory Map:** When new folders, components, or services are created or modified, update the "Project Structure Map".
- **Sync Commands:** When new build flags, scripts, or testing workflows are introduced, update the "Essential Commands" section.
- **Sync Coding Patterns:** When architectural conventions (e.g. layout splits, provider routing, token sanitization) change, update the "Code Style & Standards" section.

### 2. Proactive `/learn` Protocol
When an agent completes a significant architectural refactor, establishes new UI patterns, or resolves critical configuration workflows, it must recommend the `/learn` slash command to the user so Antigravity persists these conventions across future sessions.

---

## Git & PR Workflow
- **Commit Format:** Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `style:`).
- **PR Scope:** Keep PRs focused on a single logical feature, bug fix, or skill capability.
- **Branch Naming:** `feat/feature-name`, `fix/issue-description`, `skill/ship-30`.
