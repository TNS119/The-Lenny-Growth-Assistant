# DESIGN.md - Impeccable Design System

## Visual Identity
**Coolors Trending Palette: "Deep Blue Sea & Gold"** ([coolors.co/palette/0b132b-1c2541-3a506b-5bc0be-6fffe9](https://coolors.co/palette/0b132b-1c2541-3a506b-5bc0be-6fffe9))
- **Base Canvas:** Prussian Navy (`#0B132B`) & Deep Indigo (`#070D1F`)
- **Elevated Surfaces:** Space Indigo (`#1C2541`) & Midnight Slate (`#131C38`)
- **Dividers & Structural Borders:** Dusk Blue (`#3A506B`) & Slate Accent (`#2B3A5A`)
- **Primary Interaction / QA Mode:** Tropical Teal (`#5BC0BE`) & Aquamarine Glow (`#6FFFE9`)
- **Ship 30 for 30 Content Engine:** Amber Gold (`#FCA311`)
- **Typography:** High-contrast Crisp Slate White (`#F0F4F8`) and Secondary Slate (`#8D99AE`)

## Surface Modes & Vocabulary
- **Operate Mode (Chat Pane):** Crisp contrast, compact message grouping, interactive citation pills, and clean action bars.
- **Read Mode (Artifact Drawer):** Generous line height (1.75), rich serif typography for long-form essays, and clear section dividers.
- **Experience Mode (Interactive Tools):** Isolated sandboxed iframe (`sandbox="allow-scripts"` without `allow-same-origin`) executing calculators and formulas safely.

## Component Rules
- Buttons: Rounded-lg, subtle borders (`border-obsidian-700`), smooth hover transitions to `#5BC0BE` (Teal) or `#FCA311` (Gold).
- Badges: Emerald for live local Ollama status; Tropical Teal for active QA mode; Amber Gold for Ship 30 for 30 writing framework.
- Citations: Clickable cards displaying guest, episode, and relevance score; expands to reveal verbatim transcript excerpt.
- Anti-patterns: Never permit unstyled tables, low-contrast text (<4.5:1), unhandled errors, or jarring layout shifts.
