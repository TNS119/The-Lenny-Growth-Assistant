# PRODUCT REQUIREMENTS DOCUMENT (PRD)
## The Lenny Growth Assistant
**Document Version:** 1.0.0  
**Status:** Approved for Implementation  
**Role:** Forward Deployed Engineer (FDE)  
**File Location:** `docs/PRD.md`  

---

## 1. Executive Brief & Problem Statement

### 1.1 The Operational Challenge
Product managers, growth leaders, and startup founders operate under intense pressure to formulate and execute high-stakes growth strategies: pricing revamps, viral loop mechanics, product-led onboarding funnels, and retention flywheels. *Lenny’s Podcast* is the tech industry’s most authoritative operational archive, featuring over 200+ hours of candid, tactical interviews with elite operators (e.g., Brian Chesky, Elena Verna, Shreyas Doshi, Julie Zhuo). 

However, this critical knowledge remains locked in dense audio and linear transcripts:
1. **Information Density & Discovery Friction:** An operator with a specific tactical question (e.g., *"How do early-stage B2B freemium apps prevent churn during seat-tier upgrades?"*) cannot afford to listen to 90-minute episodes or manually search unindexed transcripts.
2. **The Hallucination & Speculation Trap:** Generic commercial LLMs generate plausible-sounding but ungrounded advice that lacks operational authenticity and source validation.
3. **The Actionability Gap:** Standard conversational chat outputs text answers that remain theoretical. Operators need structured, high-retention essays (using proven frameworks like *Ship 30 for 30*) or interactive tools (calculators, simulators) they can share with their teams immediately.
4. **Client-Side Security Vulnerabilities:** Rendering AI-generated HTML/CSS tools directly in a web application introduces severe Cross-Site Scripting (XSS) and credential exfiltration hazards.

### 1.2 The Solution
**The Lenny Growth Assistant** is an enterprise-grade, retrieval-augmented generation (RAG) web application. It ingests the complete transcript archive of *Lenny’s Podcast*, indexes it into PostgreSQL with `pgvector` HNSW cosine similarity search, and provides:
* **Grounded, source-attributed answers** citing guests and timestamps.
* A deterministic refusal circuit-breaker for out-of-domain topics.
* A **Ship 30 for 30 Content Engine** that transforms answers into structured, 1,250-word essays.
* A **Side-by-Side Claude-Style Artifact Viewer** running interactive tools inside a hardened, isolated container (`sandbox="allow-scripts"` without `allow-same-origin`, sanitized via `DOMPurify`).
* A **Dual Model Layer** supporting 100% free local inference via Ollama (`llama3.2:3b` / `llama3.1:8b`) alongside cloud providers (Claude 3.5 Sonnet, OpenAI GPT-4o, and free Groq/Gemini).

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

## 3. Measurable Success Metrics

| Metric ID | Dimension | Target | Measurement Method |
| :--- | :--- | :--- | :--- |
| **M-01** | **Retrieval Citation Accuracy** | $\ge 90\%$ | Proportion of factual claims in Grounded QA mode containing a valid `[Episode: Guest Name, Timestamp/Topic]` citation verified against retrieved chunks. |
| **M-02** | **Grounded Refusal Precision** | $100\%$ | Strict circuit-breaker trigger on out-of-domain queries (all chunks $< 0.65$ cosine similarity), returning: *"I do not have sufficient information in Lenny's podcast archive to answer this."* |
| **M-03** | **Local Inference Latency** | $< 4.0\text{s}$ | Time-to-First-Token (TTFT) when streaming from local Ollama (`llama3.2:3b`) on standard 8-core CPU / 16 GB RAM hardware. |
| **M-04** | **Artifact Security & Isolation** | **0 XSS Vulnerabilities** | Zero access to parent DOM, cookies (`document.cookie`), or local storage (`localStorage`) from within generated HTML artifacts. Verified via penetration tests. |
| **M-05** | **Ship 30 for 30 Heuristic Adherence** | $\ge 95\%$ | Word count between 1,100–1,400 words, hook present in lines 1–3, paragraphs $\le 3$ sentences, bold anchors on bullet points, and an operational checklist conclusion. |
| **M-06** | **Operational Time-to-Demo** | $< 5$ minutes | Time required for an evaluator to run `docker-compose up` and access the live application on a clean machine. |

---

## 4. Discovery Assumptions, Scope Boundaries & Trade-offs

### 4.1 Key Assumptions
1. **Transcript Source:** The primary knowledge base consists of pre-transcribed text archives from the public repository `ChatPRD/lennys-podcast-transcripts` (269 episodes). Live real-time audio transcription is not required.
2. **Access & Security:** The application is an internal operational tool deployed inside an engineering perimeter. Authentication and SSO are assumed to be handled by an enterprise reverse proxy or VPN; the application focuses on multi-session state isolation.
3. **Local Evaluation Environment:** The evaluator’s machine has Ollama installed with at least 16 GB RAM. The default local evaluation model is `llama3.2:3b` to prevent memory thrashing.
4. **Cloud API Billing:** Commercial frontier APIs (Anthropic Claude, OpenAI) are paid. To ensure evaluators can test cloud streaming without incurring charges, free cloud endpoints (Groq `llama-3.3-70b-versatile` and Google Gemini `gemini-2.0-flash`) are integrated into the cloud layer.

### 4.2 Scope Boundaries

#### In Scope
* **Ingestion Pipeline:** Automated downloader and chunking script (`ingest.py`) with recursive splitting ($500\text{--}800$ tokens, $100$-token overlap), dense embeddings (`all-MiniLM-L6-v2`), and PostgreSQL `pgvector` HNSW indexing.
* **Dual Model Layer:** Pluggable LLM interface (`BaseLLMProvider`) driving local Ollama and cloud providers with interactive in-between toggling in the UI.
* **RAG Retrieval Engine:** Asynchronous cosine similarity search with a hard $0.65$ similarity score threshold.
* **Ship 30 for 30 Skill:** Dedicated prompt engineering compiler applying the 4A paths, curiosity hooks, and bold anchor formatting.
* **Side-by-Side Artifact Viewer:** Claude-style split screen with Markdown syntax rendering and sandboxed `<iframe>` isolation (`sandbox="allow-scripts"` without `allow-same-origin`) sanitized via `DOMPurify`.
* **FastAPI Persistence:** PostgreSQL persistence for sessions, multi-turn messages with JSONB source citations, and generated artifacts.
* **Deployment & Testing:** Docker Compose multi-service setup, comprehensive pytest suite, and agent transcript logs.

#### Out of Scope (Intentionally Excluded)
* **Real-time Audio Streaming:** Live podcast recording or Whisper audio processing on the fly.
* **Unbounded Web Search:** The assistant does not search Google or Wikipedia; its authority is strictly bounded to *Lenny’s Podcast* archive.
* **Multi-tenant Billing / Payment Processing:** No Stripe or SaaS subscription billing logic.

### 4.3 Technical Trade-offs & Rationale
* **Local 3B/8B Models vs. Frontier Cloud Models:**  
  * *Trade-off:* 3B/8B local models have smaller context windows and higher sensitivity to complex formatting compared to Claude 3.5 Sonnet.  
  * *Decision:* Use `llama3.2:3b` for fast, zero-cost local evaluation and provide an instant UI toggle to Claude 3.5 Sonnet or Groq 70B for deep essay and code generation.
* **HNSW Vector Indexing vs. Exact Flat Search (IVFFlat):**  
  * *Trade-off:* HNSW consumes slightly more RAM during index construction but delivers logarithmic search latency ($O(\log N)$).  
  * *Decision:* Implement HNSW (`m=16, ef_construction=64`) to guarantee sub-50ms vector retrieval on multi-thousand chunk corpora.
* **Sandboxed Iframe (`allow-scripts`) vs. Direct DOM Injection:**  
  * *Trade-off:* Rendering HTML directly in the parent React DOM allows full styling inheritance but creates an open attack vector for XSS and cookie theft.  
  * *Decision:* Mount a sandboxed iframe with `sandbox="allow-scripts"` and strictly omit `allow-same-origin`. This forces the iframe into a unique origin (`null`), completely walling off parent cookies, local storage, and session tokens while allowing interactive JavaScript to function.

---

## 5. Functional Requirements & User Flows

### 5.1 Flow 1: Grounded Conversational QA
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

### 5.2 Flow 2: Ship 30 for 30 Essay Generation
```
User Selects "Ship 30 for 30" Mode & Submits Topic
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
Stream High-Retention Essay to Chat & Store Snapshot in Database
```
* **Acceptance Criteria:**
  1. Output adheres to the structural heuristics of the Ship 30 for 30 guide.
  2. Claims are attributed directly to episode guests.
  3. Formatted with H2/H3 headers, bullet lists with bold anchors, and single-sentence impact lines.

### 5.3 Flow 3: Claude-Style Artifact Generation & Viewing
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

### 5.4 Flow 4: Interactive In-Between Model Toggle
* **Acceptance Criteria:**
  1. The UI header includes a model selector dropdown populated with:
     * `Ollama (Local) - llama3.2:3b` (Default)
     * `Claude 3.5 Sonnet`
     * `OpenAI GPT-4o`
     * `Groq Llama 3.3 70B (Free)`
     * `Google Gemini 2.0 Flash (Free)`
  2. Switching models does not interrupt active chat history or reset the session.
  3. The request header `X-LLM-Provider` or body parameter `provider` routes the subsequent request to the selected engine.
  4. If a cloud key is missing, the backend emits a status warning event and falls back to local Ollama seamlessly.

---

## 6. Non-Functional Requirements (NFRs)

* **Performance:** Sub-second TTFT ($< 1.0\text{s}$) on local Ollama `llama3.2:3b`; sub-50ms vector retrieval in pgvector.
* **Reliability & Resilience:** All exceptions (network timeouts, unpulled Ollama models, DB connection drops) return structured JSON errors with human-actionable troubleshooting advice.
* **Security:** Strict iframe sandbox attributes, DOMPurify HTML sanitization, zero committed credentials, and environment-driven secrets.
* **Usability & Design:** Built following the Impeccable UI methodology in dark slate Obsidian (`#0B0F17`), with accessible color contrast (WCAG AA), responsive breakpoints (mobile, tablet, desktop), and full keyboard navigation.
