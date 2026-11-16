# Workflow: Build Library

Load first: figma-use and figma-generate-library (`skill://figma/<name>/SKILL.md`); this workflow only adds figma-suite's config/mapping integration and rules.

Those two skills own the Plugin API rules, the phase model, token and component creation recipes, and error recovery. Nothing here restates them. Where this file and an official skill disagree, this file wins only for the deltas listed below.

## Contents

1. [Must-read](#1-must-read)
2. [Size the task to the request](#2-size-the-task-to-the-request)
3. [Target file and config](#3-target-file-and-config)
4. [Discovery: read components and decide by mapping status](#4-discovery-read-components-and-decide-by-mapping-status)
5. [File layout](#5-file-layout)
6. [Building a component](#6-building-a-component)
7. [Operating rules](#7-operating-rules)
8. [Verify and report](#8-verify-and-report)
9. [Update the mapping last](#9-update-the-mapping-last)

---

## 1. Must-read

| Read | For |
|------|-----|
| figma-use | Plugin API syntax, sizing, text, variables, slots, gotchas |
| figma-generate-library (+ its `references/`) | phase model, token/component creation, error recovery |
| [component-craft.md](../reference/component-craft.md) | token choice, anatomy, variant design, the section 6 red-flag table |
| [component-contracts.md](../reference/component-contracts.md) | SLOT vs INSTANCE_SWAP table, build tiers, verification script |
| [mapping-schema.md](../reference/mapping-schema.md) | per-component `component-mappings/{id}.json` |
| [plugin-api-deltas.md](../reference/plugin-api-deltas.md) | where we intentionally differ from figma-use |

---

## 2. Size the task to the request

Official guidance sizes the pipeline to the request; the multi-phase ceremony (per-phase checklists, summaries, page documentation) is for full builds only.

| Request | Do | Skip |
|---------|----|------|
| Tokens only | [sync.md](sync.md) `--tokens` | components, pages, docs |
| Single component | read its mapping, confirm dependencies exist, build, verify, report | file restructuring, foundations pages, patterns page |
| Full library | sections 3-9 in order; one plan checkpoint after discovery | nothing |
| Reconciliation (library already exists) | diff code vs Figma, change only what the diff names | rebuilding matched components |

Never delete an existing variant, property or page without explicit confirmation; consumers may be using it.

---

## 3. Target file and config

Ask which scenario applies; only the build location differs.

| Scenario | Build in | Then |
|----------|----------|------|
| A. Single file (library + screens) | the design file | screens reference components directly |
| B. Separate library file | a `config.libraries[]` entry (ask which; default first) | publish the library; other files find components via `search_design_system` |
| C. No library yet | a new file (`create_new_file`) | offer to make it publishable |
| D. Existing published library | the library file | inventory first; create only what is missing or stale; match its naming |

`config.libraries[]` lists library files, `config.designFiles[]` lists files that consume them, and `config.fileLayout` / `componentLayout` choose the page structure (see [config-schema.md](../reference/config-schema.md)). If tokens are not in Figma yet, run [sync.md](sync.md) `--tokens` first; components bind to variables, so no variable means no component.

---

## 4. Discovery: read components and decide by mapping status

**From code** (scan `componentPaths`, or `src/components/ui/`, `src/components/`, `components/`): per component, extract variant/size/state axes with defaults, tokens used, content regions (freeform `children`/header/body -> `SLOT`; a specific swappable child such as an icon -> `INSTANCE_SWAP`), child components (the dependency graph), and accessibility attributes.

**From Figma** (the component already exists, or Figma is the source of truth): read with read-only `use_figma`: component sets, `componentPropertyDefinitions` (record base names, not `#uid` keys), variant values, bound variables. Fan reads out as one call per page.

Before planning a component, call `get_libraries`, then `search_design_system` scoped by the returned library keys; reuse versus rebuild follows the official decision matrix.

A component's mapping file decides whether to build it:

| Mapping status | Action |
|----------------|--------|
| `matched` | update Figma to match code; use `propertyMap` to diff names and values |
| `code-only` | skip; list under Skipped with the reason |
| `figma-only` | leave alone: do not rebuild, rename or delete |
| `split` | one code component becomes several Figma components; build each, in dependency order |
| `merged` | build the single Figma component once; every code entry points at it |
| `diverged` | do not "fix" it; the difference is intentional (see the entry's notes); report only |
| no file yet | treat as new; the file is created after verification (section 9) |

Present the plan as New / Update / Skipped (with reasons) from what was actually discovered, never from assumed counts. Wait for approval before a full-library build; a single component needs none.

---

## 5. File layout

Respect existing pages and never duplicate them. For a new file follow `config.fileLayout`:

| Preset | Components live in |
|--------|--------------------|
| `page-per-component` (default) | one page each, under a `Components` group |
| `single-page-components` | one `Components` page, one Section per component |
| `flat` | a `Components` page and a `Screens` page |
| `custom` | the user's structure |

**Library file:** `Cover`, `Getting Started`, `Foundations` (color swatches, type specimens, spacing/radius), `---`, components (per preset), `---`, `Icons`/`Utilities`, `Patterns` (optional, only when asked). Separator pages are named `---`.

**Design file:** `Cover`, `Screens / <Feature>`, `Flows / <Flow>`, `Scratch`. No components are defined here; screens instance the library (see [design-screen.md](design-screen.md)).

**Component page** (`config.componentLayout`): `full` = variant matrix section, specs section (sizing, token references, states), usage section; `compact` = the set plus one spec annotation; `variants-only` = the set alone. Page and layer names follow the naming preset ([naming-conventions.md](../reference/naming-conventions.md)); no layer is left as `Frame 47`.

---

## 6. Building a component

1. **Order.** Primitives, then interactive, then containers, then overlays (tiers in [component-contracts.md](../reference/component-contracts.md#component-composition)). A component is built only after the components it nests exist, because nesting needs a real instance.
2. **One canonical variant first.** Build one cell completely: every binding, Text Styles, nested instances, component properties. Run the verification (section 8) on it, and only then `clone()` per remaining variant and rebind what differs. Cloning an incomplete cell multiplies each omission across the set.
3. **Bind every visual property to a variable** and pick by role, not pixel ([component-craft.md](../reference/component-craft.md#1-token-judgment)):

   | Property | Binds to |
   |----------|----------|
   | fill, stroke, text fill | semantic color variable (`setBoundVariableForPaint`) |
   | corner radius (4 corners) | radius variable |
   | padding (4 sides), gap | spacing variable; role-matched (`gap-inline`, not any 8px token) |
   | fixed width/height | spacing variable, only where a token defines the size |
   | font family/size/weight/line height | a Text Style (bind the variables on the style, not the TextNode) |

   No matching variable: create one, or use a raw value and log an exception. A silent skip looks complete and is broken for consumers.
4. **Content regions.** Decide per region with the [SLOT vs INSTANCE_SWAP table](../reference/component-contracts.md#content-regions-slot-vs-instance_swap); optional regions add a BOOLEAN. Native slots map to `kind: "slot"` and swaps to `kind: "instanceSwap"` in the mapping file.
5. **Property timing.** Add component properties before `combineAsVariants`, or on the set afterwards; never on a variant already inside a set, because `addComponentProperty` throws there ([plugin-api-deltas.md](../reference/plugin-api-deltas.md)). Capture each returned key (it carries a `#uid` suffix) and link it immediately.
6. **Variant budget.** Warn at 20 variants, ceiling 30. Past that, move an axis to a boolean/swap or split a sub-component ([component-craft.md](../reference/component-craft.md#3-variant-set-design)).
7. **Theming.** If variables have several modes, set `setExplicitVariableModeForCollection` on the component, or every variant renders in the first mode.

---

## 7. Operating rules

These correct older guidance in this skill.

- **Session first.** Call `create_session` for the target file before any file tool and pass its `sessionId`; call `get_libraries` before `search_design_system`.
- **Batch retry-safe work.** Group operations that can be re-run without duplicating (idempotent creates by name, bindings, property sets) into one call; there is no "one thing per call" rule. Keep non-idempotent steps (creating the component, `combineAsVariants`) in their own call so a failure is easy to read.
- **Obey `safeToRetryWithoutCanvasRead`.** If a `use_figma` error reports it as true, fix the script and retry directly; if not, read the canvas (`get_metadata`) first, because the script may have partly applied.
- **Ledger of returned IDs.** Keep a name -> ID ledger from every call's return value and read IDs only from it. Do not store state on Figma nodes (no `sharedPluginData`); after a context loss, rebuild the ledger with a read-only scan by name.
- **Writes are sequential, reads may fan out.** Never run two mutating `use_figma` calls at once.
- **Screenshot after each component** (`get_screenshot`, at most 3 fix iterations), in addition to the programmatic check below.

---

## 8. Verify and report

A screenshot proves it looks right, not that it is bound right. After the canonical variant and again on the finished set, run [scripts/verify-component.js](../scripts/verify-component.js) via `use_figma` (inputs and outputs: [component-contracts.md](../reference/component-contracts.md#verification)). It returns violations, which must reach zero before the next component, and exceptions.

Report evidence, one row per rule with the actual value:

```markdown
### Verification: Button / variant=primary, size=md
| Rule | Status | Actual value |
|------|--------|--------------|
| Fill variable-bound | PASS | `Semantic/action-primary` |
| Padding (4 sides) bound | PASS | `Spacing/spacing-3` (TB), `Spacing/spacing-4` (LR) |
| Gap bound | PASS | `Spacing/gap-inline` |
| Radius (4 corners) bound | PASS | `Spacing/radius-md` |
| Text Style applied | PASS | `Body / Medium` |
| Label TEXT property | PASS | `Label` -> "Button" |
| Icon INSTANCE_SWAP | PASS | `Icon` -> `Icons/Chevron` |
```

**Exceptions report**, listed under the table with a reason each, or "no exceptions":

```
Exceptions (2):
- paddingLeft: raw 2px, no variable at 2px in the scale
- Separator fill: not bound, decorative single-use color
```

Then walk the [section 6 red-flag table](../reference/component-craft.md#6-the-quality-bar--what-a-senior-rejects-master-list); a green script plus a clean table is the bar.

---

## 9. Update the mapping last

Only after the Figma side verifies with zero violations, write `component-mappings/{id}.json` for each component built or changed: `nodeId`, `componentName`, base property names (never `#uid`), `propertyMap` with value maps, and `published` once the library is published. Update only the files that changed, never overwrite hand-tuned value maps, and run the contract check ([SKILL.md → Commands](../SKILL.md#commands-defined-once-workflows-say-run-the-contract-check)). A failed or partial build leaves its mapping file untouched, so the next sync still sees the gap. Finish by reminding the user to publish the library (scenarios B-D), then to run [sync.md](sync.md) `--components` to confirm zero drift.
