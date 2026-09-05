# PROJECT RESOURCES & TECHNICAL FOUNDATIONS

This directory stores deep-dive technical references, research notes, framework guides, and model benchmarks for **The Lenny Growth Assistant**.

---

## Resource Catalog

| # | Resource File | Description & Linkage | Key Takeaways |
| :--- | :--- | :--- | :--- |
| **1** | [`transcripts_source.md`](file:///c:/Users/nikhi/Downloads/The%20Lenny%20Growth%20Assistant/resources/transcripts_source.md) | **Lenny's Podcast Transcripts Repository**<br>Source: [ChatPRD GitHub](https://github.com/ChatPRD/lennys-podcast-transcripts) | 269 full episode transcripts with YAML frontmatter metadata (`guest`, `title`, `date`, `youtube_url`). Used by `backend/scripts/ingest.py`. |
| **2** | [`ship30_framework.md`](file:///c:/Users/nikhi/Downloads/The%20Lenny%20Growth%20Assistant/resources/ship30_framework.md) | **Ship 30 for 30 Writing Methodology**<br>Source: [Ship 30 Ultimate Guide](https://www.ship30for30.com/post/how-to-start-writing-online-the-ship-30-for-30-ultimate-guide) | Endless Idea Generator, 4A Paths (Actionable, Analytical, Aspirational, Anthropological), "Curating the Experts" credibility stance, ~1,250-word essay structure with bold anchors. |
| **3** | [`claude_agent_sdk_pricing.md`](file:///c:/Users/nikhi/Downloads/The%20Lenny%20Growth%20Assistant/resources/claude_agent_sdk_pricing.md) | **Claude Agent SDK & Pricing Analysis**<br>Source: [Claude Code Docs](https://code.claude.com/docs/en/agent-sdk/overview) | **Anthropic API is NOT free** (pay-per-token credits). Web subscriptions do not include API credits. Clarifies our Dual-Model architecture where local Ollama provides 100% free operation. |
| **4** | [`openai_pricing_investigation.md`](file:///c:/Users/nikhi/Downloads/The%20Lenny%20Growth%20Assistant/resources/openai_pricing_investigation.md) | **OpenAI API Free Tier Investigation**<br>Source: OpenAI Developer Platform | **OpenAI API is ALSO NOT free** (requires minimum $5 prepaid balance, automatic free credits discontinued, ChatGPT Plus does not apply). Confirms Local Ollama as the zero-cost demo requirement. |
| **5** | [`ollama_model_guide.md`](file:///c:/Users/nikhi/Downloads/The%20Lenny%20Growth%20Assistant/resources/ollama_model_guide.md) | **Local Hardware Profiling & Ollama Models**<br>Hardware: AMD Ryzen 7 7735HS, 16GB RAM | Recommends **`llama3.2:3b`** as top fast model (sub-second latency, low RAM) and **`llama3.1:8b`** for full 1,250-word essays. Includes PowerShell pull scripts. |
| **6** | [`impeccable_ui_guide.md`](file:///c:/Users/nikhi/Downloads/The%20Lenny%20Growth%20Assistant/resources/impeccable_ui_guide.md) | **Impeccable Design System & 4-Phase Loop**<br>Source: [Impeccable Designing](https://impeccable.style/designing/) | Core loop (**Start, Iterate, Polish, Maintain**), Surface Modes (**Operate** for Left Chat Pane, **Read/Experience** for Right Artifact Drawer), and design tokens. |
