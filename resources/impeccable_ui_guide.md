# RESOURCE: IMPECCABLE DESIGN SYSTEM & UI ARCHITECTURE

**Source Documentation:** [Impeccable Design: Designing with Impeccable](https://impeccable.style/designing/)  
**Design Reference Image:** Uploaded Loop Diagram (`media_1788581953038.png`)  
**Target Application:** Dual-Pane UI for The Lenny Growth Assistant  

---

## 1. The Impeccable 4-Phase Core Loop

The uploaded diagram outlines the four essential phases of designing with Impeccable:

```
                          [ START ]
               From a blank file, through a brief,
                      to a designed feature.
                                 |
                                 v
        [ MAINTAIN ] <-----------------------> [ ITERATE ]
     Pay down design debt                   Refine in place.
    before it solidifies.                 Command line or browser.
                                 |
                                 v
                          [ POLISH ]
                    The pre-ship gauntlet:
                    Audit, clarify, harden.
```

### Phase 1: Start (Set Context)
* **Goal:** Never start from generic boilerplate ("SaaS slop"). Establish who the interface is for and what problem it solves.
* **Artifacts:**
  * `PRODUCT.md`: Records platform, target user persona (Growth PMs), core value proposition, and key constraints.
  * `DESIGN.md`: Documents design tokens, typography scales, elevation layers, and color palettes.
* **Surface Modes:**
  * **Operate Mode:** Applied to the **Left Chat Pane**. Designed for high scanability, quick task execution, model toggling, and fast input.
  * **Read / Experience Mode:** Applied to the **Right Artifact Drawer**. Designed for distraction-free reading, visual rhythm, copy/export affordances, and interactive sandboxed execution.

### Phase 2: Iterate (Refine in Place)
* When refining existing UI components, apply targeted disciplines rather than broad ambiguous prompts:
  * `/typeset`: Tighten typographic hierarchy, line heights, font pairings (Inter/Albert Sans for UI, Serif for essay reading).
  * `/layout`: Calibrate visual rhythm, margins, flex/grid alignment, and responsive breakpoints.
  * `/colorize`: Replace washed-out grays with intentional slate, zinc, or warm neutral tokens and emerald/accent status badges.
  * `/animate`: Add subtle micro-interactions (smooth drawer sliding, streaming token fade-in, skeleton loaders).

### Phase 3: Polish (The Pre-Ship Gauntlet)
Three mandatory gates before shipping frontend code:
1. **`audit`:** Technical verification across accessibility (ARIA labels, keyboard navigation), responsive layouts (mobile 375px to 4K ultrawide), and performance.
2. **`clarify`:** Polish UX microcopy, tooltips, empty states, and error alerts to sound like a seasoned product director.
3. **`harden`:** Stress-test realistic extremes: 200-word user prompts, 1,250-word streaming essays, network disconnections, and invalid HTML artifact tags.

### Phase 4: Maintain (Prevent Design Drift)
* Prevent component fragmentation (e.g., three different button implementations across chat and artifacts).
* Extract reusable primitives: `MessageBubble`, `CitationPill`, `ModelSelector`, `ArtifactDrawer`, and `SandboxedIframe`.

---

## 2. Impeccable Color Palette & Typography Tokens for Lenny Assistant

```css
/* Core Impeccable Palette */
:root {
  --bg-app: #0B0F17;           /* Deep Obsidian / Dark Slate */
  --bg-surface: #111827;       /* Card and Panel Background */
  --bg-surface-elevated: #1F2937; /* Dropdowns and Modals */
  --border-subtle: #374151;    /* Refined separator borders */
  
  --text-primary: #F9FAFB;     /* High contrast white/slate */
  --text-muted: #9CA3AF;       /* Supporting descriptions */
  --text-accent: #38BDF8;      /* Sky blue interaction highlight */
  
  --badge-emerald-bg: #064E3B; /* Active status pill */
  --badge-emerald-text: #34D399;
  
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
}
```
