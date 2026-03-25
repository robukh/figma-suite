# Workflow: Sync Tokens

Bidirectional sync between code design tokens and Figma variables. Detects drift, reports differences, and applies changes after user approval.

## Modes

| Flag | Direction | Description |
|------|-----------|-------------|
| *(default)* | Bidirectional | Show drift both ways, ask user which to resolve |
| `--to-figma` | Code to Figma | Push code tokens into Figma variables |
| `--to-code` | Figma to Code | Pull Figma variables into code token files |

---

## Phase 0: Discovery

1. **Load config** — read `config.json` from workspace folder or auto-discover token files
2. **Read code tokens** — parse all token files into a normalized map:
   ```
   { name: string, type: "color"|"number"|"string", value: any, mode?: string, collection: string }
   ```
3. **Read Figma variables** — for each library in `config.libraries[]`, call `mcp__figma__get_variable_defs` to get all variable collections, modes, and values. If multiple libraries, merge results (flag conflicts by library name).
4. **Determine target library** — when writing to Figma, use the first library by default. If multiple libraries exist, ask the user which library to write to.
5. **Normalize both sides** — map code token names to expected Figma variable names using naming policy

### Token format normalization

| Code format | Figma variable name |
|------------|-------------------|
| DTF: `background` in `colors-light.tokens.json` | `Semantic/background` (Light mode) |
| DTF: `spacing-4` in `spacing.tokens.json` | `Spacing/spacing-4` |
| CSS: `--background` in `:root` | `Semantic/background` (Light mode) |
| CSS: `--background` in `.dark` | `Semantic/background` (Dark mode) |
| Tailwind: `theme.extend.colors.background` | `Semantic/background` |
| Style Dictionary: `color.background.value` | `Semantic/background` |

### Naming conventions

- Collection separator: `/` (e.g., `Semantic/background`)
- Group nesting: `/` (e.g., `Primitives/neutral/50`)
- Mode-specific values go into the appropriate mode column, not separate variables
- Kebab-case for token names (e.g., `surface-secondary`, not `surfaceSecondary`)

---

## Phase 1: Diff

Compare normalized code tokens against Figma variables. Categorize every difference:

| Category | Description | Example |
|----------|-------------|---------|
| `missing_in_figma` | Token exists in code but not in Figma | New token added to code |
| `missing_in_code` | Variable exists in Figma but not in code | Designer added a variable |
| `value_mismatch` | Both exist but values differ | Color updated in code |
| `type_mismatch` | Same name but different type | Number vs Color |
| `mode_mismatch` | Variable has modes code doesn't know about | Extra Figma mode |
| `scope_mismatch` | Variable scoping doesn't match expected | Wrong scope set |
| `code_syntax_mismatch` | `codeSyntax.WEB` doesn't match `var(--name)` | Missing or wrong code syntax |
| `alias_mismatch` | Expected alias but got raw value (or vice versa) | Broken reference |
| `in_sync` | Matches perfectly | No action needed |

### Color comparison

Colors must be compared with tolerance for floating-point precision:
- Convert both to hex (6-digit lowercase)
- Alpha: compare with 0.01 tolerance
- If code uses `rgba()` or component arrays, convert to hex first

### Drift report format

```markdown
## Token Sync Report

**Direction:** [Bidirectional | Code to Figma | Figma to Code]
**Code tokens:** 47 | **Figma variables:** 42 | **In sync:** 38

### Drift found: 9 items

| # | Token | Category | Code value | Figma value | Action |
|---|-------|----------|-----------|-------------|--------|
| 1 | `accent-soft` | missing_in_figma | `#6366f1` @ 10% | -- | Create in Figma |
| 2 | `new-color` | missing_in_code | -- | `#ff0000` | Add to code tokens |
| 3 | `surface` | value_mismatch | `#f5f5f5` | `#f4f4f5` | Update Figma |
...

### Recommended actions
- **Create 3 variables** in Figma (Semantic collection)
- **Add 1 token** to colors-light.tokens.json
- **Update 5 values** in Figma to match code
```

---

## Phase 2: Approval Gate

**MANDATORY STOP.** Present the drift report to the user and wait for explicit approval before any writes.

Ask the user:
- "Apply all recommended actions?" — proceed with everything
- "Let me choose" — let them select specific items
- "Cancel" — exit without changes

If bidirectional, ask which direction takes priority for `value_mismatch` items:
- "Code wins" — overwrite Figma values
- "Figma wins" — overwrite code values
- "Pick per item" — ask for each mismatch

---

## Phase 3: Apply

Execute approved changes in strict order:

### Writing to Figma

1. **Create collections/modes** if they don't exist yet
2. **Create missing variables** (primitives first, then semantic aliases)
   - Use a single `mcp__figma__use_figma` call with Plugin API code that loops through all tokens
   - Set proper scopes per token type (see SKILL.md scoping rules)
   - Set `codeSyntax: { WEB: "var(--token-name)" }` on every variable
3. **Update mismatched values**
   - Use `mcp__figma__use_figma` with Plugin API code to batch-update values
   - For multi-mode variables, update the correct mode
4. **Fix scopes and code syntax** on existing variables

### Writing to code

1. **Read existing token file** to preserve structure and formatting
2. **Add missing tokens** in the same format as siblings
3. **Update mismatched values** — preserve `$description` and `$type`
4. **Write updated file** using the Write tool
5. If CSS variables or Tailwind config need updating, show those as separate changes

### Apply order matters

```
Collections and modes (create if needed)
  → Primitive variables (raw values)
    → Semantic variables (aliases into primitives)
      → Value updates on existing variables
        → Scope and code syntax fixes
```

---

## Phase 4: Validation

1. **Re-read Figma variables** — verify creates and updates landed
2. **Re-read code tokens** — verify file writes are correct
3. **Run diff again** — confirm drift is resolved
4. **Generate final report**:

```markdown
## Sync Complete

**Applied:** 9 changes
- Created 3 Figma variables
- Updated 5 Figma variable values
- Added 1 code token

**Remaining drift:** 0 items
```

5. **Save report** — if the project has a `docs/` directory, offer to save the report there

---

## Edge Cases

### New project (no Figma variables yet)
Run as `--to-figma`. Create all collections, modes, and variables from scratch. Follow the collection structure in SKILL.md.

### No code tokens (Figma-first workflow)
Run as `--to-code`. Read all Figma variables and generate token files in the configured format (DTF by default).

### Conflicting modes
If Figma has modes that code doesn't (e.g., "High Contrast"), flag them as `mode_mismatch` but never delete. Let the user decide.

### Alias chains
If a Figma variable aliases another that aliases another, resolve the full chain before comparing to code values.
