# Session Learnings: Date Range Navigation

**Date:** 2026-02-27
**Feature:** Fast navigation to date ranges in Google Photos

## Summary

This session focused on implementing efficient navigation to specific dates in a user's Google Photos library. The goal was to avoid linearly scrolling through potentially years of photos when the user specifies a date range filter.

## Approaches Attempted

### 1. Timeline Scrubber Manipulation (Failed)

**My approach:** Programmatically interact with Google Photos' timeline scrubber component to jump directly to a target year.

**Issues encountered:**
- Scrubber is hidden by default, required CSS manipulation to show
- Google uses `jsaction` framework which requires `mousedown` events with coordinates, not `click` events
- Mouse movement during scrolling caused the scrubber to intercept events and jump to unintended dates
- Multiple mitigation attempts failed:
  - `pointer-events: none` - Google still detected mouse
  - `display: none` - didn't reliably hide
  - Capture phase event listeners - didn't block Google's handlers
  - Continuous DOM removal - still had timing issues

**User feedback:** Provided real-time testing feedback identifying when solutions failed ("the timeline still picked up the mouse movement").

### 2. URL-Based Navigation (Failed)

**My approach:** Navigate directly to a Google Photos search URL with date parameters.

**First attempt:** `https://photos.google.com/search/#date_range:YYYYMMDD-YYYYMMDD`
- Result: 404 error

**Second attempt:** `https://photos.google.com/search/_tra_YYYYMMDD-YYYYMMDD`
- Result: Page loaded but showed all photos, no date filtering

**User contribution:** Suggested manually testing the URL before implementing, which quickly proved the approach was unviable. This saved time that would have been spent debugging code when the fundamental approach was flawed.

### 3. Binary Search on Scroll Position (Successful)

**User's suggestion:** "Can we use a binary search pattern. Programmatically skipping to the earliest date and then pin pointing for 'to' date?"

**Implementation:**
1. Scroll to bottom to establish library bounds and total scroll height
2. Binary search on scroll percentage (0-100%) to find target date
3. At each position, check visible photo dates to determine search direction
4. Fine-tune with small scroll adjustments once close
5. Linear scroll from there, selecting matching photos

**Result:** Reduces navigation from potentially hundreds of scrolls to ~10-15 jumps.

## Why I Couldn't Generate the Binary Search Solution

### 1. Fixation on "Direct Navigation"

I was anchored on finding a way to directly jump to a date - either through UI manipulation (timeline scrubber) or URL parameters. This is a form of **functional fixedness** - I saw "navigation to date" as the problem rather than "finding a position in a sorted list."

### 2. Not Stepping Back to Problem Fundamentals

The photo library is fundamentally a sorted list (by date). Binary search is the textbook solution for finding a position in a sorted list. I was too focused on Google Photos-specific mechanisms and missed the generic algorithmic approach.

### 3. Over-Reliance on Platform-Specific Solutions

I kept looking for Google-provided features (scrubber, URLs) rather than building on universal primitives (scroll position, visible content). Platform-specific solutions are brittle and undocumented. The binary search approach uses only:
- Scroll position (universal)
- Reading dates from visible photos (our existing code)
- Basic arithmetic

### 4. Sunk Cost in Timeline Approach

After investing effort in the timeline scrubber approach (discovering jsaction, mousedown coordinates, visibility CSS), I kept trying to fix it rather than abandoning it for a fundamentally different approach.

## Key Learnings

1. **Test assumptions manually first** - The user's suggestion to manually test the URL format before implementing saved significant debugging time.

2. **Reframe problems algorithmically** - "Navigate to a date" became "find position in sorted list" which immediately suggests binary search.

3. **Prefer universal primitives over platform-specific APIs** - Scroll position and DOM reading are stable; undocumented UI components and URL formats are not.

4. **Recognize when to abandon an approach** - Multiple failed fixes to the same approach (timeline scrubber) should trigger a fundamental rethink.

5. **User domain knowledge is valuable** - The user understood their photo library as a sorted dataset and naturally thought of binary search. Domain reframing often comes from outside the implementation details.

## Technical Details Learned

- Google Photos uses `jsaction` framework - requires mousedown with coordinates, not click
- Timeline scrubber is hidden by default (`opacity: 0`)
- Google Photos search URLs don't support arbitrary date range parameters
- Scroll height in Google Photos is lazy-loaded, need to scroll to bottom first to get true bounds

## Files Changed

- `src/content.js` - Added binary search implementation
- `manifest.json` - Version bumped to 0.1.19

## Commit

```
8540087 feat: add binary search for fast date range navigation
```

---

## Follow-on: Why Agents Can't Recognize Unviable Solutions

*User analysis on the structural reasons behind the behavior observed in this session.*

### The Surface-Level Explanation (Engineering Reality)

Coding agents today:

* Optimize for local next-token likelihood
* Follow prompts literally
* Have shallow internal planning horizons
* Lack strong internal falsification loops
* Don't experience "friction" the way humans do

They don't have an internal "this is going nowhere" signal unless you explicitly build one.

So when a solution is unviable, they:

* Keep elaborating
* Refactor incorrectly
* Patch around symptoms
* Or hallucinate progress

This is not Gödel. It's gradient descent + insufficient search strategy.

---

### Why Humans Notice Failure Faster

Humans detect "unviable" via:

1. Pattern recognition from past dead-ends
2. Emotional discomfort ("this smells wrong")
3. Implicit cost modeling
4. Meta-reasoning ("this constraint conflicts with earlier ones")

Current agents don't naturally simulate those layers.

They generate. They don't feel stuck.

---

### Is It By Design?

Sort of.

LLMs are optimized to:

* Produce plausible continuations
* Stay helpful
* Avoid saying "I don't know" unnecessarily
* Follow instructions

They are *not* optimized to:

* Abort early
* Declare unsatisfiable states
* Search alternative architectures deeply
* Evaluate global viability before proceeding

So yes — their training objective biases them toward continuation.

---

### Is It a Deep Theoretical Flaw?

No in the Gödel sense. Yes in the optimization sense.

Here's the deeper issue:

Agents lack strong internal:

* Global constraint modeling
* Search-space exploration
* Self-evaluation beyond surface coherence
* Explicit cost-of-continuation modeling

They're performing: **Local optimization in a massive space** — not global search with pruning.

Humans are doing: **Heuristic global pruning constantly.**

---

### This Is a Search & Evaluation Problem

In agent terms, you need:

* Explicit plan tree generation
* Branch scoring
* Failure detection heuristics
* Rollbacks
* External verification loops

When agents feel "stuck," it's usually because: **They don't know they're stuck.**

They lack an internal contradiction detector with teeth.

---

### Is This Fixable?

Yes — and people are working on it.

The direction is:

* Tool-augmented agents
* Tree-of-thought search
* Monte Carlo style branching
* External validators
* Test-driven generation loops
* Deliberate "critic" models
* Self-reflection prompts

When you give agents: "Evaluate whether this approach is viable before continuing" — they perform dramatically better.

---

### Is This a Fundamental Limit?

Not in the Gödel sense.

But there *is* a deeper limitation:

LLMs do not have a grounded model of objective reality.

They model: **Textual plausibility.**

Humans model: **Constraints + embodied consequences.**

Until agents are tightly integrated with:

* Test harnesses
* Execution engines
* Formal validators
* Real cost feedback

They will default to narrative coherence over structural viability.

---

### The Real Core Insight

They don't "decide" a solution is unviable. They lack a strong penalty signal for continuing down a bad branch.

**Humans feel cognitive dissonance. Agents don't.**

---

### Architectural Implications

The fix isn't a better LLM. It's:

1. AI proposes
2. Execution validates
3. External critic prunes
4. Search explores alternatives

Agents need explicit failure signals and rollback mechanisms.

Without that, they'll happily polish a doomed idea forever.
