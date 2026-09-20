# PRODUCT REQUIREMENTS DOCUMENT (PRD)
## The Lenny Growth Assistant
**Document Version:** 1.2.0  
**Status:** Approved & Implemented  

**File Location:** `docs/PRD.md`  

---

## 1. Discovery Brief

### 1.1 User and Problem Statement
* **Primary User:** Growth Product Managers, Heads of Growth, VPs of Product, and Early-Stage Founders making high-stakes decisions on acquisition loops, pricing tiers, retention mechanics, and team execution.
* **The Job-to-be-Done (JTBD):** When facing complex product growth challenges, users need to formulate verified, battle-tested growth strategies and shareable executive assets without spending hundreds of hours listening to podcast episodes.
* **Pain Removed by Assistant:**
  1. **Dense Audio & Transcript Discovery Friction:** Eliminates manual scanning across 269 episodes (~2.5M words) of *Lenny's Podcast* through hybrid semantic search and **Just-In-Time (JIT) Episode Discovery**.
  2. **The Hallucination & Speculation Trap:** Replaces ungrounded, generic AI answers with source-attributed quotes with explicit guest attribution and timestamps.
  3. **The Static Database Limitation:** Solves static dataset boundaries through on-demand retrieval from the 269-episode upstream archive (`ChatPRD/lennys-podcast-transcripts`), automatically chunking, embedding, and additively upserting newly queried episodes into Supabase pgvector on the fly.
  4. **The Actionability Gap:** Bridges conversational chat with actionable deliverables via the **Ship 30 for 30 Content Engine** (~1,250-word atomic essays) and interactive tools (CAC/LTV payback, K-Factor calculators).
  5. **Client-Side Security Hazards:** Removes XSS and DOM hijacking risks when rendering AI-generated HTML/JS tools through sandboxed iframe containers.

### 1.2 Measurable Success Metrics
* **Product Quality Metric (M-01):** $\ge 90\%$ retrieval citation accuracy on factual claims in Grounded QA mode, citing verified `[Episode: Guest Name, Timestamp/Topic]` segments.
* **Operational Guardrail Metric (M-02):** $100\%$ precision on out-of-domain refusal circuit-breaker (cosine similarity $< 0.65$), strictly returning: *"I do not have sufficient information in Lenny's podcast archive to answer this."*
* **Catalog Matching Precision (M-03):** $< 2\text{ms}$ in-memory catalog scan across 269 episodes, accurately routing queries by guest name or domain topic keywords (OKRs, growth loops, pricing).
* **JIT Dynamic Ingestion Latency (M-04):** One-time dynamic ingestion of unindexed episodes from GitHub CDN into Supabase pgvector in $< 45\text{s}$, with real-time SSE user status notification. Subsequent queries execute at sub-second cached speed ($< 100\text{ms}$ retrieval).
* **Security & Isolation Metric (M-05):** **0 XSS Vulnerabilities** — complete isolation of parent DOM, cookies (`document.cookie`), and session storage (`localStorage`) from within rendered HTML artifacts.
* **Content Adherence Metric (M-06):** $\ge 95\%$ adherence to Ship 30 for 30 heuristics (1,100–1,400 words, curiosity hook in lines 1–3, $\le 3$ sentences per paragraph, bold anchors on bullets, actionable checklist conclusion).
* **Additive Index Integrity (M-07):** $100\%$ additive persistence in Supabase `transcript_chunks` — dynamic single-episode indexing preserves all previously indexed guest chunks without data loss.

### 1.3 Discovery Assumptions
1. **Curated Master Catalog:** Primary knowledge base is indexed against the complete 269-episode archive from `ChatPRD/lennys-podcast-transcripts`, utilizing `index/episodes.md` for keyword and summary extraction (`backend/data/episodes_manifest.json`).
2. **Developer Environment & Zero-Cost Mandate:** Developers and operators can run the full application 100% free locally via Ollama (`llama3.2:3b`). Free cloud adapters (Groq Qwen 3.8 27B and Google Gemini 2.0 Flash) are provided for high-throughput cloud streaming.
3. **Embedding Dimensions:** Dense vector representation uses `sentence-transformers/all-MiniLM-L6-v2` (384 dimensions) for optimal CPU inference speed and low memory footprint.

### 1.4 Scope Choices (Inclusions vs. Intentional Exclusions)
* **What is Included:**
  * Automated transcript ingestion pipeline with speaker-aware chunking (~400 tokens, 50-token overlap) and Supabase PostgreSQL `pgvector` HNSW indexing.
  * **Just-In-Time (JIT) Episode Discovery:** Dynamic fallback engine that detects unindexed guests/topics, downloads raw transcripts from GitHub CDN, computes embeddings, and additively stores them in Supabase.
  * In-memory 269-episode catalog (`episodes_manifest.json`) for zero-latency off-topic rejection and keyword routing.
  * Grounded QA conversational interface with real-time SSE token streaming, scenario-aware status pills, and clickable source citation cards.
  * Out-of-domain refusal circuit-breaker triggered on low similarity with standard context-aware refusal.
  * Dedicated Ship 30 for 30 essay compiler (`/ship <topic>`).
  * Side-by-side Claude-style Sandboxed Artifact Viewer (`sandbox="allow-scripts"` without `allow-same-origin`, sanitized via `DOMPurify`).
  * Pluggable Dual Model Layer (Local Ollama, Groq, Gemini, Claude 3.5 Sonnet, GPT-4o) with embedded DropUp switcher and masked API key manager.
* **What is Intentionally Excluded (& Why):**
  * *Live Real-Time Audio Streaming:* Excluded to keep local CPU and RAM within standard developer laptop limits (avoids heavy local Whisper pipelines).
  * *Unbounded Open Web Search:* Excluded to enforce 100% authoritative grounding exclusively on *Lenny's Podcast* archives.
  * *Payment / SaaS Billing Portals:* Excluded as the system is architected as an internal operational decision support tool.

### 1.5 Key Risks, Trade-offs & Mitigation Matrix

| Risk Dimension | Description & Impact | Technical Mitigation / Architectural Trade-off |
| :--- | :--- | :--- |
| **Hallucination & Speculation** | LLM generating plausible but ungrounded advice absent from podcast transcripts. | **Two-Tier Grounding Circuit-Breaker:** Vector similarity check ($\ge 0.65$) paired with in-memory catalog rejection; queries without transcript backing return immediate standard refusal. |
| **API Rate Limiting on GitHub** | Dynamic retrieval hitting GitHub REST API 60-req/hr limits on repeated queries. | **Pre-Compiled Master Catalog + CDN Fetching:** All 269 episode metadata stored in `episodes_manifest.json` ($<2\text{ms}$ scan); raw markdown fetched directly from Fastly CDN (`raw.githubusercontent.com`) which has no API limits. |
| **Ingestion Latency on New Episodes** | User waiting during one-time chunking and embedding of brand-new episodes. | **Streaming Status Updates:** SSE status events notify the user in real time (*"Found episode for [Guest]... Ingesting transcript..."*); once indexed, the episode is permanently cached in Supabase. |
| **Database Data Overwrites** | Dynamic ingestion accidentally clearing previously indexed episodes. | **Additive Upsert Discipline:** Single-episode pipeline deletes only records matching the target `guest_name` before inserting new chunks, preserving all other episodes. |
| **Security & Isolation Risk** | AI-generated HTML/JS scripts executing malicious code or stealing cookies. | **Two-Tier Isolation Sandbox:** All HTML artifacts sanitized via `DOMPurify` and mounted inside `<iframe>` configured with `sandbox="allow-scripts"` and strictly **omitting** `allow-same-origin`. |local storage, and DOM tree. |

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

### 3.1 Flow 1: Grounded Conversational QA with JIT Discovery
```
User Enters Query
       │
       ▼
Compute Vector Embedding (all-MiniLM-L6-v2)
       │
       ▼
Query Supabase pgvector (HNSW Cosine Search, threshold >= 0.65)
       │
       ├── Chunks found (>= 0.65) ──► Inject context into Grounded Prompt Template
       │                                     │
       │                                     ▼
       │                              Stream SSE Tokens to Client + Render Citation Cards
       │
       └── 0 Chunks Found
              │
              ▼
       Scan In-Memory Master Catalog (backend/data/episodes_manifest.json)
              │
              ├── No Match (Off-topic or unknown guest)
              │      │
              │      ▼
              │   Return Context-Aware Refusal:
              │   "I do not have sufficient information in Lenny's podcast archive to answer this."
              │
              └── Match Found (e.g. Casey Winters, Christina Wodtke on OKRs)
                     │
                     ▼
                  Execute Flow 5: Just-In-Time (JIT) Episode Ingestion
                     │
                     ▼
                  Re-query Supabase pgvector with newly indexed chunks
                     │
                     ▼
                  Stream Grounded Response + Source Citations
```
* **Acceptance Criteria:**
  1. Every response streams token-by-token over Server-Sent Events (`text/event-stream`).
  2. The UI renders citation badges listing episode title, guest name, and timestamp. Clicking a pill displays the underlying transcript excerpt.
  3. If no relevant chunks meet the $0.65$ similarity threshold and the catalog has no match, the assistant immediately returns: *"I do not have sufficient information in Lenny's podcast archive to answer this."*

### 3.2 Flow 5: Just-In-Time (JIT) Episode Discovery & Additive Ingestion
```
Match Detected in episodes_manifest.json
       │
       ▼
Emit SSE Status: "Found episode for [Guest] in Lenny's archive. Ingesting transcript..."
       │
       ▼
Download raw markdown from Fastly CDN: raw.githubusercontent.com/.../transcript.md
       │
       ▼
Speaker-aware chunking (~400 tokens, 50-token overlap)
       │
       ▼
Compute 384-dim embeddings via all-MiniLM-L6-v2 (batch size 32)
       │
       ▼
Execute Additive Upsert into Supabase pgvector:
  - DELETE FROM transcript_chunks WHERE guest_name = :guest;
  - INSERT INTO transcript_chunks (...) VALUES (...);
       │
       ▼
Emit SSE Status: "Episode indexed. Synthesizing answer..."
       │
       ▼
Re-run retriever.retrieve_relevant_chunks(query) -> Returns top K chunks
```
* **Acceptance Criteria:**
  1. Ingestion is additive and non-destructive: existing episode chunks remain completely intact.
  2. The client receives live SSE status updates as the transcript downloads and embeds.
  3. Total dynamic indexing duration completes in $< 45\text{s}$, and all subsequent queries for that episode execute at sub-second cached speed.

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
     * `Groq Qwen 3.8 27B` (Free Tier)
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
