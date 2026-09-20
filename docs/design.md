# DESIGN SPECIFICATION: THE LENNY GROWTH ASSISTANT
## Impeccable UI/UX System & Security Architecture
**Document Version:** 1.1.0  
**Status:** Approved for Implementation  
**Methodology:** Impeccable Design System (`impeccable` skill)  
**File Location:** `docs/design.md`  

---

## 1. Design Vision & Impeccable Principles

The Lenny Growth Assistant interface is built following the **Impeccable Design Methodology**. It transitions AI interaction from a generic, unstyled text-box into a purposeful, high-retention operational workspace for growth and product leaders.

### 1.1 The Impeccable 4-Phase Loop
```
                          [ START ]
               Context captured in PRD & Design Spec.
               Surface modes assigned: Operate vs Read.
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

1. **Start:** Clearly decouple user contexts into two dedicated surface modes:
   - **Operate Mode (Left Pane):** High-velocity prompt composition, model selection, citation exploration, and session history management.
   - **Read / Experience Mode (Right Drawer):** Deep reading of 1,250-word atomic essays and live interaction with sandboxed HTML/JS calculators.
2. **Iterate:** Disciplined visual hierarchy using the Warm Editorial color tokens, precise typographic contrast, and responsive layout splits.
3. **Polish:** Run the pre-ship gauntlet:
   - **`audit`**: WCAG AA contrast compliance, zero-whitebox bold text rendering, full keyboard navigation.
   - **`clarify`**: Unambiguous status indicators (`Local (Free)`, `Free Tier`), masked key management (`gsk_••••••••••••3x9A`), and timestamped citation previews.
   - **`harden`**: Defense-in-depth sanitization preventing raw XML tag leakages during intermediate SSE token bursts.
4. **Maintain:** Persist design invariants across `AGENTS.md` and component interfaces (`page.tsx`, `ChatPane.tsx`, `ModelSelector.tsx`, `ArtifactViewer.tsx`, `SandboxedIframe.tsx`).

---

## 2. Information Architecture & Workspace Hierarchy

The application features a full-height collapsible sidebar and a dynamic split workspace:

```
+---------------------------------------------------------------------------------------------------------+
| [FULL-HEIGHT SIDEBAR]  |                                 MAIN CONTAINER                                 |
|                        | +----------------------------------------------------------------------------+ |
|                        | | [TOP HEADER]: [Toggle Panel] [LENNY Growth-Assistant] [Artifact Drawer ✕] | |
|                        | +----------------------------------------------------------------------------+ |
|                        | |             LEFT COLUMN (OPERATE)           |    RIGHT COLUMN (READ/EXP)   | |
|                        | |                                             |                              | |
| - LENNY Logo & Tagline | |  +---------------------------------------+  |  +-------------------------+ | |
| - "+ New Chat" Button  | |  | Message Thread                        |  |  | Artifact Header Toolbar | | |
| - Dynamic Sessions List| |  |  - User Query Bubble                  |  |  | [Title] [Preview|Code]  | | |
|   (Named by Query)     | |  |  - Assistant Stream Bubble            |  |  | [Copy] [Fullscreen] [✕] | | |
| - Settings & Status    | |  |  - Source Citation Pills              |  |  +-------------------------+ | |
|                        | |  +---------------------------------------+  |  | Sandboxed Iframe /      | | |
|                        | |  | Input Toolbar & DropUp Model Selector |  |  | React-Markdown Render  | | |
|                        | |  | [/ship Slash Command Autocomplete]    |  |  | (DOMPurify Isolated)   | | |
|                        | |  +---------------------------------------+  |  +-------------------------+ | |
+------------------------+-----------------------------------------------+------------------------------+
```

---

## 3. Design Tokens & Visual Hierarchy

### 3.1 Warm Editorial Palette Tokens

| Token Name | Hex Value | Semantic Role |
| :--- | :--- | :--- |
| `palette-cream` | `#F5EBE0` | Light-mode accent and background highlights. |
| `palette-alabaster`| `#EDEDE9` | Elevated card surfaces and neutral dividers. |
| `palette-bone` | `#D6CCC2` | Subtle borders, active item indicators. |
| `palette-sand` | `#E3D5CA` | Secondary badge backgrounds and hover states. |
| `palette-charcoal`| `#1C1917` | High-contrast body typography, dark obsidian surfaces. |
| `obsidian-900` | `#0B0F17` | Deep canvas background. |
| `obsidian-800` | `#111827` | Sidebar and message card container background. |
| `obsidian-700` | `#1F2937` | Input container, dropup switcher background, modal dialogs. |
| `brand-teal` | `#14B8A6` | Primary brand action color, active model indicators. |

### 3.2 Typography & Formatting Invariants
- **Primary Body Font:** Inter / system-ui sans-serif for UI labels, buttons, and fast conversational scanning.
- **Artifact / Essay Font:** Newsreader / Georgia serif for high-retention long-form Ship 30 essays.
- **Code & Raw Markup:** JetBrains Mono for syntax-highlighted codeblocks and HTML inspection.
- **Strict Prohibition:** Absolutely no white rectangular background boxes behind `<strong>`, `<b>`, or heading elements.

---

## 4. Key Interaction States & UI State Machine

```
[IDLE STATE]
    │  User inputs prompt (or triggers "/ship <topic>") & clicks Send
    ▼
[SEARCHING STATE]
    │  Pulsing indicator: "Searching Lenny's podcast archive..."
    │  Backend executes HNSW cosine vector search (threshold >= 0.65)
    │
    ├── Chunks Found (>= 0.65) ────────────────────────┐
    │                                                   │
    └── 0 Chunks Found                                  │
         │                                              │
         ▼                                              │
    [JIT CATALOG SCAN]                                  │
         │                                              │
         ├── No Match (Off-topic/unrelated)             │
         │    │                                         │
         │    ▼                                         │
         │   [REFUSAL STATE]                            │
         │   "I do not have sufficient information..."  │
         │                                              │
         └── Match in 269-Episode Catalog               │
              │                                         │
              ▼                                         │
         [JIT INGESTION STATE]                          │
              │ Status: "Found episode for [Guest]...   │
              │ Ingesting transcript..."                │
              │ Downloads CDN -> Chunks -> Embeds       │
              │ Additive Supabase upsert                │
              │ Re-retrieves fresh chunks               │
              ▼                                         │
[STREAMING TOKENS STATE] <──────────────────────────────┘
    │  SSE stream pushes tokens delta-by-delta
    │  Message bubble auto-scrolls smoothly; citations accordion appears with retrieved episode sources
    ▼
[ARTIFACT DETECTED STATE]
    │  Backend streams <artifact type="html|markdown" title="..."> tag
    │  useChatStream parser intercepts tag, auto-opens ArtifactDrawer, routes code to viewer
    ▼
[RENDER / PREVIEW COMPLETE]
    │  Closing tag </artifact> received
    │  HTML/JS: Sanitized via DOMPurify & rendered in Sandboxed Iframe (sandbox="allow-scripts")
    │  Markdown: Rendered via react-markdown with remark-gfm
```

---

## 5. Responsive Behavior & Accessibility (WCAG AA)

1. **Desktop ($> 1024	ext{px}$):** Full-height sidebar (`h-screen`) on left + side-by-side chat and artifact workspace (55%/45% split).
2. **Tablet ($768	ext{px} 	ext{--} 1024	ext{px}$):** Collapsible sidebar toggleable via `PanelLeft` icon; artifact drawer slides in as an overlay.
3. **Mobile ($< 768	ext{px}$):** Stacked full-width view. Artifact drawer opens as a full-screen bottom sheet with close toggle.
4. **Accessibility:**
   - Color contrast exceeds 4.5:1 ratio across all text elements.
   - Full keyboard navigation with `Escape` to close drawers/modals, `Tab` for slash command autocomplete, and `Enter` to submit.
   - Screen-reader accessible ARIA roles and labels on all interactive buttons.
