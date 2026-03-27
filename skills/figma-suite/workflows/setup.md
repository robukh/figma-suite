# Workflow: Setup

First-time initialization. Scans the codebase (if any), discovers tokens and components, and generates project-specific mappings that other workflows depend on.

**Run this automatically** if no config exists when any workflow is invoked.

---

## Workspace Location

Generated files go to one of two locations, chosen by the user during setup:

**Project-level** (default when inside a codebase):
```
{project-root}/.figma-suite/
├── config.json
├── design-rules.md
├── token-map.generated.md
├── component-contracts.generated.md
└── component-mapping.generated.md
```

**Global** (default when standalone, optional when inside a codebase):
```
<HOME>/.claude/figma-suite/{project-name}/
├── config.json
├── design-rules.md
├── token-map.generated.md
├── component-contracts.generated.md
└── component-mapping.generated.md
```

See [config-schema.md](../reference/config-schema.md) for the full config structure.

## Two Modes

### Mode A: With codebase
The user runs `/figma-suite` inside a project directory. Setup scans for tokens and components in the codebase, then stores results in the workspace. Config includes `"projectPath"` pointing back to the codebase.

### Mode B: Standalone (no codebase)
The user wants to design in Figma without a codebase — just Figma file URLs. Setup scans the Figma files for existing variables and components. Config has `"mode": "standalone"` and no `projectPath`. Workspace always goes to the global location.

### Detection logic

1. Check if the current directory is a project (has `package.json`, `Cargo.toml`, `pyproject.toml`, `.git`, or any code files)
2. If yes → Mode A (scan codebase). Ask workspace location:
   ```
   Where should I save the figma-suite workspace?
   1. Project-level (default) — .figma-suite/ in this directory
   2. Global — <HOME>/.claude/figma-suite/{project-name}/

   Reply with a number:
   ```
3. If no → ask the user:
   ```
   I don't see a codebase in this directory. How would you like to proceed?
   1. Navigate to a different project directory first
   2. Standalone mode — design in Figma without a codebase

   Reply with a number:
   ```
   If standalone → workspace goes to global location automatically.
4. Ask for a **project name** (used for the workspace folder):
   ```
   Project name (kebab-case, e.g. "my-mobile-app"):
   ```
5. Ask for Figma file URLs — see "Figma File Collection" below

All user prompts must follow the numbered-list format described in SKILL.md (Universal Safety Rules → User prompting format).

### Naming convention selection

Before scanning, ask the user to choose a naming preset. See [naming-conventions.md](../reference/naming-conventions.md) for full details.

Present the options:
1. **`figma-standard`** (default) — PascalCase components, Title Case properties, `Has/Show/Is` booleans
2. **`code-first`** — PascalCase components, camelCase properties, `has/show/is` booleans
3. **`cti`** — Category-Type-Item tokens (`color/background/primary`)
4. **`three-tier`** — Primitive → Semantic → Component token tiers
5. **`custom`** — define each aspect individually

The choice is stored in `config.json` as `"namingPreset"` and applied across all workflows. If the user already has components in Figma, detect the existing convention and suggest matching it.

### Platform selection

Ask what the user is designing for. See [figma-file-structure.md](../reference/figma-file-structure.md) for details.

1. **`mobile-ios`** — 393x852, iOS status bar, tab bar
2. **`mobile-android`** — 393x852, Android status bar, bottom nav
3. **`mobile-cross`** (default for mobile codebases) — 393x852, generic nav
4. **`tablet`** — 1024x1366, side/top nav
5. **`web-desktop`** — 1440x900, top nav
6. **`web-responsive`** — multiple breakpoints (375, 768, 1440)
7. **`landing`** — 1440 wide, auto height (hug)
8. **`custom`** — user-defined dimensions and nav

Auto-detect hint: if the codebase has `react-native` or `expo` → suggest `mobile-cross`. If it has `next`, `nuxt`, `svelte` → suggest `web-desktop`. Otherwise ask.

### File organization selection

How pages are structured in the Figma file:

1. **`page-per-component`** (default) — each component gets its own page
2. **`single-page-components`** — all components on one page with sections
3. **`flat`** — minimal pages, best for small projects
4. **`custom`** — user defines page structure

### Component page layout

How each component is documented within its page/section:

1. **`full`** (default) — variant matrix + specs + usage examples
2. **`compact`** — component set + brief annotation
3. **`variants-only`** — just the component set, no docs

### Dark mode strategy

1. **`variable-modes`** (default) — single frame, toggle via variable modes
2. **`duplicate-frames`** — side-by-side light/dark frames

All choices stored in config and respected by every workflow.

### Figma file collection

Ask the user for their Figma file URLs. A project has two kinds of files:

**Libraries** — published design system files containing components and variables. Most projects have one; some have multiple (e.g., icon library + component library, or shared primitives + product-specific library).

**Design files** — files where screens are composed using library components. A project often has several (e.g., one per feature area or platform).

Collect files in this order:

1. **"Paste the URL of your design system library file"** — extract fileKey, call `mcp__figma__get_metadata` for the name. Add to `config.libraries[]`.
2. **"Do you have additional library files? (icon library, shared primitives, etc.)"** — if yes, repeat. If no, move on.
3. **"Paste the URL of a design file where you compose screens"** — extract fileKey, get name. Add to `config.designFiles[]`.
4. **"Do you have additional design files?"** — if yes, repeat. If no, move on.

If the user only has a single file (library and screens in one), add it to both `libraries` and `designFiles`.

The user can add more files later at any time by saying "add a library" or "add a design file" — re-run setup will prompt for additional files without losing existing ones.

---

## Phase 0: Scan Token Files (Mode A only)

1. Search for token files in discovery order (see SKILL.md auto-discovery)
2. For each found file, read and classify every token:
   - Name, type (`color`, `number`, `string`), value, description
   - Category: `colors`, `typography`, `spacing`, `radii`, `shadows`, `other`
   - Mode context: which file/selector determines the mode (e.g., `colors-light.json` → Light mode)
3. Build a normalized token inventory

### Output: Token inventory

```markdown
## Token Inventory

### Colors (N tokens)
| Token name | Type | Light value | Dark value | Figma variable |
|-----------|------|------------|-----------|----------------|
| background | color | #ffffff | #0a0a0a | Semantic/background |
...

### Typography (N tokens)
| Token name | Type | Value | Figma variable |
|-----------|------|-------|----------------|
| font-size/display | number | 56 | Typography/font-size/display |
...

### Spacing, Radii, etc.
...
```

---

## Phase 1: Scan Components (Mode A only)

1. Search for UI components in common paths
2. For each component file, extract:
   - **Component name**
   - **Props interface** — variant unions, boolean flags, string props, ReactNode slots
   - **Styling tokens used**
   - **Child components imported**
3. Build a component dependency graph

### Output: Component contracts

```markdown
## Component Contracts

### Build Order
Tier 1: [discovered primitives]
Tier 2: [discovered interactive components]
Tier 3: [discovered containers]
Tier 4: [discovered overlays]

### ComponentName
- **File:** path/to/Component.tsx
- **Variants:** variant values
- **Sizes:** size values
- **Boolean props:** list
- **Text props:** list
- **Slots:** list (ReactNode props)
- **Tokens used:** list
- **Dependencies:** list of child components
- **Figma component:** ComponentName/Variant=Default
...
```

---

## Phase 1b: Scan Figma Files (Mode B, or Mode A if library URLs provided)

For each file in `config.libraries[]` and `config.designFiles[]`, use `mcp__figma__use_figma` with Plugin API to read **local** file content directly. Do NOT rely on `get_variable_defs` or `search_design_system` for local/unpublished content — they only return published library data and may fail.

### Step 1: Scan pages
```javascript
const pages = figma.root.children.map(p => ({ id: p.id, name: p.name }));
return JSON.stringify(pages);
```

### Step 2: Scan local variables
```javascript
const collections = await figma.variables.getLocalVariableCollectionsAsync();
const result = [];
for (const col of collections) {
  const modes = col.modes.map(m => m.name);
  const vars = [];
  for (const varId of col.variableIds) {
    const v = await figma.variables.getVariableByIdAsync(varId);
    if (v) vars.push({ name: v.name, type: v.resolvedType });
  }
  result.push({ name: col.name, modes, variableCount: vars.length, variables: vars });
}
return JSON.stringify(result);
```

### Step 3: Scan local text styles and components
```javascript
const textStyles = await figma.getLocalTextStylesAsync();
const ts = textStyles.map(s => ({ name: s.name, fontSize: s.fontSize, family: s.fontName?.family, style: s.fontName?.style }));

const componentSets = figma.root.findAllWithCriteria({ types: ["COMPONENT_SET"] });
const cs = componentSets.map(c => ({ name: c.name, page: c.parent?.parent?.name || c.parent?.name, id: c.id }));

const standaloneComponents = figma.root.findAllWithCriteria({ types: ["COMPONENT"] })
  .filter(c => !c.parent || c.parent.type !== "COMPONENT_SET");
const sc = standaloneComponents.map(c => ({ name: c.name, page: c.parent?.parent?.name || c.parent?.name, id: c.id }));

return JSON.stringify({ textStyles: ts, componentSets: cs, standaloneComponents: sc });
```

**Critical:** Always use `return JSON.stringify(...)` — never `console.log()`. Console output is discarded.

**If results are large:** Split into separate `use_figma` calls (pages, then variables, then styles+components) rather than one massive query.

### Step 4: Merge and generate
Merge results across all files into unified inventories:
- Generate `token-map.generated.md` from all variables (deduplicate by name, flag conflicts)
- Generate `component-contracts.generated.md` from all components (prefix with file name if ambiguous)

---

## Phase 2: Detect Composition Relationships (Mode A)

From the dependency graph, determine:

1. **Which components nest which**
2. **Build tiers** — components with no library dependencies are Tier 1, etc.
3. **Property propagation** — which child props should be exposed through the parent

---

## Phase 3: Generate Config

Generate `config.json` following the schema defined in [config-schema.md](../reference/config-schema.md).

Steps:
1. Fill from discovery results (Mode A) or Figma scan (Mode B)
2. Populate `libraries[]` and `designFiles[]` from collected Figma URLs
3. Present config for review before writing
4. Write to `<HOME>/.claude/figma-suite/{project-name}/config.json`

---

## Phase 4: Generate Mapping Files

Write to the appropriate location (project-local or global workspace):

- **token-map.generated.md** — every token mapped to its Figma variable name, collection, mode, type, scopes
- **component-contracts.generated.md** — every component with props, variants, tokens, dependencies, build tier
- **component-mapping.generated.md** — the relationship between code and Figma components (see below)

### Component Mapping

Code and Figma components rarely have a perfect 1:1 match. This file tracks the real relationship and intentional differences.

Each entry has a **status**:

| Status | Meaning |
|--------|---------|
| `matched` | Code component has a direct Figma counterpart — keep in sync |
| `code-only` | Exists in code but has no Figma representation (wrappers, hooks, logic-only) |
| `figma-only` | Exists in Figma but not in code (illustrations, decorative, presentation-only) |
| `split` | One code component maps to multiple Figma components (e.g., by state) |
| `merged` | Multiple code components map to one Figma component (e.g., screen-level) |
| `diverged` | Both exist but intentionally differ — document why |

Example format:

```markdown
## Component Mapping

| Code component | Figma component | Status | Notes |
|---------------|----------------|--------|-------|
| Button | Button | matched | — |
| EmptyState | EmptyState | matched | — |
| BottomSheet | BottomSheet | diverged | Code is a native wrapper; Figma is visual representation with content slot |
| DashboardView | Dashboard / Active, Dashboard / Empty | split | Different Figma components per state |
| WeightScreen | — | code-only | Screen-level component, composed from sub-components in Figma |
| — | Hero Illustration | figma-only | Decorative, no code equivalent |
| ProgressRing | ProgressRing | diverged | Code uses SVG animation; Figma is static with gradient fill |
```

**This file is user-editable.** Setup auto-generates initial mappings by matching names. The user (or Claude during audit) refines the statuses and notes over time. Re-running setup preserves manual edits and only adds newly discovered components.

The mapping is used by:
- **build-library** — skips `code-only` and `figma-only` entries, handles `split`/`merged` correctly
- **audit** — checks `matched` pairs for drift, ignores `diverged` with documented reason
- **sync** — only syncs tokens, not affected by component mapping
- **design** — knows which Figma components to use regardless of code structure

---

## Phase 5: Generate Design Rules

After scanning libraries and components, auto-generate a `design-rules.md` file in the workspace folder. This file contains project-specific rules that the AI follows when designing, building components, or auditing.

### Generation process

1. **Read the library's spacing scale** — extract all spacing variables, identify the most commonly used values, infer padding and gap conventions
2. **Read the library's radius scale** — extract all radius variables, map to common use cases (cards, buttons, inputs)
3. **Read the library's typography scale** — extract all text styles or typography variables, infer a hierarchy (title, heading, body, caption)
4. **Read the library's color semantics** — extract semantic color names, identify background/surface/accent/foreground roles
5. **Analyze existing components** — extract sizing patterns, common padding/gap values used in built components
6. **Analyze existing screens** (if design files are connected) — infer layout conventions from actual designs (screen padding, section gaps, card patterns)
7. **Generate `design-rules.md`** with concrete values derived from what was found — see [config-schema.md](../reference/config-schema.md) for the expected format

### Present for review

Show the generated rules to the user:

```
Here are the design rules I generated based on your library:

[generated content]

You can edit this file at any time:
  [workspace-path]/design-rules.md

Want me to save this, or would you like to make changes first?
```

The user can edit the file directly at any time. All workflows read it before operating.

---

## Phase 6: Summary

```markdown
## Setup Complete

### Mode: [Codebase | Standalone]
### Project: [name]
### Libraries: [list of library names and file keys]
### Design files: [list of design file names and file keys]

### Tokens discovered: N
### Components discovered: N (Tier 1: N, Tier 2: N, Tier 3: N, Tier 4: N)

### Generated files
- [config path]
- [design-rules path]
- [token-map path]
- [component-contracts path]

### Next steps
1. Review and edit your design rules: [workspace-path]/design-rules.md
2. Run `/figma-suite sync` to push/pull tokens
3. Run `/figma-suite build-library` to create components
```

---

## Re-running Setup

Running `/figma-suite setup` again will:
1. Re-scan the project (or Figma files) for changes
2. Show a diff of what changed since last setup
3. Update the generated files after approval
4. Never overwrite manual edits to config or design rules — only add newly discovered paths
5. Offer to add new library or design file URLs
6. Offer to regenerate design rules (with option to preserve manual edits)

---

## Managing Multiple Projects

Each project gets its own workspace folder with config, design rules, and generated files. They never interfere:

- **Project-level workspaces** live in `{project-root}/.figma-suite/` — one per project, travels with the repo
- **Global workspaces** live in `<HOME>/.claude/figma-suite/{project-name}/` — personal to this machine
- Switching projects = switching directories (Claude Code handles this naturally)
- Listing global workspaces: scan `<HOME>/.claude/figma-suite/*/config.json`
