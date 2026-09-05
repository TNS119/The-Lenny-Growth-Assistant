# PRODUCT REQUIREMENTS DOCUMENT (PRD)
## The Lenny Growth Assistant
**Document Version:** 1.1.0  
**Status:** Approved for Implementation  
**Role:** Forward Deployed Engineer (FDE)  
**File Location:** `docs/PRD.md`  

---

## 1. Discovery Brief

### 1.1 User and Problem Statement
* **Primary User:** Growth Product Managers, Heads of Growth, VPs of Product, and Early-Stage Founders making high-stakes decisions on acquisition loops, pricing tiers, retention mechanics, and team execution.
* **The Job-to-be-Done (JTBD):** When facing complex product growth challenges, users need to formulate verified, battle-tested growth strategies and shareable executive assets without spending hundreds of hours listening to podcast episodes.
* **Pain Removed by Assistant:**
  1. **Dense Audio & Transcript Discovery Friction:** Eliminates manual scanning across 200+ episodes (~2.5M words) of *Lenny's Podcast* by providing instant, semantic retrieval.
  2. **The Hallucination & Speculation Trap:** Replaces ungrounded, generic AI answers with source-attributed quotes with explicit guest attribution and timestamps.
  3. **The Actionability Gap:** Bridges conversational chat with actionable deliverables via the **Ship 30 for 30 Content Engine** (~1,250-word atomic essays) and interactive tools (CAC/LTV payback, K-Factor calculators).
  4. **Client-Side Security Hazards:** Removes XSS and DOM hijacking risks when rendering AI-generated HTML/JS tools through sandboxed iframe containers.

### 1.2 Measurable Success Metrics
* **Product Quality Metric (M-01):** $\\ge 90\\%$ retrieval citation accuracy on factual claims in Grounded QA mode, citing verified `[Episode: Guest Name, Timestamp/Topic]` segments.
* **Operational Guardrail Metric (M-02):** $100\\%$ precision on out-of-domain refusal circuit-breaker (cosine similarity $< 0.65$), strictly returning: *"I do not have sufficient information in Lenny's podcast archive to answer this."*
* **Latency & Performance Metric (M-03):** Sub-second Time-to-First-Token ($\\text{TTFT} < 1.0\\text{s}$) when streaming from local Ollama (`llama3.2:3b`) on standard 8-core CPU / 16 GB RAM hardware.
* **Security & Isolation Metric (M-04):** **0 XSS Vulnerabilities** — complete isolation of parent DOM, cookies (`document.cookie`), and session storage (`localStorage`) from within rendered HTML artifacts.
* **Content Adherence Metric (M-05):** $\\ge 95\\%$ adherence to Ship 30 for 30 heuristics (1,100–1,400 words, curiosity hook in lines 1–3, $\\le 3$ sentences per paragraph, bold anchors on bullets, actionable checklist conclusion).
* **Developer / Evaluator Onboarding Metric (M-06):** $< 5\\text{ minutes}$ single-command deployment time via `docker-compose up` on clean machines.

### 1.3 Discovery Assumptions
1. **Curated Transcript Repository:** Primary knowledge base is derived from pre-transcribed Markdown/JSON archives (`ChatPRD/lennys-podcast-transcripts`, 269 episodes). Live Whisper audio processing of streaming podcasts is not required.
2. **Evaluator Environment & Zero-Cost Mandate:** Evaluators must be able to run the full application 100% free locally via Ollama (`llama3.2:3b` / `llama3.1:8b`). Free cloud adapters (Groq Llama 3.3 70B and Google Gemini 2.0 Flash) are provided to test high-throughput cloud streaming without paid credits.
3. **Multi-Turn Session Isolation:** Multi-user tenancy is handled via isolated session IDs and in-memory/PostgreSQL persistence without requiring external enterprise SSO or Stripe billing integration.
4. **Embedding Dimensions:** Dense vector representation uses `sentence-transformers/all-MiniLM-L6-v2` (384 dimensions) for optimal CPU inference speed and memory footprint.

### 1.4 Scope Choices (Inclusions vs. Intentional Exclusions)
* **What is Included:**
  * Automated transcript ingestion pipeline with recursive character chunking ($500\\text{--}800$ tokens, $100$-token overlap) and PostgreSQL `pgvector` HNSW indexing.
  * Grounded QA conversational interface with real-time SSE token streaming and clickable source citation pills.
  * Out-of-domain refusal circuit-breaker triggered on low similarity.
  * Dedicated Ship 30 for 30 essay compiler (`/ship <topic>`).
  * Side-by-side Claude-style Sandboxed Artifact Viewer (`sandbox="allow-scripts"` without `allow-same-origin`, sanitized via `DOMPurify`).
  * Pluggable Dual Model Layer (Local Ollama, Groq, Gemini, Claude 3.5 Sonnet, GPT-4o) with embedded DropUp switcher and masked API key manager.
  * Full-height sidebar navigation with dynamic initial-query session titling.
* **What is Intentionally Excluded (& Why):**
  * *Live Real-Time Audio Streaming:* Excluded to keep local CPU and RAM within standard developer laptop limits (avoids heavy local Whisper pipelines).
  * *Unbounded Open Web Search:* Excluded to enforce 100% authoritative grounding exclusively on *Lenny's Podcast* archives.
  * *Payment / SaaS Billing Portals:* Excluded as the system is architected as an internal operational decision support tool.

### 1.5 Key Risks, Trade-offs & Mitigation Matrix

| Risk Dimension | Description & Impact | Technical Mitigation / Architectural Trade-off |
| :--- | :--- | :--- |
| **Hallucination & Speculation** | LLM generating plausible but ungrounded advice absent from podcast transcripts. | **Deterministic 0.65 Cosine Circuit-Breaker:** Direct retrieval from PostgreSQL `pgvector` HNSW index; queries failing similarity threshold return immediate standard refusal without passing to LLM. |
| **Latency & TTFT** | Slow generation on local hardware creating frustrating conversational delays. | **HNSW Indexing + Lightweight 3B Models:** Sub-50ms vector lookup via HNSW index; default local model set to `llama3.2:3b` for sub-second TTFT streaming over SSE. |
| **Cost & API Billing Friction** | Evaluators or teams unable to test due to paid API keys (Anthropic/OpenAI lack free tiers). | **Dual-Model Architecture:** Fully functional zero-cost local Ollama inference bundled with zero-cost free cloud providers (Groq Llama 3.3 70B & Gemini 2.0 Flash). |
| **Local-Model Quality Trade-offs** | Smaller 3B models have tighter context limits and struggle with multi-thousand-word essays. | **Dynamic Model Switcher & Dual Heuristics:** Grounded QA works cleanly on `llama3.2:3b`; user can switch dynamically to Groq/Gemini/Claude via the DropUp menu for long-form essays and complex artifacts. |
| **Data Leakage & Privacy** | Accidental exposure of private API credentials or session state. | **Client-Side Key Masking & In-Memory Fallbacks:** UI masks API keys (`gsk_••••••••••••3x9A`); zero hardcoded keys committed; server stores keys in volatile session headers. |
| **Unsafe Artifact Rendering (XSS)** | AI-generated HTML/JS scripts executing malicious code, stealing cookies, or hijacking DOM. | **Two-Tier Isolation Sandbox:** All HTML artifacts sanitized via `DOMPurify` and mounted inside `<iframe>` configured with `sandbox="allow-scripts"` and strictly **omitting** `allow-same-origin`. Unique origin (`null`) prevents access to parent cookies, local storage, and DOM tree. |

---

## 2. Target Persona & Jobs-to-be-Done (JTBD)

### 2.1 Primary Persona: The Growth Product Leader
* **Title:** Growth Product Manager, VP of Product, or Early-Stage Founder.
* **Context:** Leading product strategy, experiment design, and conversion optimization in high-velocity tech startups.
* **Behavioral Traits:** Values concrete tactical frameworks over abstract theory; demands verified examples from respected practitioners; communicates cross-functionally via concise memos and interactive prototypes.

### 2.2 Core Jobs-to-be-Done
* **Job 1 (Grounded Tactical Synthesis):** *"When I face an ambiguous product growth challenge, I want to query vetted frameworks from world-class operators with verified timestamps, so that I can validate my decision against battle-tested precedents without listening to 200+ hours of podcast audio."*
* **Job 2 (Executive Content Production):** *"When I synthesize strategic takeaways for my team or stakeholders, I want to transform technical answers into high-retention, 1,250-word Ship 30 for 30 essays, so that my team reads and acts on the strategy immediately."*
* **Job 3 (Interactive Tool Execution):** *"When an operational concept requires calculations (e.g., CAC/LTV payback, viral K-factor), I want the assistant to generate and render an interactive calculator right beside the conversation in a secure sandbox, so that I can run scenarios without copying code into an external editor."*

---

## 3. System Architecture & User Flows

### 3.1 Flow 1: Grounded Conversational QA
```
User Enters Query
       │
       ▼
Compute Vector Embedding (all-MiniLM-L6-v2)
       │
       ▼
Query PostgreSQL pgvector (HNSW Cosine Search)
       │
       ├── Top chunks score < 0.65 threshold ──► Yield Refusal Fallback & [DONE]
       │
       └── Top chunks score >= 0.65 threshold
              │
              ▼
       Inject Context into Grounded Prompt Template
              │
              ▼
       Stream SSE Tokens to Client + Render Citation Pills
```
* **Acceptance Criteria:**
  1. Every response streams token-by-token over Server-Sent Events (`text/event-stream`).
  2. The UI renders citation badges listing episode title, guest name, and timestamp. Clicking a pill displays the underlying transcript excerpt.
  3. If no relevant chunks meet the $0.65$ similarity threshold, the assistant immediately returns: *"I do not have sufficient information in Lenny's podcast archive to answer this."*

### 3.2 Flow 2: Ship 30 for 30 Essay Generation
```
User Types "/ship <topic>" or Selects Ship 30 Mode
       │
       ▼
Retrieve Top Transcript Chunks (Elena Verna, Brian Chesky, etc.)
       │
       ▼
Compile Ship 30 Heuristic Prompt:
  - 1,250 words
  - Lines 1-3 Hook & Outcome Promise
  - 1-3 Sentence Paragraphs
  - Bold Anchors on Bullets
  - Concrete Checklist / Framework Conclusion
       │
       ▼
Stream High-Retention Essay to Chat & Auto-Generate Artifact in Workspace
```
* **Acceptance Criteria:**
  1. Output adheres to the structural heuristics of the Ship 30 for 30 methodology.
  2. Claims are attributed directly to episode guests.
  3. Formatted with H2/H3 headers, bullet lists with bold anchors, and single-sentence impact lines.

### 3.3 Flow 3: Claude-Style Artifact Generation & Viewing
```
Assistant Generates Output with Delimiters:
<artifact type="html|markdown" title="...">
...
</artifact>
       │
       ▼
Client Stream Parser Detects Opening Tag
       │
       ├── Auto-expands Right-Hand Artifact Drawer
       ├── Routes tokens to Artifact State Store
       └── Renders interactive "Artifact Generated" pill in Chat Pane
       │
       ▼
Closing Tag Received (</artifact>)
       │
       ├── If Markdown: Render via react-markdown with remark-gfm
       └── If HTML/JS: Pass through DOMPurify & mount inside Sandboxed Iframe
```
* **Acceptance Criteria:**
  1. Artifact Drawer opens automatically without manual user action when an artifact tag is detected.
  2. Markdown artifacts render headers, syntax-highlighted codeblocks, and tables.
  3. HTML artifacts render inside an `<iframe>` with `sandbox="allow-scripts"` and `DOMPurify` sanitization.
  4. Header provides controls to toggle between Rendered Preview and Raw Code, copy content, view full-screen, and close the drawer.

### 3.4 Flow 4: Interactive In-Between Model Toggle
* **Acceptance Criteria:**
  1. The UI input toolbar includes an embedded model selector DropUp menu populated with:
     * `Ollama (Local) - llama3.2:3b` (Default - Free)
     * `Groq Llama 3.3 70B` (Free Tier)
     * `Google Gemini 2.0 Flash` (Free Tier)
     * `Claude 3.5 Sonnet` (Paid Config)
     * `OpenAI GPT-4o` (Paid Config)
  2. Switching models does not interrupt active chat history or reset the session.
  3. The request header `X-LLM-Provider` or body parameter `provider` routes the subsequent request to the selected engine.
  4. If a cloud key is missing, the backend emits a status warning event and falls back to local Ollama seamlessly.

---

## 4. Non-Functional Requirements (NFRs)

* **Performance:** Sub-second TTFT ($< 1.0\\text{s}$) on local Ollama `llama3.2:3b`; sub-50ms vector retrieval in pgvector.
* **Reliability & Resilience:** All exceptions (network timeouts, unpulled Ollama models, DB connection drops) return structured JSON errors with human-actionable troubleshooting advice and in-memory session persistence fallbacks.
* **Security:** Strict iframe sandbox attributes (`allow-scripts` without `allow-same-origin`), DOMPurify HTML sanitization, zero committed credentials, and masked API key modal.
* **Usability & Design:** Built following the Warm Editorial palette (`#F5EBE0` Cream, `#EDEDE9` Alabaster, `#D6CCC2` Bone, `#E3D5CA` Sand, `#1C1917` Charcoal) with high-contrast text, accessible color contrast (WCAG AA), responsive breakpoints, and full keyboard navigation.
