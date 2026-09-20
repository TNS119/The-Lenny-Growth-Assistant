# DESIGN SPECIFICATION: THE LENNY GROWTH ASSISTANT

**Design System:** Impeccable Design System  
**Document Version:** 1.2.0  
**Status:** Live & Implemented  
**Target:** Desktop Dual-Pane & Responsive Mobile Workspace  

---

## 1. Visual Identity & Color Palette

### 1.1 Warm Editorial Palette Tokens
The interface employs a Warm Editorial palette engineered for high visual prestige, comfortable reading during deep research sessions, and clear operational contrast:

| Token | Hex Value | Semantic Application |
|---|---|---|
| `palette-cream` | `#F5EBE0` | Light accent highlights, subtle badge glow. |
| `palette-alabaster` | `#EDEDE9` | Elevated card surfaces, neutral borders, tab active indicators. |
| `palette-bone` | `#D6CCC2` | Divider rules, secondary text muted states, input outline. |
| `palette-sand` | `#E3D5CA` | Warm hover states, secondary action buttons. |
| `palette-charcoal` | `#1C1917` | High-contrast text labels, primary content containers. |
| `obsidian-900` | `#0B0F17` | Root canvas background. |
| `obsidian-800` | `#111827` | Sidebar container, message card bubbles, modal backdrop. |
| `obsidian-700` | `#1F2937` | Input toolbar, dropup model selector container, card borders. |
| `brand-teal` | `#14B8A6` | Primary action accent, active provider dot, streaming status glow. |
| `brand-gold` | `#F59E0B` | Ship 30 for 30 skill highlights and artifact indicators. |

---

## 2. Surface Modes & Information Architecture

### 2.1 Operate Mode (Left Chat Pane)
- **Compact & High Contrast:** Uncluttered conversation stream optimized for rapid prompt composition and reading.
- **Embedded Model Selector:** Minimalist DropUp trigger inside the input box (`Ollama (Local)`, `Groq Qwen`, `Gemini Flash`, `Claude Sonnet`, `GPT-4o`) with no distracting vendor logos and masked API keys (`gsk_••••••••••••3x9A`).
- **Slash Command Autocomplete:** Typing `/` dynamically activates the `/ship` autocomplete popup.
- **Real-Time Scenario Status:** Floating status pill displaying live system states:
  - *Searching Lenny's podcast archive...*
  - *Found episode for [Guest] in Lenny's archive. Ingesting transcript...*
  - *Drafting Ship 30 for 30 essay in Artifacts...*
  - *Synthesizing podcast insights...*

### 2.2 Read Mode (Right Artifact Drawer)
- **Editorial Typography:** Newsreader / Georgia serif typography with 1.75 line height for long-form Ship 30 atomic essays.
- **Action Toolbar:** Preview/Code tab toggles, clipboard copy button, full-screen toggle, and dismiss button (`✕`).

### 2.3 Experience Mode (Interactive Tool Sandbox)
- **Security Sandboxing:** Isolated `<iframe>` with `sandbox="allow-scripts"` (strictly omitting `allow-same-origin`) sanitized through `DOMPurify`.
- **Zero Host Contamination:** Host cookies, localStorage, and parent DOM are strictly inaccessible to the artifact scripts.

---

## 3. Strict Typography & Formatting Invariants

1. **No Whitebox Highlighting:** Strictly prohibit white background rectangular highlight boxes behind `<strong>`, `<b>`, or heading elements.
2. **No Emojis in Menus:** Top navigation bars, model dropdowns, system trays, and context menus must use clean, professional plain text typography.
3. **WCAG AA Compliance:** Text-to-background contrast ratio exceeds 4.5:1 across all themes and states.
4. **Responsive Splits:**
   - **Desktop ($> 1024\text{px}$):** Full-height sidebar (`h-screen`) + 55%/45% dual-pane split.
   - **Tablet ($768\text{px} - 1024\text{px}$):** Collapsible sidebar; artifact drawer overlays on activation.
   - **Mobile ($< 768\text{px}$):** Stacked full-width view; artifact opens as an expandable bottom sheet.
