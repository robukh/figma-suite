# Workflow: Audit

Read-only review of a Figma screen, page or component against the design system **and** against the project's design taste. It never modifies the file. Findings cite stable rule IDs and a severity, so they can be fixed, waived or tracked.

**Contents:** [Scope](#scope) · [Phase 0: Context](#phase-0-gather-context) · [Phase 1: Inspect](#phase-1-inspect) · [Phase 2: Classify](#phase-2-classify) · [Phase 3: Report](#phase-3-report) · [Handoff](#handoff)

Load first: `figma-use` ([official-skills.md](../reference/official-skills.md)); `create_session` for the file. Vocabulary: [component-craft.md §6](../reference/component-craft.md#6-the-quality-bar--what-a-senior-rejects-master-list) (system rows #1–#12) and [anti-slop.md](../reference/anti-slop.md) (rule IDs C/L/K/T/P).

## Scope

A specific screen (node id or URL), a page, a component, or the whole file (summary only; detailed audits are per screen). Ask which design file when `config.designFiles[]` has several.

## Phase 0: Gather context

1. Project snapshot: DESIGN.md, mapping files, config. If the contract is **STALE**, say so in the report header; findings about tokens may be sync drift rather than design errors.
2. Resolve the target to node ids and take one screenshot.
3. Inventory with `use_figma` (read-only), returning ids, names and counts only, one inventory per call; for several pages, one read per page in parallel. Library components and variables: `get_libraries` then `search_design_system` for gaps.
4. Read code tokens for comparison in codebase mode.

For large targets, delegate per-page reads to subagents in parallel and merge their summaries; the audit itself remains read-only.

## Phase 1: Inspect

Run `scripts/slop-scan.min.js` on the target frame(s) (read-only, via `use_figma`) and the checks below. Then, for screens, run the critic from [critique-rubric.md](../reference/critique-rubric.md) in a fresh context for the judgment-based dimensions (hierarchy, restraint, copy, states).

**Token compliance** *(system rows #1–#3, #9)* — fills, strokes and text colors bound to variables, and to the **semantic** tier with the **role-correct** token (not a primitive, not just any pixel match); radii bound on all four corners; padding and gap bound and on the scale; font size from a Text Style, not ad hoc.

**Component usage** *(#4–#5, #7–#8, #10–#12)* — library components used where they exist; no detached instances; no text-as-icon; no UI primitives rebuilt as raw frames; no off-spec edits to system components; no combinatorial variant sets that should be booleans or swaps; states present; no dead properties; repeated patterns that should be components.

**Layout quality** — auto-layout where related children exist; no absolute positioning inside containers; no lopsided HUG that should FILL; spacing on the scale; consistent alignment; radius nesting; consistent radius/stroke/shadow; role-named layers.

**Design taste** (anti-slop) — slop-scan errors and advisories; description-under-title and icon-in-button decisions against DESIGN.md `Project decisions`; one primary action; no nested cards; states and edge content designed.

**Variable health** — unused variables, wrong scope (`ALL_SCOPES` or a scope that lets the variable apply to the wrong property), missing `codeSyntax.WEB`, broken aliases.

**Contract** — component usage matches the mapping (`matched` pairs are not drifting; `diverged` entries are documented, not flagged); DESIGN.md `components:` policy respected (allowed variants, icon policy).

### Do not flag
Intentional screen-specific creative choices; copy decisions beyond the anti-slop rules; layouts that suit the screen; one-off overrides with a stated rationale; anything covered by a recorded waiver or `diverged` note.

## Phase 2: Classify

| Severity | Meaning | Examples |
|---|---|---|
| **P0** | Breaks the system or blocks use | broken alias, wrong variable type, structural component bug, contrast failure on primary text |
| **P1** | Clearly wrong | hardcoded value where a variable exists, detached instance, ban violated (eyebrow, nested card, glyph icon), missing states |
| **P2** | Should fix | off-scale spacing, advisory slop patterns, inconsistent radius |
| **P3** | Polish | naming, ordering, annotation gaps |

Every finding includes: **what** (element and property, with rule ID or red-flag row), **where** (node name, location in the layer tree), **expected** (what the system or DESIGN.md specifies), **actual**, and **why it matters** (consistency, maintainability, handoff, or user impact). One element is reported once, at its highest severity. There is no numeric score: a single number hides which problem matters; report counts per severity instead.

## Phase 3: Report

```markdown
## Audit — <target>   (contract: fresh | STALE: …)
**Counts:** P0 1 · P1 4 · P2 6 · P3 2 — **In compliance:** 45 elements
**Critic scores:** job 3 · hierarchy 2 · restraint 1 · fidelity 3 · craft 3

### P0 — Broken alias: `accent-soft`
- Where: Button/Primary › fill · Rule: #2
- Expected: alias of `Primitives/brand-500` at 10% · Actual: points to deleted `Primitives/purple-600`
- Impact: fallback color in both modes

### P1 — Description restates title · C02 …
### Recommendations (ordered)
### Not verified (dark mode, real data, other breakpoints …)
```

Offer JSON output (`target`, `counts`, `findings[]` with `severity`, `rule`, `node`, `expected`, `actual`, `recommendation`) for programmatic use.

## Handoff

One finding → offer to fix it. Several → propose a prioritized plan (P0 and P1 first), and run `design` on the affected screens so fixes pass the same gates. Token findings → `sync`. Component findings → `build-library`. Taste findings that reflect a standing preference → record a `Project decisions` line via `design-md` so it stops being flagged.
