# AGENTS.md

## Project Overview
The Lenny Growth Assistant (LENNY Growth-Assistant) is an enterprise-grade AI advisor and content generation engine built on 200+ curated transcripts from Lenny's Podcast (~2.5M words). It features hybrid RAG search over podcast archives, Ship 30 for 30 atomic essay generation (`/ship <topic>`), an interactive side-by-side Claude-style artifact workspace with sandboxed execution, and multi-model LLM generation (Local Ollama `llama3.2:3b`, Groq Qwen 3.8 27B, Google Gemini 2.0 Flash, Claude 3.5 Sonnet, GPT-4o).

---

## Tech Stack
- **Frontend Framework & Language:** Next.js 14 (App Router), React 18, TypeScript 5, Tailwind CSS 3.4
- **UI Design System:** Warm Editorial Palette (`#F5EBE0` Cream, `#EDEDE9` Alabaster, `#D6CCC2` Bone, `#E3D5CA` Sand, `#1C1917` Charcoal), Lucide React
- **Backend Framework & Language:** Python 3.10+, FastAPI 0.115+, Uvicorn 0.32+, Pydantic v2
- **Database & Vector Retrieval:** PostgreSQL + pgvector (with resilient in-memory session & transcript fallback), SentenceTransformers (`all-MiniLM-L6-v2` / 384-dim)
- **LLM Providers:** Local Ollama (`llama3.2:3b`), Groq API (`qwen/qwen3.8-27b`), Google Gemini API (`gemini-2.0-flash`), Anthropic API (`claude-3-5-sonnet`), OpenAI API (`gpt-4o`)
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

#### Run Discovery & Off-Topic Rejection Tests
```powershell
cd backend
python -m unittest tests/test_discovery.py
```

#### Run JIT Ingestion & Additive Scaling Integration Test
```powershell
cd backend
python -m unittest tests/test_jit_ingest.py
```

#### Run Full Backend Test Suite
```powershell
cd backend
python -m unittest discover -s tests
```

### 📦 Transcript & Catalog Management

#### Sync 269-Episode Catalog from GitHub
```powershell
cd backend
python scripts/sync_manifest.py
```

#### Seed Initial Batch Ingestion
```powershell
cd backend
python -m app.rag.ingest
```

### 🎬 Video Pitch & Media Production Commands

#### Fast Assembly (Voice-Dominant Mix + Concat Filter 30fps)
```powershell
cd "Growth_assistant pitch video/scripts"
python fast_assemble.py
```

#### Test & Verify Audio Levels (Voice vs BGM dB Separation)
```powershell
cd "Growth_assistant pitch video/scripts"
python test_audio_levels.py
```

#### Re-render Professional Intro / Outro Cards
```powershell
cd "Growth_assistant pitch video/scripts"
python render_intro.py
python render_outro.py
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
│   │   │   ├── chat.py            # SSE streaming endpoint, JIT fallback, /ship
│   │   │   ├── sessions.py        # Session CRUD with in-memory fallback & validation sanitizers
│   │   │   ├── providers.py       # Multi-LLM status checks, runtime key persistence, and live verification
│   │   │   └── health.py          # Database and local Ollama health probes
│   │   ├── rag/
│   │   │   ├── discovery.py       # In-memory 269-episode catalog matching & GitHub CDN fetcher
│   │   │   ├── retriever.py       # pgvector search + local transcript similarity fallback
│   │   │   ├── embeddings.py      # Embedding generation pipeline (all-MiniLM-L6-v2)
│   │   │   └── ingest.py          # Additive single-episode ingestion & seed indexing
│   │   ├── providers/             # Multi-LLM adapters (Ollama, Groq, Gemini, Claude, OpenAI)
│   │   ├── skills/
│   │   │   ├── ship30_writer.py   # Ship 30 for 30 prompt builder (~1,250 words, hooks, anchors)
│   │   │   └── artifact_generator.py # Defense-in-depth artifact cleaner and regex extractor
│   │   ├── models/                # SQLAlchemy db models and Pydantic request/response schemas
│   │   └── main.py                # FastAPI factory, CORS middleware, router registrations
│   ├── data/
│   │   ├── episodes_manifest.json # Master 269-episode catalog (guests, summaries, keywords)
│   │   └── transcripts/           # Locally cached episode Markdown transcripts
│   ├── scripts/
│   │   ├── sync_manifest.py       # Syncs episodes_manifest.json from GitHub index/episodes.md
│   │   └── download_transcripts.py# Downloads curated seed episodes
│   └── tests/                     # Unit and integration test suite
├── Growth_assistant pitch video/  # Production pitch video suite
│   ├── scripts/
│   │   ├── fast_assemble.py      # Concat filter assembly (+faststart, dual output)
│   │   ├── mix_and_duck.py       # Minimal BGM mixer (27dB speech separation)
│   │   ├── render_intro.py       # 7s dark atmospheric gradient + tech grid intro
│   │   ├── render_outro.py       # 5s matching Thank You outro (clean typography)
│   │   ├── test_audio_levels.py  # RMS audio separation & loudness verification
│   │   └── voice_normalized.wav  # Enhanced dialogue track (mean -20.8 dB)
│   ├── AUDIO.png                 # Reference thumbnail & branding palette
│   └── Lenny's Growth Final Pitch.mp4 # Production deliverable (5:14, 95MB)
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
- **Verify Builds & Tests:** Run `python -m unittest discover -s tests` and `npx tsc --noEmit` before concluding changes to guarantee 0 compiler or test errors.
- **PRD Completeness:** Maintain the complete 5-point Discovery Brief in `docs/PRD.md` (User & Problem, Success Metrics M-01 to M-06, Assumptions, Scope Inclusions/Exclusions, and Risk Mitigation Matrix).
- **Architectural Diagrams:** Keep Mermaid system topologies and database ERDs in `README.md` and `docs/architecture.md` synchronized with codebase changes.
- **Agent Transcripts:** Maintain clean, secret-redacted transcripts in `agent_transcripts/` capturing real engineering trajectories, failures, and resolutions.
- **Executive Pitch Calibration:** Frame project capabilities around core technical innovations (HNSW Grounding, Iframe Security, Multi-Model Decoupling, Ship 30 Engine) rather than superficial UI tweaks.
- **Anchored `.gitignore` in Monorepos:** In polyglot workspaces (Python + Node.js), always anchor Python artifact ignores (e.g., `/lib/`, `/dist/`) or explicitly preserve frontend source libraries (`!frontend/src/lib/`) to prevent Git from silently omitting frontend source files.
- **CI/CD Tracked Files Verification:** Verify that all essential source modules are actively tracked by Git (`git ls-files` and `git status --ignored`) before concluding deployment fixes so remote build pipelines (Vercel, Render, Fly.io) match local environments.
- **Maintain Theme Integrity:** Adhere to the Warm Editorial palette (`#F5EBE0`, `#EDEDE9`, `#D6CCC2`, `#E3D5CA`, `#1C1917`).
- **Keep SSE Protocol Intact:** Maintain standard streaming events: `status`, `sources`, `token`, `artifact`, `[DONE]`.
- **Sync AGENTS.md:** Proactively update this `AGENTS.md` whenever adding new API routes, UI components, or architectural patterns.
- **Normalize Speech First in Video:** Always apply dynamic audio normalization (`dynaudnorm`) to dialogue before mixing.
- **Enforce 20–27 dB Speech Separation:** BGM under speech must sit at least 20 dB to 27 dB below voice (`gain 0.015 - 0.035`, approx `-48 dBFS`) with `normalize=0` in `amix`.
- **Concat Filter for Mixed Framerates:** Use FFmpeg `concat` filter with explicit `fps=30` and `scale=1920:1080` when joining screen recordings (e.g. 60fps) with title cards (30fps).
- **Faststart Placement:** Always append `-movflags +faststart` to place the `moov` atom at byte 0.

### ⚠️ Ask First
- **Database Schema Changes:** Modifying SQLAlchemy models, ChromaDB/pgvector chunking dimensions (384-dim).
- **Adding Heavy Dependencies:** Introducing large external npm or pip packages (>10MB).
- **Core Prompt Shifts:** Altering grounding refusal thresholds or Ship 30 core essay heuristics.

### 🚫 Never Do
- **Never run destructive git commands:** (`git reset --hard`, `git push -f`).
- **Never commit secrets:** Never hardcode plaintext API keys in code or `.env`.
- **Never place static command bars above input:** The `/ship` autocomplete must trigger dynamically only when typing `/`.
- **Never add white rectangular highlight backgrounds to bold markdown text or headings.**
- **Never let BGM exceed 5% volume (`-38 dBFS`) while speech is active in video production.**
- **Never draw cursor pipes (`|`) or underline rectangle dividers across video intro/outro headings.**
- **Never use crude flat color ellipses for video backgrounds**; use atmospheric gradients, tech grids, and glassmorphism.

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
