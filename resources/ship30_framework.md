# RESOURCE: THE SHIP 30 FOR 30 WRITING FRAMEWORK & SKILL SPEC

**Source Guide:** [How To Start Writing Online: The Ship 30 for 30 Ultimate Guide](https://www.ship30for30.com/post/how-to-start-writing-online-the-ship-30-for-30-ultimate-guide)  
**Authors:** Nicolas Cole & Dickie Bush  
**Application in Project:** `backend/app/skills/ship30_writer.py` (Ship 30 Content Engine)

---

## 1. Core Philosophy: Digital Writer vs. Legacy Writer

The Ship 30 for 30 methodology rejects the "cabin in the woods" myth of legacy writing in favor of rapid, public iteration:
* **Practice in Public:** Publish small, validated atomic pieces rather than spending a year writing in isolation.
* **Rapid-Fire Feedback Loops:** Treat your writing like a startup. Make small bets, inspect engagement metrics, double down on what resonates.
* **Clarity as a Forcing Function:** Writing clarifies thinking; publishing stress-tests how that thinking connects with audience problems.

---

## 2. The Endless Idea Generator: The 4-Step Heuristic

The core framework in Ship 30 is the **Endless Idea Generator**, which eliminates writer's block by systematically compounding a single seed topic into hundreds of actionable essays:

### Step 1: Radical Specificity
Never write about broad abstractions like "Growth" or "Pricing". Drill down until you cannot get any more specific:
* *Level 1 (General):* "Pricing"
* *Level 2 (Better):* "B2B SaaS Pricing"
* *Level 3 (Good):* "B2B SaaS Pricing for Self-Serve Freemium Products"
* *Level 4 (Ship 30 Grade):* "How early-stage B2B freemium apps can raise prices by 20% without churn by anchoring on seat usage tiers."

### Step 2: The 3 Types of Credibility
Readers always ask: *"Why should I listen to you?"* There are three legitimate credibility postures online:
1. **"I am the expert"** (Personal multi-decade operational track record).
2. **"I am curating the experts"** (*This is the exact stance of The Lenny Growth Assistant!* We synthesize vetted wisdom from Brian Chesky, Elena Verna, Shreyas Doshi, etc.).
3. **"I am sharing personal experience"** (Firsthand experiment or journey).

### Step 3: The 4A Paths
Every topic can be explored through one of four primary narrative lenses:
1. **Actionable (Here's How):** Step-by-step tactics, processes, frameworks, how-to playbooks.
2. **Analytical (Here Are The Numbers):** Data teardowns, metrics, benchmarks, case study statistics.
3. **Aspirational (Yes, You Can):** Mindset, career ambition, overcoming plateaus, strategic vision.
4. **Anthropological (Here's Why):** Deep human psychology, organizational dysfunctions, behavioral incentives.

### Step 4: The Proven Approach
Structure the body with rhythmic predictability:
* *How-To:* Organized strictly in **Steps** (Step 1, Step 2, Step 3).
* *Retrospective:* Organized in **Lessons Learned** (Lesson #1, Lesson #2).
* *Teardown:* Organized in **Mistakes** (Mistake #1, Mistake #2).
* *Operational:* Organized in **Tactical Frameworks**.

---

## 3. Structural Heuristics for the Lenny Assistant Essay

When the user activates `mode="ship30"`, our agent prompt strictly compiles the retrieved transcripts into an essay adhering to these rules:

1. **Target Length:** Approximately **1,250 words**.
2. **The Hook (First 2–3 Lines):**
   * Creates an immediate curiosity gap or highlights a counterintuitive growth paradox (e.g., *"Most founders think churn is a product failure. It's almost always an onboarding failure."*).
   * States the outcome promise clearly.
3. **Ultra-Skimmable Formatting:**
   * **Short Paragraphs:** 1 to 3 sentences maximum. Never produce walls of text.
   * **Single-Sentence Impact Lines:** Standalone sentences surrounded by blank lines for dramatic emphasis.
   * **H2 & H3 Hierarchy:** Clear structural signposts throughout.
4. **Bold Anchors on Bullets:**
   * Every bullet point begins with a bold takeaway anchor word:
     * `* **Velocity:** Shipping three experiments weekly beats one monthly.`
     * `* **Attribution:** Tracking blended CAC prevents premature channel abandonment.`
5. **Grounded Expert Attribution:**
   * Directly attributes tactics to podcast guests: `[Episode: Brian Chesky, 00:14:20]` or `As Elena Verna revealed in her teardown of B2B product-led growth...`.
6. **Actionable Conclusion:**
   * Always concludes with an immediate operational takeaway: an implementation checklist, 5-step framework, or Monday-morning execution plan.
