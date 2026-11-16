# Workflow: Sync (the bidirectional loop)

Keeps the whole contract converged across **four lanes**: tokens, components, the component mapping, and DESIGN.md. The user edits either side; `sync` detects drift, reports the cascade in one dry-run, applies after approval, re-reads, and records the new state.

**Contents:** [Flags](#flags) · [Loop](#the-loop) · [Phase 0](#phase-0-discover-and-check) · [Phase 1: Drift](#phase-1-detect-drift) · [Phase 2: Report](#phase-2-one-cascade-report) · [Phase 3: Approval](#phase-3-approval-gate) · [Phase 4: Apply](#phase-4-apply) · [Phase 5: Confirm](#phase-5-re-read-confirm-record-state) · [Code Connect](#phase-6-optional-code-connect) · [Edge cases](#edge-cases)

Load first: [official-skills.md](../reference/official-skills.md) (`figma-use`, plus `figma-generate-library` when components change, `figma-design-to-code` for `--to-code`). Safety rules: [SKILL.md](../SKILL.md#safety-rules-apply-to-every-workflow).

## Flags

| Invocation | Scope |
|---|---|
| `sync` | full loop: tokens + components + mapping + DESIGN.md |
| `sync --tokens` | tokens (and the DESIGN.md token blocks they feed) |
| `sync --components` | components + mapping (and DESIGN.md `components:` ids) |
| `--to-figma` / `--to-code` | one direction, composes with scope flags |
| *(no direction)* | show drift both ways, ask which side wins per item |

## The loop

```
0 discover + contract check → 1 detect drift (4 lanes) → 2 one cascade report
→ 3 approval gate (stop) → 4 apply (tokens → components → mapping → DESIGN.md) → 5 re-read, check, record state
```

## Phase 0: Discover and check

1. Read the project snapshot / `config.json`. Read code tokens (skip for `--components`) into `{ name, type, value, mode, collection }`.
2. Read Figma state with `use_figma` (local content): variables per collection (ids and names first, values only for the ids being compared), and `componentPropertyDefinitions` only for the owning component sets in the mapping. `get_variable_defs` only sees published data.
3. Run the contract check. Mapping or DESIGN.md **errors stop the sync** (a broken mapping makes the component lane unreliable); warnings, especially `stale-*`, are drift candidates for the report.
4. Target library: the first in `config.libraries[]`, ask if several. Note Code Connect eligibility (used only in Phase 6).

## Phase 1: Detect drift

Lanes are independent; a scoped run skips the rest.

### Lane A — Tokens

Categories: `missing_in_figma`, `missing_in_code`, `value_mismatch`, `type_mismatch`, `mode_mismatch` (Figma modes code lacks → flag, never delete), `scope_mismatch`, `code_syntax_mismatch` (`codeSyntax.WEB` ≠ `var(--name)`), `alias_mismatch`, `in_sync`.

Name normalization (both ways): collection separator `/`, group nesting `/`, kebab-case names, mode values in the mode column rather than separate variables. Examples: DTCG `background` in `colors-light.tokens.json` → `Semantic/background` (Light); `spacing-4` in `spacing.tokens.json` → `Spacing/spacing-4`; CSS `--background` in `:root` / `.dark` → `Semantic/background` (Light / Dark); Tailwind `theme.extend.colors.background` → `Semantic/background`. Compare colors as 6-digit lowercase hex with 0.01 alpha tolerance, after resolving alias chains.

### Lane B — Components

For each `matched`, `split` and `merged` mapping file: read the live Figma component's property definitions (base names, VARIANT value sets) and the live code props, then diff against `propertyMap`: `prop_missing_in_figma`, `prop_missing_in_code`, `value_added` (new Figma value with no `values` entry), `value_removed`, `kind_mismatch`, `new_component_in_figma` (→ `figma-only` candidate), `new_component_in_code` (→ `code-only` candidate), `in_sync`. `diverged` entries are intentional, not drift.

### Lane C — Mapping (structural)

Dangling refs (`figma.nodeId` no longer resolves; `code.path` missing), stale status (a `code-only` entry that now has a Figma counterpart, or the reverse), anything that would fail the contract check after the planned applies. Never auto-delete.

### Lane D — Design contract (DESIGN.md)

Compare DESIGN.md with the other three lanes: generated token blocks vs the token source; `components:` ids vs mapping files (add/remove entries, mark orphans); allowed `variants` vs mapping `values` (a `value_added` in Lane B usually means "propose adding the variant to the policy or banning it"); Figma bindings block vs live component keys; golden reference node ids that no longer resolve. **Generated blocks are rewritten; authored sections are never written, only proposed as a suggestion** (for example "button gained a Tertiary variant — add a rule for it under Components?").

## Phase 2: One cascade report

One report, one section per in-scope lane, **plus the cascade**: show what a single change touches everywhere, so nothing is applied half-way.

```markdown
## Sync report — scope: full · direction: bidirectional
Tokens: 47 code / 42 Figma / 38 in sync · Components: 12 mapped, 2 drift · Mapping: 1 fix · DESIGN.md: 3 updates

### Cascade
- `action-primary` renamed in code → Figma variable rename · DESIGN.md `{colors.action-primary}` refs (3) · mapping values using it (0)

### Tokens (9)   | # | Token | Category | Code | Figma | Action |
### Components (2) | # | Component | Category | Detail | Action |
### Mapping (1)  | # | Entry | Issue | Action |
### DESIGN.md (3) | # | Block / section | Change | Generated or proposed |
```

## Phase 3: Approval gate

Stop. "Apply all recommended / let me choose / cancel". For bidirectional conflicts ask per item: code wins, Figma wins, or pick per item. Never write before approval.

## Phase 4: Apply

Order: **tokens → components → mapping files → DESIGN.md**. Mapping and DESIGN.md go last so they record the new ground truth.

- **Tokens to Figma:** create collections/modes, then primitives, then semantic aliases (scopes by role, `codeSyntax: { WEB: "var(--token)" }`), then value, scope and syntax fixes. Batch retry-safe work in few `use_figma` calls.
- **Tokens to code:** read the file first, preserve structure and descriptions, add or update in the sibling format, show the diff before writing; surface CSS/Tailwind changes separately.
- **Components to Figma:** per [component-contracts.md](../reference/component-contracts.md) and [build-library.md](build-library.md) (SLOT vs INSTANCE_SWAP per region, variables bound, verification table). **To code:** follow `code-rules.md`, translate values through `propertyMap.values`, load `figma-design-to-code` before `get_design_context`; never invent a code prop without a Figma counterpart.
- **Mapping:** write only new or changed `{id}.json` files (base property names), leave the rest untouched, bump `_meta.json.generatedAt`.
- **DESIGN.md:** rewrite the generated token and bindings blocks; apply approved suggestions to authored sections.

## Phase 5: Re-read, confirm, record state

1. Re-read both sides and re-run the in-scope lanes; confirm zero residual drift or explain what remains.
2. Run the contract check with `--write-state`. State is written only when there are no errors.
3. Report: changes applied per lane, mapping and DESIGN.md status, remaining drift. Offer to save the report in `docs/` if the project has one.

## Phase 6: Optional Code Connect

If the Code Connect tools return usable data and a `matched` entry has `figma.published === true`, offer **push** (compile `propertyMap` into a `.figma.ts` template; authoring rules in the official `figma-code-connect` skill; publish with `add_code_connect_map` / `send_code_connect_mappings`, which prompt) or **pull** (reconcile `get_code_connect_map` into the mapping file). Otherwise skip silently. See [mapping-schema.md](../reference/mapping-schema.md#code-connect-bridge).

## Edge cases

- **No Figma variables yet:** `--to-figma` creates collections, modes and variables from scratch ([token-map.md](../reference/token-map.md)).
- **No code tokens (Figma-first):** `--to-code` generates token files in the configured format (DTCG default).
- **No mapping yet:** run `setup` first, or fall back to `--tokens`.
- **First component sync** (entries without `propertyMap`): build from the live diff and present for approval before treating anything as drift.
- **No DESIGN.md yet:** offer `design-md`; the other lanes still run.
