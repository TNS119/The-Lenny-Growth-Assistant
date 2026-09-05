# DESIGN SPECIFICATION: THE LENNY GROWTH ASSISTANT
## Impeccable UI/UX System & Security Architecture
**Document Version:** 1.0.0  
**Status:** Approved for Implementation  
**Methodology:** Impeccable Design System (v4.2.0)  
**File Location:** `docs/design.md`  

---

## 1. Design Vision & Impeccable Principles

The Lenny Growth Assistant interface is designed as an executive-grade operational workspace for product and growth leaders. Rather than treating AI chat as a generic text-box ("SaaS slop"), the design balances **high-velocity operational control** with **deep, distraction-free reading and tool interaction**.

### 1.1 The Impeccable 4-Phase Design Loop

```
                          [ START ]
               Context captured in PRODUCT.md & DESIGN.md.
                 Surface modes assigned (Operate vs Read).
                                 │
                                 ▼
        [ MAINTAIN ] <───────────────────────> [ ITERATE ]
     Design debt audited                   Refine in place:
     & tokens preserved.                 Typeset, layout, colorize.
                                 │
                                 ▼
                          [ POLISH ]
                    Pre-ship gauntlet:
                    Audit, clarify, harden.
```

1. **Start:** Establish context before writing CSS. Differentiate the user experience into two distinct surface modes: **Operate Mode** for the left chat pane and **Read / Experience Mode** for the right artifact drawer.
2. **Iterate:** Use disciplined visual refinement—precise typography (`/typeset`), purposeful spatial rhythm (`/layout`), intentional obsidian tones (`/colorize`), and smooth transitions (`/animate`).
3. **Polish:** Run the pre-ship gauntlet:
   * **`audit`**: Accessibility (WCAG AA contrast, keyboard navigation), responsive breakpoints, and streaming render performance.
   * **`clarify`**: High-retention microcopy, unambiguous model badges, and informative citation previews.
   * **`harden`**: Stress-test edge cases: 1,250-word streaming bursts, rapid model switching, network disconnects, and unclosed artifact tags.
4. **Maintain:** Eliminate design debt and consolidate tokens into reusable primitives (`MessageBubble`, `CitationPill`, `ModelSelector`, `ArtifactDrawer`, `SandboxedIframe`).

---

## 2. Surface Modes & Information Architecture

The interface utilizes a **Two-Column Split Workspace** that adapts dynamically based on workflow states:

```
+-----------------------------------------------------------------------------------------------+
|                                      APPLICATION TOPBAR                                       |
|  [Logo: Lenny Growth Assistant]       [Mode: QA / Ship 30]   [Model Toggle: Local 3B ▾]  [New] |
+---------------------------------------------------------------+-------------------------------+
|                      LEFT COLUMN                              |         RIGHT COLUMN          |
|                     (OPERATE MODE)                            |     (READ / EXPERIENCE MODE)  |
|                                                               |                               |
|  +---------------------------------------------------------+  |  +-------------------------+  |
|  | Session History Drawer (Collapsible)                    |  |  | Artifact Header Toolbar |  |
|  +---------------------------------------------------------+  |  | [Title] [Preview|Code]  |  |
|                                                               |  | [Copy] [Fullscreen] [✕] |  |
|  +---------------------------------------------------------+  |  +-------------------------+  |
|  | Message Stream                                          |  |  |                         |  |
|  |  - User Query Bubble                                    |  |  |  Rendered Output:       |  |
|  |  - Assistant Stream Bubble                              |  |  |  - React-Markdown (GFM) |  |
|  |  - Citations Accordion (Episode, Guest, Timestamp)      |  |  |    or                   |  |
|  |  - Artifact Generated Callout Pill                      |  |  |  - Sandboxed Iframe     |  |
|  +---------------------------------------------------------+  |  |    (DOMPurify + JS)     |  |
|                                                               |  |                         |  |
|  +---------------------------------------------------------+  |  |                         |  |
|  | Prompt Input Box with Action Buttons                    |  |  |                         |  |
|  +---------------------------------------------------------+  |  +-------------------------+  |
+---------------------------------------------------------------+-------------------------------+
```

### 2.1 Left Column: Operate Mode (Chat & Controls)
* **Design Intent:** Optimized for fast task execution, rapid prompt submission, and quick scanning.
* **Key Components:**
  * **Session Sidebar:** Collapsible drawer managing independent conversational threads.
  * **Interactive Model Selector:** Dropdown in the header displaying current LLM with live status badge (`Local: llama3.2:3b`, `Claude 3.5 Sonnet`, `GPT-4o`, `Groq Llama 3.3`, `Gemini 2.0`).
  * **Mode Switcher:** Toggle between **Grounded QA** (fast tactical answers) and **Ship 30 for 30** (1,250-word structured essays).
  * **Citations Accordion:** Expandable source pill beneath assistant responses showing guest names, episode titles, and verified timestamps. Clicking displays the exact transcript snippet.

### 2.2 Right Column: Read / Experience Mode (Artifact Drawer)
* **Design Intent:** Optimized for distraction-free reading of 1,250-word strategic essays or active manipulation of interactive tools (calculators, simulators).
* **Behavior:**
  * **Auto-Open:** Automatically slides open when the backend streams an `<artifact>` tag.
  * **State Persistence:** Remains open until explicitly dismissed by the user.
  * **Toolbar Controls:**
    * *Preview / Code Toggle:* Switch between visual rendered view and syntax-highlighted raw source code.
    * *Copy Code:* One-click clipboard copy with visual checkmark feedback.
    * *Fullscreen Mode:* Expands the drawer to 100% viewport width for detailed tool interaction.
    * *Close (Esc):* Collapses drawer back into the right edge.

---

## 3. Design Tokens & Visual Hierarchy

### 3.1 Color Palette (Obsidian Slate Theme)

| Token Name | Hex Value | Semantic Usage |
| :--- | :--- | :--- |
| `--bg-base` | `#0B0F17` | Canvas background (ultra-dark obsidian). |
| `--bg-surface` | `#111827` | Card surfaces, chat bubbles, sidebar background. |
| `--bg-surface-elevated` | `#1F2937` | Dropdowns, dialogs, hovering states, input bar. |
| `--border-subtle` | `#1F2937` | Low-contrast dividing borders. |
| `--border-accent` | `#374151` | Active focus rings, selected session borders. |
| `--text-primary` | `#F9FAFB` | Primary headers, assistant body text. |
| `--text-secondary` | `#9CA3AF` | Supporting labels, timestamps, citations text. |
| `--text-muted` | `#6B7280` | Subtle metadata, inactive icons. |
| `--accent-primary` | `#38BDF8` | Sky blue for primary actions, active tabs, focus indicators. |
| `--accent-emerald` | `#10B981` | Positive statuses, local Ollama connected pill. |
| `--badge-bg-emerald` | `#064E3B` | Background for live local model status pill. |
| `--accent-warning` | `#F59E0B` | Fallback warning, missing cloud key indicator. |

### 3.2 Typography System

```css
/* Typography Configuration */
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-serif: 'Newsreader', 'Merriweather', Georgia, serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;
```

* **UI & Controls (Sans):** Inter handles all buttons, labels, inputs, and short conversational messages for maximum legibility at small sizes.
* **Ship 30 for 30 Essays (Serif Option):** Long-form reading inside the Artifact Drawer switches to a refined serif face with generous 1.75 line-height, emulating a published newsletter.
* **Code & Artifact Markup (Mono):** JetBrains Mono for syntax-highlighted HTML, CSS, JavaScript, and Markdown code inspection.

### 3.3 Spatial Rhythm & Breakpoints

* **Base Unit:** 4px grid system (`gap-2` = 8px, `p-4` = 16px, `p-6` = 24px).
* **Responsive Breakpoints:**
  * **Desktop ($> 1024\text{px}$):** Dual-pane split layout. Left pane takes 55–60% width, Right Artifact Drawer takes 40–45% width.
  * **Tablet ($768\text{px} \text{--} 1024\text{px}$):** Left pane takes full width; Artifact Drawer slides in as a 70% overlay with backdrop blur.
  * **Mobile ($< 768\text{px}$):** Stacked full-width view. When an artifact is opened, it slides up as a full-screen sheet with an easily accessible close button.

---

## 4. UI State Machine & Interaction Transitions

```
[IDLE STATE]
    │  User inputs prompt & presses Send
    ▼
[SEARCHING STATE]
    │  Displays subtle pulsing indicator: "Searching Lenny's Podcast transcripts..."
    │  Backend executes HNSW cosine vector search
    ▼
[STREAMING TOKENS STATE]
    │  SSE stream pushes tokens delta-by-delta
    │  Message bubble auto-scrolls smoothly
    │  Citations accordion appears with retrieved episode sources
    ▼
[ARTIFACT DETECTED STATE]
    │  Parser detects <artifact type="html|markdown" title="...">
    │  Artifact Drawer automatically expands smoothly (300ms cubic-bezier transition)
    │  Live tokens route into the Artifact Drawer
    ▼
[COMPLETION & PERSISTENCE STATE]
    │  Closing tag </artifact> received
    │  Iframe sandbox mounts and executes scripts safely
    │  Artifact metadata saved to PostgreSQL
```

---

## 5. Security & Sandbox Isolation Architecture

Rendering arbitrary HTML/JS tools inside a user’s browser requires defense-in-depth to eliminate security vulnerabilities:

```
                  +-------------------------------------------------------+
                  |                 Raw Assistant Stream                  |
                  +---------------------------+---------------------------+
                                              |
                                              v
                  +-------------------------------------------------------+
                  |          Tier 1: DOMPurify HTML Sanitization          |
                  |  - Removes <meta http-equiv="refresh">, malicious     |
                  |    event handlers, and cross-site framing.            |
                  |  - Preserves standard HTML5, CSS, and safe <script>.  |
                  +---------------------------+---------------------------+
                                              |
                                              v
                  +-------------------------------------------------------+
                  |         Tier 2: Hardened Sandboxed Iframe             |
                  |                                                       |
                  |   <iframe                                             |
                  |     srcdoc={cleanHtml}                                |
                  |     sandbox="allow-scripts"                           |
                  |   />                                                  |
                  |                                                       |
                  |   * Strict Security Guarantee:                        |
                  |     - allow-scripts: Enables interactive calculators  |
                  |     - OMISSION of allow-same-origin:                  |
                  |       Forces iframe into a unique origin (null).      |
                  |       Completely BLOCKS access to:                    |
                  |         • parent window.localStorage / sessionStorage |
                  |         • parent document.cookie (No session hijacking|
                  |         • parent DOM tree (No UI redressing)          |
                  |         • parent /api/ network endpoints              |
                  +-------------------------------------------------------+
```

---

## 6. Accessibility & Impeccable Quality Checks

* **Keyboard Navigation:** Full Tab-key cycling across interactive controls. Pressing `Esc` immediately dismisses the Artifact Drawer or Source modals.
* **Screen Reader Support:** All buttons feature descriptive `aria-label` attributes (e.g., `aria-label="Copy artifact source code"`).
* **Color Contrast:** All text-to-background combinations meet or exceed WCAG 2.1 AA standards (minimum contrast ratio of 4.5:1 for normal text).
* **Focus States:** High-visibility sky blue focus rings (`ring-2 ring-sky-400/50`) on all interactive inputs and buttons.
