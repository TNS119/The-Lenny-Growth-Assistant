# Agent Transcript 02: UI Refinement, Security Hardening & Layout Invariants

## Overview
This transcript records the frontend UI/UX iteration, Impeccable Design System integration, Claude-style Sandboxed Artifact Drawer implementation, dynamic session titling, and defense-in-depth sanitization.

---

## Key Challenges, Failures & Resolutions

### 1. Artifact Tag Leakage into Conversational Stream
- **Issue:** The LLM streamed raw `<artifact type="html" title="...">` tags directly into the chat bubble before closing tags arrived, resulting in broken Markdown and unstyled XML blocks in the chat thread.
- **Attempted Fix:** Simple regex replacement on the completed message text.
- **Failure:** During live SSE token streaming, intermediate chunks still exposed partial tags in the UI.
- **Resolution:** Implemented a two-stage stream parser in `useChatStream.ts` that intercepts `<artifact>` tags in real-time, routes the inner code to the dedicated `ArtifactViewer` state store, and cleans the conversational narrative with `clean_response_text()` and `clean_artifact_content()`.

### 2. Sandboxed HTML Execution & XSS Prevention
- **Issue:** Executing user-requested HTML/JS calculators (such as CAC/LTV or K-factor simulators) directly in the React DOM risked Cross-Site Scripting (XSS) and access to parent `document.cookie` / `localStorage`.
- **Resolution:** Mounted artifacts inside `SandboxedIframe.tsx` using `sandbox="allow-scripts"` and strictly **omitting** `allow-same-origin`. This forces the iframe into a unique origin (`null`), blocking access to parent state while sanitizing all markup through `DOMPurify`.

### 3. Layout Restructuring & Full-Height Sidebar
- **Issue:** Header navbar was overlapping or improperly wrapping over the collapsible session sidebar.
- **Resolution:** Restructured `frontend/src/app/page.tsx` into a root horizontal flex container (`h-screen w-screen`). The sidebar `<aside>` spans the full height top-to-bottom on the left, while the main container hosts `<header>` starting strictly to the right of the sidebar.

### 4. Embedded DropUp Model Switcher & Masked Keys
- **Issue:** Bulky model switchers in the header crowded the navigation and exposed raw API keys during configuration.
- **Resolution:** Embedded the model switcher directly into the chat input box toolbar as a clean DropUp menu. Replaced plain password toggles with masked preview formatting (`gsk_••••••••••••3x9A`) and non-blinking configuration badges.

---

## Resulting State
- Full-height sidebar with dynamic initial-query session naming.
- Seamless Warm Editorial theme (`#F5EBE0`, `#EDEDE9`, `#D6CCC2`, `#E3D5CA`, `#1C1917`) with 0 white rectangular highlight boxes.
- Production build passing with 0 TypeScript/ESLint errors.
