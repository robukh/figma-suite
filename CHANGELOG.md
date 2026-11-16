# Changelog

All notable changes to `figma-suite`.

## 2.0.1

Proactive setup and upgrade from 1.x.

- `setup` is a numbered sequence that runs without questions and asks once at the end; it also upgrades a 1.x workspace (creates `DESIGN.md`, writes `state.json`). It no longer needs dry-run approval, because it writes only workspace files.
- `check-contract.mjs --setup` is the "done" test: it fails until the workspace files, `DESIGN.md` and `state.json` exist and no active `design-rules.md` remains.
- `discover.mjs` prints one `NEXT:` line (`setup`, `sync` or `none`) and the figma-suite version in use.
- `design-md` writes the file first and interviews afterwards. Figma skill loads are required only before a `use_figma` write.
- README: only one install may be active; a leftover skill folder can shadow the plugin.

## 2.0.0

Aligned with Figma's current official skills, simplified from 4,711 to about 2,000 lines of markdown plus tested scripts, and extended with a connected design contract and a senior-designer screen workflow. The previous version is tagged `v1.4.0`.

### Breaking

- **`design-rules.md` is replaced by a root `DESIGN.md`** (open DESIGN.md format: YAML tokens + prose, with figma-suite extensions). `setup` folds an existing `design-rules.md` into `DESIGN.md` and renames it to `design-rules.md.bak`. Config key `designRulesPath` becomes `designMdPath`.
- **The zod validator is gone.** `schema/validate.mjs`, `schema/package.json` and the npm install step are removed. `scripts/check-contract.mjs` (zero dependencies) validates mappings and DESIGN.md and cross-checks them. Existing `component-mappings/{id}.json` files stay valid.
- **`design-judgment.md` is now `component-craft.md`** (tokens, anatomy, variants, icons, the 12-row red-flag table). Screen-level composition and copy judgment moved to the new anti-slop layer.
- **`plugin-api-patterns.md` (977 lines) is now `plugin-api-deltas.md` (146 lines)**; `figma-file-structure.md` is folded into `build-library.md` and `config-schema.md`.
- **Pre-approved tools narrowed:** `Bash` → `Bash(node *)`; publishing and upload tools (`upload_assets`, `generate_figma_design`, Code Connect publish) now prompt. `WebSearch` removed.

### Added

- **Official skills first.** `reference/official-skills.md`: load order for `figma-use`, `figma-generate-design`, `figma-generate-library`, `figma-code-connect`, `figma-design-to-code`; `create_session`/`sessionId`; the `skillNames` parameter; the current discovery order (Code Connect → `get_libraries` → whole-frame inventory → gap-only `search_design_system` with `queries[]`).
- **One connected contract.** Tokens, component mappings and DESIGN.md have one owner per fact; generated blocks vs authored sections; `state.json` content hashes; `sync` gains a fourth lane (DESIGN.md) and one cascade report. `scripts/discover.mjs` reports freshness at the start of every workflow.
- **`design-md` workflow and template** with derive-vs-ask rules; `components:` entries keyed by mapping id (allowed variants, icon policy) that are cross-checked against the mapping.
- **Senior-designer `design` workflow:** brief, content inventory, structure plan with a defaults review, hierarchy, build, mechanical gate, subtract pass, fresh-context critique, state frames.
- **Anti-slop layer:** `craft-floor.md` (short, re-read per section), `anti-slop.md` (about 55 rules with IDs, ban/default, exceptions, checks; decision tables for icons in buttons and descriptions under titles), `ux-checklist.md`, `critique-rubric.md` (five dimensions, P0–P3, critic brief).
- **Scripts:** `slop-scan.js` (about 20 read-only node checks through `use_figma`), `verify-component.js` (extracted and fixed), `check-contract.mjs`, `discover.mjs`.
- **Evals:** `evals/evals.json` (12 cases with gates), deterministic tests for the contract check and the slop scan, a link checker, and an Acme fixture workspace.

### Changed to match current official guidance

- Call granularity: batch retry-safe operations; split only at page-context boundaries, hard-to-recover partial execution, or a targeted retry. The old "one thing per `use_figma` call" and "~10 operations" budget are removed.
- Errors: obey `safeToRetryWithoutCanvasRead`. The blanket "`use_figma` is atomic; stop, never retry" is removed.
- State: keep a ledger of returned IDs; the `getSharedPluginData` advice is removed.
- Reads: never read `componentPropertyDefinitions` on a variant; broad reads return id/name/type/counts only; one composition screenshot plus one after a visual fix.
- Hard gates: never import a flattened UI screenshot; assert the product font; componentize repeats; reuse assets before generating them.
- Code Connect: `.figma.ts` templates only; SLOT properties map through `getSlot()`.

### Fixed

- Contradictions: component-property timing, the page loop in `setup`, per-node typography binding, three different variant ceilings (now: warn at 20, ceiling 30), `get_variable_defs`-first for local content.
- Description rendering bug (`&lt;-&gt;`), validator path that only worked inside this repo, version defined in three places (now `plugin.json` only).
- `setup` asked up to nine questions before doing anything; it now infers defaults and asks for the Figma URLs plus one confirmation.
- `audit` no longer reports a fake 0–100 score; it reports counts per severity with rule IDs.

### Found by running the evals on a real Figma file (see `evals/results/`)

- `slop-scan.js` and `verify-component.js` now switch to the target's page before traversing (pages load lazily; the first scan saw 8 of 86 nodes).
- `slop-scan.js`: glyph prefixes (`✕ Remove`), redundant default fills on layout wrappers, data under a name no longer read as a restating description, table rows are not title + description pairs, a "title + description on every section" advisory, state frames named after the screen count for S24.
- `createSlot()` gives the slot a default white fill: documented in `plugin-api-deltas.md`.
- `check-contract.mjs --design-md FILE` lints a lone DESIGN.md without a workspace.
- Design workflow: Definition of done checklist, autonomous-run fallback, guidance for a missing spacing tier or button variant, "paste the whole scan"; official-skills cache fallback when no MCP resource reader exists.

### Relaxed after the broad eval (ten briefs, v1.4.0 against v2)

The first v2 draft lost the blind comparison (human 7 to 2, AI judges 16 to 3) because it stripped platform chrome and icons and left screens sparse. Rules now put completeness before restraint: a brief-coverage list, platform chrome, icons where the platform expects them, display type and large spacing as recorded exceptions (T12), a gentler subtract pass, a `consumer` mode and advisory critic scores. The relaxed version won the same ten briefs 9 to 1 (human) and 14 to 6 (AI judges). Scan fixes: short caps codes ("JFK") are not eyebrows, © is not an emoji. `plugin-api-deltas.md` gained an instances, sizing and traversal gotchas section.

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
