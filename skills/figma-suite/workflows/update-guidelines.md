# Workflow: Update Guidelines

Sync design guidelines between the codebase documentation and Figma file annotations/documentation pages.

---

## Three Directions

| Direction | Source | Destination |
|-----------|--------|-------------|
| **Code to Figma** | `docs/design-system/GUIDE.md`, component docs, README files | Figma documentation pages, component descriptions, annotations |
| **Figma to Code** | Figma annotations, component descriptions, page notes | `docs/design-system/GUIDE.md`, component doc comments |
| **Design rules ↔ Figma** | `design-rules.md` in workspace folder | Figma documentation pages, annotations |

In standalone mode (no codebase), the project's `design-rules.md` takes the role of code docs. The user edits design rules in the workspace folder, and this workflow syncs them into Figma annotations and documentation pages.

---

## Phase 0: Discover Guidelines

### In project workspace
1. Read the project's `design-rules.md` from the workspace folder (`config.designRulesPath`)
2. This is always available, regardless of mode (codebase or standalone)

### In code (codebase mode only)
1. Look for design guide files:
   - `docs/design-system/GUIDE.md`
   - `docs/design-guide.md` or `docs/design-system.md`
   - Component-level docs (JSDoc, inline comments)
   - Skill files with design knowledge (e.g., `ui-engineering/SKILL.md`)
2. Extract structured guidelines:
   - Typography scale (classes, sizes, usage)
   - Spacing system (values, use cases)
   - Color semantics (names, purposes, modes)
   - Border radius rules (nesting, per-component)
   - Layout patterns (page types, margin tiers)
   - Component specifications (sizes, variants, states)

### In Figma
1. Check for documentation pages:
   - "Foundations" or "Styles" page
   - "Guidelines" or "Documentation" page
   - Component page descriptions and annotations
2. Read component descriptions via `mcp__figma__get_design_context`
3. Check for annotations via `mcp__figma__get_design_context` (includes annotations when available)

---

## Phase 1: Compare

Build a comparison table:

```markdown
## Guidelines Comparison

| Topic | In Code | In Figma | Status |
|-------|---------|----------|--------|
| Typography scale | 10 sizes defined | 8 sizes documented | Figma missing 2 |
| Spacing values | 9 values defined | 9 values documented | In sync |
| Color tokens | 15 semantic colors | 12 documented | Figma missing 3 |
| Border radius | 7 values + nesting rule | 7 values, no nesting rule | Partial |
| Button specs | 3 sizes documented | No spec annotation | Missing in Figma |
| Card patterns | 3 patterns documented | 2 patterns shown | Figma missing 1 |
```

Present to user and ask which updates to apply.

---

## Phase 2: Apply (Code to Figma)

### Foundations page
Create or update a "Foundations" page in Figma with:

1. **Color swatches** — grid of semantic colors with name, hex, and usage note
   - Light mode row and Dark mode row side by side
   - Each swatch: filled rectangle bound to variable + text label
2. **Typography samples** — each text size rendered with sample text
   - Format: `text-display / FontFamily Bold / 56px/64px — Hero heading`
3. **Spacing scale** — visual blocks showing each spacing value
   - Ascending bar chart with value labels
4. **Radius samples** — rounded rectangles at each radius value
   - With label and use case

### Component documentation
For each component page, add or update:
- **Description** on the component set: purpose, when to use, accessibility notes
- **Annotation frame** below the component: props table, sizing specs, usage guidelines
- **Do/Don't examples** if the design guide specifies them

### Annotations
If the Figma file supports annotations (via `mcp__figma__use_figma` Plugin API):
- Add annotations to key design decisions
- Link spacing values to their semantic meaning
- Note nesting radius rules on card components

---

## Phase 3: Apply (Figma to Code)

When pulling guidelines from Figma into code:

1. **Read Figma annotations and descriptions** from component sets and documentation pages
2. **Update design guide markdown** — add missing sections, update changed values
3. **Update component comments** — add JSDoc or inline comments with Figma-sourced guidelines
4. **Show diff** before writing — never overwrite without user review

### Merge strategy
- Code and Figma agree → no change
- Code has more detail → keep code version, flag Figma as outdated
- Figma has more detail → propose addition to code docs
- Conflict → present both versions, let user choose

---

## Phase 4: Validate

1. Re-read both sides
2. Confirm all approved updates were applied
3. Generate summary:

```markdown
## Guidelines Sync Complete

### Updated in Figma
- Added 2 missing typography samples
- Updated color swatch page with 3 new tokens
- Added button spec annotations

### Updated in code
- Added card pattern documentation from Figma annotations

### Remaining gaps
- None
```
