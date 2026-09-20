# PRODUCT SPECIFICATION: THE LENNY GROWTH ASSISTANT

**Product Name:** LENNY Growth-Assistant  
**Platform:** Web (Next.js 14 App Router, React 18, TypeScript 5, Tailwind CSS 3.4)  
**Document Version:** 1.2.0  
**Status:** Live & Implemented  
**Target Audience:** Growth Product Managers, Heads of Growth, VPs of Product, and Early-Stage Founders  

---

## 1. Product Vision & Executive Summary

**The Lenny Growth Assistant** unlocks over 269 full-length episodes (~2.5M words) of *Lenny’s Podcast*, transforming unstructured audio interviews into verified, source-grounded growth frameworks, high-retention Ship 30 for 30 essays, and sandboxed interactive tools.

Rather than constraining users to a static offline database, the platform features a **Catalog-Driven Just-In-Time (JIT) Episode Discovery Engine**. When users ask about any of the 269 guests or product topics in Lenny's upstream archive, the assistant discovers, downloads, chunks, embeds, and additively indexes the episode into Supabase pgvector on the fly, streaming real-time status updates before synthesizing the answer.

---

## 2. Core Value Propositions

| Capability | Problem Solved | How It Works |
|---|---|---|
| **Just-In-Time Episode Discovery** | Static database limitations; missing episodes. | In-memory catalog (`episodes_manifest.json`) scans 269 episodes in $<2\text{ms}$. Fetches from GitHub Fastly CDN, generates 384-dim embeddings, and additively upserts to Supabase without data loss. |
| **Strict Grounding & Circuit-Breaker** | Hallucinated frameworks and false business advice. | Dual-tier verification: vector cosine similarity ($\ge 0.65$) + catalog matching. Unrelated queries (cooking, sports) trigger immediate context-aware refusal: *"I do not have sufficient information in Lenny's podcast archive to answer this."* |
| **Ship 30 for 30 Content Engine** | Converting technical advice into executive communication. | Triggered via `/ship <topic>`. Produces ~1,250-word atomic essays adhering to Ship 30 heuristics: lines 1–3 hook, short paragraphs, bold anchor keywords, and actionable checklist takeaways. |
| **Sandboxed Claude-Style Workspace** | XSS hazards when rendering AI-generated HTML/JS calculators. | Dual-tier security: `DOMPurify` HTML sanitization + `<iframe>` configured with `sandbox="allow-scripts"` (strictly omitting `allow-same-origin`). Unique origin (`null`) protects cookies and localStorage. |
| **Multi-Model Provider Decoupling** | Dependence on a single LLM or paid frontier API. | Embedded DropUp switcher routing requests between local Ollama (`llama3.2:3b`), Groq Qwen 3.8 27B, Google Gemini 2.0 Flash, Claude 3.5 Sonnet, and GPT-4o with client-side masked API key management. |

---

## 3. Surface Modes & User Journey

### 3.1 Operate Mode (Left Chat Pane)
- **High Scanability:** Compact message bubbles with Warm Editorial typography (`palette-charcoal`, `obsidian-800`).
- **Real-Time Streaming:** Server-Sent Events (SSE) pushing token-by-token deltas with smooth auto-scroll.
- **Dynamic Scenario Indicators:** Status notifications displayed above the conversation:
  - *"Searching Lenny's podcast archive..."*
  - *"Found episode for [Guest] in Lenny's archive. Ingesting transcript..."*
  - *"Drafting Ship 30 for 30 essay in Artifacts..."*
  - *"Building interactive tool artifact..."*
- **Source Citation Cards:** Clickable accordion pills displaying guest name, episode title, and relevance score, expanding to reveal verified transcript excerpts with timestamps.
- **Dynamic Session Management:** Automatically generates concise 36-character session titles from the initial user query.

### 3.2 Read / Experience Mode (Right Artifact Workspace)
- **Automatic Drawer Expansion:** Opens smoothly when the stream detects `<artifact>` tags.
- **Markdown Preview:** Rich editorial serif typography (Newsreader / Georgia) with syntax-highlighted codeblocks and formatted tables.
- **Interactive Tool Execution:** Renders interactive HTML/JS calculators (CAC/LTV payback, viral K-factor simulators) inside a secure sandboxed iframe.
- **Workspace Controls:** Preview/Code tab toggles, one-click clipboard copying, full-screen expansion, and drawer dismiss.

---

## 4. Key Performance & Quality Metrics

- **Retrieval Precision:** $\ge 90\%$ factual attribution accuracy with clickable source badges.
- **Catalog Lookup Latency:** $< 2\text{ms}$ in-memory catalog scan across all 269 episodes.
- **Cached Retrieval Speed:** $< 100\text{ms}$ vector retrieval in Supabase pgvector for indexed episodes.
- **One-Time JIT Indexing:** $< 45\text{s}$ full transcript download, 384-dim embedding generation, and additive database upsert.
- **Refusal Precision:** $100\%$ refusal on out-of-domain queries without hallucinations.
- **Security Invariant:** 0 parent DOM access, 0 cookie leakage, 0 XSS vulnerabilities.
