# Workflow: Sync (the bidirectional loop)

The bidirectional loop between a codebase design system and Figma, across **three lanes**: tokens, components, and the component mapping itself. The user edits either side, runs `sync`, and both converge: detect drift → report → apply after approval → re-read → update the `component-mappings/` files to the new ground truth.

## Scope & direction flags

| Invocation | Scope |
|------------|-------|
| `/figma-suite sync` | **Full loop** — tokens + components + mapping |
| `/figma-suite sync --tokens` | Tokens only (the classic token sync; back-compatible) |
| `/figma-suite sync --components` | Components + mapping only |
| `--to-figma` | One-way: code → Figma (applies to whichever scope is selected) |
| `--to-code` | One-way: Figma → code (applies to whichever scope is selected) |
| *(no direction)* | Bidirectional — show drift both ways, ask which to resolve |

Direction and scope flags compose, e.g. `sync --components --to-code`.

## The loop at a glance

```
0. Discover & validate mapping
1. Detect drift  → Lane A tokens │ Lane B components │ Lane C mapping
2. Unified report
3. Approval gate  (MANDATORY STOP)
4. Apply          (tokens → components → mapping files last)
5. Re-read & confirm zero residual drift
6. Persist component-mappings/  → optional Code Connect push (if eligible)
```

Honor the Universal Safety Rules in SKILL.md throughout: dry-run first, screenshot validation after visual changes, never delete without confirmation, sequential `use_figma` calls only.

---

## Phase 0: Discovery & validate mapping

1. **Load config** — read `config.json` from the workspace (or auto-discover).
2. **Load the mapping** (skip for `--tokens`) — read every `component-mappings/{id}.json` file (skip `_meta.json` and any `_*.json`) into memory as a set of `ComponentEntry` objects. **Validate** against the Zod schema in [mapping-schema.md](../reference/mapping-schema.md) by inspection — per-file (status invariants) and cross-file (filename == `id`, no duplicate `id`s). If `node` is available and the user wants a hard check, run `node skills/figma-suite/schema/validate.mjs <workspace>/component-mappings/`. If invalid, stop and report the errors before doing anything else — a broken mapping makes the component lane unreliable. (If a stray legacy `component-mapping.json` sits alongside the directory, ignore it and note it — never read both.)
3. **Read code tokens** (skip for `--components`) — parse all token files into a normalized map:
   ```
   { name, type: "color"|"number"|"string", value, mode?, collection }
   ```
4. **Read Figma state** — variables via `mcp__figma__get_variable_defs` (fall back to `use_figma` Plugin API for local/unpublished content), and component properties via `use_figma` for the components referenced in the mapping.
5. **Determine target library** — when writing to Figma, default to the first library; ask if multiple exist.
6. **Detect Code Connect eligibility** — note whether the Code Connect MCP tools return usable data (Org/Enterprise) and which Figma sides are `published`. Used only in Phase 6; never required.

---

## Phase 1: Detect drift

Run the in-scope lanes. Lanes are independent — a token-only run skips B and C.

### Lane A — Tokens

Compare normalized code tokens against Figma variables. Categorize every difference:

| Category | Description |
|----------|-------------|
| `missing_in_figma` | Token in code, not in Figma |
| `missing_in_code` | Variable in Figma, not in code |
| `value_mismatch` | Both exist, values differ |
| `type_mismatch` | Same name, different type (Number vs Color) |
| `mode_mismatch` | Variable has modes code doesn't know about |
| `scope_mismatch` | Variable scoping doesn't match expected |
| `code_syntax_mismatch` | `codeSyntax.WEB` ≠ `var(--name)` |
| `alias_mismatch` | Expected alias but got raw value (or vice versa) |
| `in_sync` | Matches perfectly |

**Token name normalization** (both directions):

| Code format | Figma variable name |
|------------|-------------------|
| DTF `background` in `colors-light.tokens.json` | `Semantic/background` (Light mode) |
| DTF `spacing-4` in `spacing.tokens.json` | `Spacing/spacing-4` |
| CSS `--background` in `:root` / `.dark` | `Semantic/background` (Light / Dark mode) |
| Tailwind `theme.extend.colors.background` | `Semantic/background` |
| Style Dictionary `color.background.value` | `Semantic/background` |

Naming: collection separator `/`, group nesting `/`, kebab-case token names, mode values go to the right mode column (not separate variables).

**Color comparison** — convert both to 6-digit lowercase hex; compare alpha with 0.01 tolerance; resolve full alias chains before comparing.

### Lane B — Components

For each `matched`, `split`, and `merged` entry (one per `component-mappings/{id}.json` file loaded in Phase 0):

1. **Read the live Figma component** via `use_figma` — its current `componentPropertyDefinitions` (names, types, and for VARIANT the value sets). Strip `#uid` suffixes to base names before comparing.
2. **Read the live code component** via `Read` — its props interface (union members, booleans, strings, slots).
3. **Diff each against the entry's `propertyMap`.** Categories:

| Category | Description |
|----------|-------------|
| `prop_missing_in_figma` | Code prop has no Figma property counterpart |
| `prop_missing_in_code` | Figma property has no code prop counterpart |
| `value_added` | New Figma enum value with no entry in `values` (would resolve to `undefined`) |
| `value_removed` | `values` maps a Figma value that no longer exists |
| `kind_mismatch` | Mapped `kind` no longer matches reality (e.g. was BOOLEAN, now VARIANT) |
| `new_component_in_figma` | Published Figma component with no mapping entry → `figma-only` candidate |
| `new_component_in_code` | Code component with no mapping entry → `code-only` candidate |
| `in_sync` | Property set and value maps match |

Do not treat `diverged` entries as drift — they are intentional; note them and move on. Use `code-rules.md` / `design-rules.md` where a judgment call is needed.

### Lane C — Mapping (structural)

Validate the mapping against ground truth:

- **Dangling refs** — `figma.nodeId` that no longer resolves, or `code.path` that no longer exists → flag for status change or removal (never auto-delete).
- **Stale status** — a former `code-only` entry that now has a Figma counterpart (or vice versa) → propose the corrected status.
- **Schema drift** — anything that would fail Zod validation after the planned applies.

---

## Phase 2: Unified drift report

One report, one section per in-scope lane. Reuse the token table format; add Components and Mapping sections.

```markdown
## Sync Report

**Scope:** [tokens + components + mapping] · **Direction:** [Bidirectional]
**Tokens:** 47 code / 42 Figma / 38 in sync · **Components:** 12 mapped / 2 drift · **Mapping:** 1 status fix

### Tokens — drift: 9
| # | Token | Category | Code | Figma | Action |
|---|-------|----------|------|-------|--------|
| 1 | `accent-soft` | missing_in_figma | `#6366f1` @10% | — | Create in Figma |
| 3 | `surface` | value_mismatch | `#f5f5f5` | `#f4f4f5` | Update Figma |

### Components — drift: 2
| # | Component | Category | Detail | Action |
|---|-----------|----------|--------|--------|
| 1 | Button | value_added | Figma `Type` gained `Tertiary` | Add `values: { Tertiary: "tertiary" }` (+ code union?) |
| 2 | Badge | prop_missing_in_code | Figma `Pulse` (BOOLEAN) has no code prop | Add `pulse` prop, or omit & note |

### Mapping — fixes: 1
| # | Entry | Issue | Action |
|---|-------|-------|--------|
| 1 | hero-illustration | now also exists in code | Change status figma-only → matched |

### Recommended actions
- Create 3 Figma variables; update 5 values; add 1 code token
- Update Button propertyMap; resolve Badge prop
- Apply 1 mapping status fix
```

---

## Phase 3: Approval gate

**MANDATORY STOP.** Present the report and wait for explicit approval before any write.

- "Apply all recommended actions?" — proceed with everything
- "Let me choose" — select specific items
- "Cancel" — exit with no changes

For bidirectional `value_mismatch` (tokens) and `value_added`/`prop_*` (components), ask which side wins: **Code wins** / **Figma wins** / **Pick per item**.

---

## Phase 4: Apply

Execute approved changes in order. **Update the `component-mappings/` files LAST**, after the Figma/code writes land, so they record the new ground truth.

### Tokens

**To Figma:** create collections/modes if needed → create missing variables (primitives, then semantic aliases) with proper scopes and `codeSyntax: { WEB: "var(--token)" }` → update mismatched values (correct mode) → fix scopes/code syntax. Batch through `use_figma`.

**To code:** read the existing token file (preserve structure, `$description`, `$type`) → add missing tokens in sibling format → update values → write. Surface CSS/Tailwind changes separately.

Apply order: collections/modes → primitives → semantic aliases → value updates → scope/code-syntax fixes.

### Components

**To Figma:** add/adjust component properties via `use_figma` per the component-creation rules in [component-contracts.md](../reference/component-contracts.md) and [build-library.md](build-library.md) (native `SLOT` for content slots, INSTANCE_SWAP fallback; capture `#uid` keys from `addComponentProperty`; bind variables; verify with the verification script). Screenshot-validate after visual changes.

**To code:** follow `code-rules.md` — add the prop/union member, translate values via `propertyMap.values`. Never invent a code prop with no Figma correspondence; never expect code for a `figma-only` component.

### Mapping files (last)

Update the `component-mappings/` files to reflect everything applied — **write per file**:
- **New component** (newly accepted `new_component_in_*`) → write a new `component-mappings/{id}.json` (filename == `id`).
- **Changed component** → rewrite only that component's `{id}.json`: update `values`/`kind`/`properties`, correct `status`, update `published`. Store base property names only.
- **Unchanged components** → leave their files untouched.
- Bump `_meta.json.generatedAt` to the current ISO 8601 time.

**Re-validate** each written file against the schema before writing (inspection — status invariants, filename == `id`, no duplicate `id`s — or `validate.mjs` on the directory).

---

## Phase 5: Re-read & confirm

1. Re-read Figma variables + component properties, and code tokens + props.
2. Re-run the in-scope lanes.
3. Confirm zero residual drift (or report what remains and why).

```markdown
## Sync Complete
**Applied:** 12 changes — 3 vars created, 5 values updated, 1 token added, 2 components updated, 1 mapping fix
**component-mappings/:** valid · **Remaining drift:** 0
```

---

## Phase 6: Persist mapping + optional Code Connect

1. The validated `component-mappings/` files are already written (Phase 4). Confirm they parse (validator on the directory, or by inspection).
2. **Code Connect (only if eligible — never required).** If Code Connect tools returned usable data and a `matched` entry has `figma.published === true`, offer:
   - **Push:** compile the entry's `propertyMap` into a `.figma.ts` template (`enum→figma.enum(values)`, `boolean→figma.boolean`, `text→figma.string`, `instanceSwap→figma.instance`, `slot→figma.children`) and publish via `add_code_connect_map` / `send_code_connect_mappings`. Defer template authoring to the official `figma-code-connect` skill (`skill://figma/figma-code-connect/SKILL.md`).
   - **Pull:** reconcile `get_code_connect_map` results back into the component's `component-mappings/{id}.json` so the two never silently diverge.
   When not eligible, skip silently. See the Code Connect bridge section in [mapping-schema.md](../reference/mapping-schema.md).

---

## Edge Cases

- **New project (no Figma variables yet):** run `--to-figma`; create all collections/modes/variables from scratch (SKILL.md collection structure).
- **No code tokens (Figma-first):** run `--to-code`; generate token files in the configured format (DTF default).
- **Conflicting modes:** Figma modes code doesn't have (e.g. "High Contrast") → flag `mode_mismatch`, never delete.
- **No mapping yet:** if `component-mappings/` is absent or empty, run `setup` first (or fall back to `--tokens`).
- **First component sync:** if entries lack `propertyMap`, build them from the live diff and present for approval before treating anything as drift.
- **Save report:** if the project has a `docs/` directory, offer to save the final report there.
