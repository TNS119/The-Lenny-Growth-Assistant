# RESOURCE: CLAUDE AGENT SDK & ANTHROPIC PRICING ANALYSIS

**Reference URL:** [Claude Code Agent SDK Documentation](https://code.claude.com/docs/en/agent-sdk/overview)  
**Provider:** Anthropic  

---

## 1. Important Notice: Claude Agent SDK & API Pricing Model

> [!CAUTION]
> **Anthropic Claude API & Claude Agent SDK are NOT free.**  
> There is **no permanent free tier** for programmatic API access.

### 1.1 Commercial Billing Structure
* **Pay-as-You-Go:** The Anthropic API and Claude Agent SDK charge per million tokens processed (both input prompt tokens and output completion tokens).
* **Current Anthropic Model Pricing (Standard Tier):**
  * **Claude 3.5 Sonnet (`claude-3-5-sonnet-20241022`):**
    * Input Tokens: **$3.00 / million tokens**
    * Output Tokens: **$15.00 / million tokens**
    * Context Caching: ~$0.30/MTok cache read, ~$3.75/MTok cache write
  * **Claude 3.5 Haiku:**
    * Input Tokens: **$0.80 / million tokens**
    * Output Tokens: **$4.00 / million tokens**
  * **Claude 3 Opus:**
    * Input Tokens: **$15.00 / million tokens**
    * Output Tokens: **$75.00 / million tokens**

### 1.2 Subscription vs. API Credits
* Having a **Claude Pro** or **Claude Max** consumer web subscription ($20/month for claude.ai) **does not grant API tokens**. API access requires a separate Anthropic Developer Console account backed by a funded payment card.
* Some newly registered Anthropic Developer accounts receive a temporary **$5.00 initial trial credit**, but once exhausted, calls will fail with `429 insufficient_quota` or `402 payment_required` unless a credit card is attached.

---

## 2. Project Architecture & The 100% Free Local Solution

Because of the paid nature of Anthropic’s API, **The Lenny Growth Assistant** is specifically architected with a **Dual Model Layer**:

1. **Local Model (Ollama) — 100% FREE & Mandatory for Evaluation:**
   * Runs directly on your machine's hardware with **zero API fees**, zero rate limits, and full data privacy.
   * Completely sufficient for running the evaluators' test suite and video demo.
2. **Cloud Model (Claude 3.5 Sonnet) — Optional Enterprise Extension:**
   * Plug-and-play via `ANTHROPIC_API_KEY` in `.env`.
   * If the API key is absent or credits expire, the system automatically falls back to local Ollama without crashing.

---

## 3. Claude Code Agent SDK Architecture Overview

When an API key is provided, the Claude Agent SDK functions as an orchestration primitive:
* **Tool Calling & Agentic Loops:** Supports tool declarations with JSON schema validation.
* **Context Compaction:** Manages multi-turn conversation memory with sliding windows.
* **Streaming Responses:** Provides asynchronous event streams yielding token deltas and tool call events directly into FastAPI.
