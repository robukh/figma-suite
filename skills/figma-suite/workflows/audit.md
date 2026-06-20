# Workflow: Audit

Read-only audit of a Figma screen, page, or component for design system compliance. Identifies drift, hardcoded values, missing component usage, and inconsistencies.

**This workflow never modifies the Figma file.** It only reads and reports.

---

## Scope

The user can audit:
- A specific screen (provide node ID or URL)
- An entire page
- A single component
- The whole file (high-level summary only — detailed audits should be per-screen)

---

## Phase 0: Gather Context

1. **Read the Figma file** — call `mcp__figma__get_metadata` for file structure. If `config.designFiles[]` has multiple entries, ask which file to audit (or audit a specific URL the user provides).
2. **Get the design system** — for each library in `config.libraries[]`, call `mcp__figma__search_design_system` to inventory available components and variables
3. **Read design rules** — load the project's `design-rules.md` from the workspace folder. Audit findings should reference specific rules when applicable.
4. **Read code tokens** — load project design tokens for comparison (codebase mode only)
5. **Identify audit target** — resolve the user's request to specific Figma node IDs
6. **Take a screenshot** of the target for reference

---

## Phase 1: Inspect

The audit scores against the master red-flag list in [design-judgment.md §6 (The Quality Bar)](../reference/design-judgment.md#6-the-quality-bar--what-a-senior-rejects-master-list). That table (rows #1–#12) is the shared vocabulary — every finding below maps to a row, and findings should **cite the row number** (e.g. "red flag #5: text-as-icon"). The checklist below is how to detect them.

For each frame/element in the audit target, check:

### Token compliance
- [ ] **Fill colors** — bound to a variable, or hardcoded hex? *(#1)*
- [ ] **Stroke colors** — bound to a variable? *(#1)*
- [ ] **Text colors** — bound to a variable? *(#1)*
- [ ] **Bound to the right tier** — bound to a **semantic** token, not directly to a primitive (`blue-500`)? *(#2)*
- [ ] **Bound to the right role** — when several tokens pixel-match, is the *role-correct* one used (e.g. `gap-inline`, not just any 8px spacing)? *(#2)*
- [ ] **Corner radius** — bound to a radius variable (all 4 corners)? *(#3)*
- [ ] **Padding/gap** — bound to spacing variables, none unbound/off-scale? *(#3)*
- [ ] **Font family** — matches the project's configured font?
- [ ] **Font size** — from the type scale (a Text Style), not ad-hoc? *(#9)*
- [ ] **Line height** — matches a typography token?

### Component usage
- [ ] **Shared components used** — are published library components being used where they should be? *(#12)*
- [ ] **Detached instances** — any instances that have been detached from their component? *(#4)*
- [ ] **Text-as-icon** — any `✕`/`✓`/`→`/`▾` typed as text characters instead of an icon component? *(#5)*
- [ ] **Ad-hoc recreation** — UI primitives (buttons, inputs, cards) rebuilt as raw frames instead of component instances? *(#12)*
- [ ] **Variant drift** — a system component edited off-spec locally? *(#10)*
- [ ] **Combinatorial variants** — a variant set with axes that should be boolean/swap properties? *(#7)*
- [ ] **Missing states** — only a happy-path frame, no hover/pressed/disabled/focus? *(#8)*
- [ ] **Dead properties** — an exposed component property that binds to nothing? *(#11)*
- [ ] **Repeated patterns** — similar sibling structures that should be a component?

### Layout quality
- [ ] **Auto-layout** — are frames using auto-layout where appropriate?
- [ ] **Fixed positioning** — any elements with absolute positioning that should be in auto-layout?
- [ ] **Hug vs Fill** — any lopsided layout from a child set to HUG that should FILL?
- [ ] **Spacing consistency** — does spacing follow the project's spacing scale (no off-scale magic numbers)? *(#3)*
- [ ] **Alignment** — shared baselines and consistent edges, no few-px misalignment?
- [ ] **Radius nesting** — inner radius < outer radius - padding? *(#6)*
- [ ] **Consistency drift** — radius/stroke/shadow consistent across the set? *(#6)*
- [ ] **Naming** — layers/tokens role-named, not appearance-named or `Frame 47`? *(#9)*

### Variable health
- [ ] **Unused variables** — defined but not applied anywhere?
- [ ] **Wrong scope** — variables applied to properties they shouldn't affect?
- [ ] **Missing code syntax** — variables without `codeSyntax.WEB`?
- [ ] **Broken aliases** — semantic variables pointing to nonexistent primitives?

---

## Phase 2: Classify Findings

Each finding gets a severity level:

| Level | Name | Criteria |
|-------|------|----------|
| **3** | Severe | Library-level issue: broken aliases, wrong variable types, component structural problems |
| **2** | Important | Hardcoded values where variables exist, detached instances, missing components |
| **1** | Minor | Inconsistent spacing, non-standard radius, font weight mismatch |
| **0** | Nit | Cosmetic: naming conventions, frame ordering, annotation gaps |

### What NOT to flag
- Aesthetic/creative choices that are intentionally screen-specific
- Copywriting or content decisions
- Layout decisions that make sense for the specific screen context
- One-off overrides with a clear design rationale

### Evidence standard
Every finding must include:
1. **What** — the specific element and property, with the [§6 red-flag row](../reference/design-judgment.md#6-the-quality-bar--what-a-senior-rejects-master-list) it maps to (e.g. "#2: bound to primitive where a semantic exists")
2. **Where** — node name and location in the layer tree
3. **Expected** — what the design system specifies (the "right way" column for that red flag)
4. **Actual** — what's in the file
5. **Why it matters** — impact on consistency, maintainability, or handoff

---

## Phase 3: Generate Report

### Markdown format (default)

```markdown
## Design System Audit Report

**Target:** [Screen name / Page name]
**Date:** [current date]
**Score:** 78/100

### Summary
- **In compliance:** 45 elements
- **Findings:** 12
  - Severe (3): 1
  - Important (2): 4
  - Minor (1): 5
  - Nit (0): 2

### Findings

#### [Severity 3] Broken alias: `accent-soft` variable
- **Where:** Button/Primary component, fill property
- **Expected:** Alias to `Primitives/brand-500` at 10% opacity
- **Actual:** Points to deleted variable `Primitives/purple-600`
- **Impact:** Component renders with fallback color, wrong in both modes

#### [Severity 2] Hardcoded color on card background
- **Where:** HomeScreen > SummaryCard > Background fill
- **Expected:** Bound to `Semantic/surface` variable
- **Actual:** Hardcoded `#f5f5f5`
- **Impact:** Won't respond to dark mode or theme changes

...

### Recommendations
1. **Fix broken alias** — rebind `accent-soft` to correct primitive
2. **Run token sync** — 4 hardcoded values match existing variables
3. **Replace ad-hoc buttons** — 3 frames should use Button component instances
4. **Consider componentizing** — repeated stat-row pattern appears 5 times
```

### JSON format (for programmatic use)

```json
{
  "target": "HomeScreen",
  "score": 78,
  "findings": [
    {
      "severity": 3,
      "category": "broken_alias",
      "element": "Button/Primary",
      "property": "fill",
      "expected": "Primitives/brand-500 @ 10%",
      "actual": "Primitives/purple-600 (deleted)",
      "recommendation": "Rebind to correct primitive"
    }
  ]
}
```

---

## Scoring

Start at 100 and subtract penalty points per finding:

- Each severity 3 finding: **-5 points**
- Each severity 2 finding: **-3 points**
- Each severity 1 finding: **-1 point**
- Severity 0 findings: **no score impact**

Minimum score: 0. The score reflects design system compliance — fewer and less severe findings mean a higher score. A single element can only be penalized once (if it has multiple issues, count only the highest severity).

---

## Handoff

After presenting the report, suggest next steps:
- Single finding → offer to fix it directly
- Multiple findings (2-5) → suggest running the `apply-design-system` pattern from the audit
- Token-related findings → suggest running `/figma-suite sync`
- Component-related findings → suggest running `/figma-suite build-library` to update
- Many findings (5+) → suggest prioritizing severity 3 and 2 first
