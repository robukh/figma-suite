# Changelog

All notable changes to `figma-suite`.

## 1.4.0

Alignment pass against Figma's officially published skills (`figma-use`, `figma-generate-library`, `figma-generate-design`), served as MCP resources from `https://mcp.figma.com/mcp` and mirrored at [figma/mcp-server-guide](https://github.com/figma/mcp-server-guide). Slot support in 1.3.0 was written ahead of Figma's own documentation and got the API wrong.

### Breaking — slot API corrected

**If you copied the slot snippet from 1.3.0, it does not work.** The corrected surface:

| 1.3.0 (wrong) | 1.4.0 (correct) |
|---|---|
| `addComponentProperty(name, "SLOT", slotNode.id, { slotSettings })` | `createSlot()` auto-creates the property — no follow-up call |
| `slotSettings` option | Does not exist anywhere in the Figma API |
| `comp.appendChild(slotNode)` after `createSlot()` | Redundant — `createSlot()` already parents the node |
| Manual default value = node id | Manual default value = `""` |
| — | Reference key is `slotContentId` (a fourth valid `componentPropertyReferences` key) |
| Claimed "GA as of 2026-06-10" | No such date exists in official docs — claim removed |

Newly documented, all previously missing: multiple slots per component, filling slots via `appendChild` (`setProperties` on a slot key **throws**), `resetSlot()`, reading slots with `findAllWithCriteria({ types: ["SLOT"] })`, the `"Internal Figma Error: Parent not found"` recovery, and the five official slot restrictions.

### Changed — SLOT vs INSTANCE_SWAP is now a per-region decision

1.3.0 defaulted every content region to native SLOT. 1.4.0 adds a canonical decision table ([component-contracts.md](skills/figma-suite/reference/component-contracts.md#content-regions-slot-vs-instance_swap)) that every other doc references:

- **Freeform content region** (Card header/body/footer, Dialog body) → native `SLOT`
- **Specific swappable child** (Button icon, Avatar) → `INSTANCE_SWAP`
- Optional either way → plus a `BOOLEAN` toggle

One component often needs both. The divergence from official `figma-generate-library` — which predates Slots and routes all `children` props to `INSTANCE_SWAP` — is now stated explicitly rather than left implicit.

### Fixed — factual errors

- **`FILL_COLOR` is not a valid variable scope.** It appeared in four places. Replaced with the real enum, split by role (`FRAME_FILL`/`SHAPE_FILL` for surfaces, `TEXT_FILL` for text, `STROKE_COLOR` for borders). The complete valid scope list is now documented.
- **`TextStyle.setBoundVariable()` works — the skill claimed it didn't.** Official docs call binding on a Text Style the *preferred* form for `fontFamily`, `fontSize`, `fontStyle`, `fontWeight`, `letterSpacing`, `lineHeight`, `paragraphSpacing`, `paragraphIndent`. The "not bindable" restriction applies to **TextNodes** only. This was inverted in four places and caused the skill to leave typography unbound.
- **`mcp__figma__create_design_system_rules` does not exist** — removed from `allowed-tools`. Also removed the never-used `get_figjam`/`whoami`, added `upload_assets`.
- **`instantiate_component` is not an official Figma MCP tool** — the screen-design workflow now uses `use_figma` + `createInstance()`.
- **Font style probing by try/catch** replaced with `listAvailableFontsAsync()`, which official docs require instead.
- **`resize(320, 1)`** in the sizing example — the "1px dimension" bug. Never pass a throwaway value to an axis meant to HUG.
- **A page-iteration loop** that switched pages inside `for (const page of figma.root.children)` — the top cause of timeouts. Replaced with the discovery-then-fan-out pattern.
- **Workspace path drift** — `config-schema.md` and the README still documented the `<HOME>` path as the only option after project-level `.figma-suite/` became the default.
- **Verification script bug** — `componentPropertyDefinitions` was to be read per-variant, which throws on variants inside a set.

### Added — official rules previously missing

- **Component property timing.** Official docs contradict each other; the verifiable constraint is that `addComponentProperty` throws on a variant already inside a set. Both valid paths (before `combineAsVariants`, or on the set after) are now documented.
- **Efficient APIs:** `figma.createAutoLayout()` (preferred over `createFrame()`), `node.query(selector)`, `node.set(props)`, `await node.screenshot()`, `node.placeholder`.
- **Traversal and performance:** `findAllWithCriteria` over predicate scans, never `figma.root.findAll()`, scope to the smallest ancestor, batch independent awaits with `Promise.all`.
- **Sizing failure modes:** the `HUG`/`FILL` value-restriction table, the two sizing enums not to cross, HUG parents collapsing FILL children, `layoutGrow` compression, read-only `width`/`height`.
- **Wrapping text collapse** — `textAutoResize = 'HEIGHT'` + FIXED width + `resize()` before `characters`, or the node becomes a near-zero-width thread.
- **Variables:** plan-dependent mode limits, silently-duplicated variable names, unsupported cross-file aliasing, exact alias shape, `setBoundVariableForEffect`/`ForLayoutGrid` returning new objects, deprecated sync getters.
- **Unsupported APIs:** `loadAllPagesAsync`, `teamLibrary.*`, `getLocalComponents*()`, `createImage*()` (being removed — `upload_assets` is the only image path), `createPage()` outside Design files.
- **Auto-layout mandate** — containers of related children use auto-layout, never absolute `x`/`y`. Applies to slots too.
- **Icons** — import SVG with `viewBox` plus explicit `width`/`height`; never reconstruct from rotated primitives.
- **Page fan-out** reconciled with the sequential-writes rule: reads fan out in parallel, writes stay sequential.
- Per-call budget changed from "~200 lines" to the official "~10 logical operations".
- **Verification script** now checks slots: `slotContentId` wiring, auto-layout presence, no `GRID`, and that every declared SLOT property resolves to a live SlotNode.
- `plugin-api-patterns.md` now lists the live MCP resource URIs as the authoritative source, since the GitHub mirror can lag.

### Unchanged

The mapping schema is untouched — `kind: "slot"` was already correct in `mapping-schema.md`, `mapping.schema.json`, and `validate.mjs`. Existing `component-mappings/{id}.json` files remain valid.

## 1.3.0

Bidirectional component sync, per-component JSON mapping, native Slots.

## 1.2.0

Component completeness enforcement; alignment with Figma Plugin API limits.

## 1.1.0

Paint variable binding, variant renaming, safe audit patterns; project-level and global workspace locations.

## 1.0.0

Initial release.
