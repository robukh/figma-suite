---
name: figma-suite
description: >
  Bidirectional design system sync between code and Figma — tokens/variables,
  components, and a Zod-validated code<->Figma component mapping — plus component
  library generation, screen design composition, and design audit. Use when syncing
  design tokens or components to/from Figma, keeping code and Figma components in sync,
  mapping code props to Figma properties (incl. Code Connect), building Figma component
  libraries, designing new screens in Figma, or auditing Figma files for compliance.
argument-hint: "[sync|build-library|design|audit|update-guide] [options]"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, WebSearch, mcp__figma__get_design_context, mcp__figma__get_screenshot, mcp__figma__get_metadata, mcp__figma__search_design_system, mcp__figma__use_figma, mcp__figma__get_variable_defs, mcp__figma__generate_figma_design, mcp__figma__get_figjam, mcp__figma__whoami, mcp__figma__get_code_connect_map, mcp__figma__get_code_connect_suggestions, mcp__figma__get_context_for_code_connect, mcp__figma__send_code_connect_mappings, mcp__figma__add_code_connect_map, mcp__figma__create_design_system_rules
compatibility: >
  Requires the official Figma MCP server (https://mcp.figma.com/mcp), a first-party
  remote endpoint operated by Figma, Inc. The mcp__figma__use_figma tool sends Figma
  Plugin API code to this server for execution within the user's authenticated Figma
  session. All operations require user-initiated OAuth authentication and edit access
  to the target Figma files. No data is sent to any third-party or skill-author-controlled
  endpoint.
metadata:
  author: robukh
  version: "1.3.0"
  external-endpoint: https://mcp.figma.com/mcp
  external-endpoint-provider: Figma, Inc.
  external-endpoint-auth: OAuth (user-initiated)
  external-endpoint-docs: https://developers.figma.com/docs/figma-mcp-server/remote-server-installation/
---

# Figma Design Skill

Bridges a codebase design system and a Figma file. Handles token sync, component library generation, screen design, auditing, and guideline updates — all through Figma MCP tools.

> **Progressive disclosure:** Only load workflow and reference files when actively executing that workflow. Do not eagerly read all linked files — they are large and consume context unnecessarily.

## Prerequisites

This skill requires the **official Figma MCP server**:

| Server | Tools used |
|--------|-----------|
| `figma` (remote server at `https://mcp.figma.com/mcp`) | `mcp__figma__get_design_context`, `mcp__figma__get_screenshot`, `mcp__figma__get_metadata`, `mcp__figma__search_design_system`, `mcp__figma__use_figma`, `mcp__figma__get_variable_defs`, `mcp__figma__generate_figma_design` |

The `mcp__figma__use_figma` tool accepts Figma Plugin API code, which covers all operations including variable creation, component building, and batch updates — no second server needed.

If the server is not configured, guide the user to set it up:
- **Claude Code:** `claude plugin install figma@claude-plugins-official`
- **Other editors:** Add remote MCP server URL `https://mcp.figma.com/mcp` and authenticate via OAuth
- **Docs:** https://developers.figma.com/docs/figma-mcp-server/remote-server-installation/

### Troubleshooting

Server connected but returning errors:
- **Auth expired** → re-authenticate via OAuth
- **File not found / no access** → verify edit access to the file
- **Rate limits** → wait briefly, retry, batch to reduce call count
- **Plugin API errors** → read the `use_figma` error; usually stale nodeIds or missing fonts

---

## Configuration

Run `/figma-suite setup` to generate config and project mappings.

### Workspace location

Setup detects the scenario and asks where to save. Inside a project, ask:
```
Where should I save the figma-suite workspace?
1. Project-level (default) — .figma-suite/ in this project directory (shared with teammates via git)
2. Global — <HOME>/.claude/figma-suite/{project-name}/ (personal, not committed)

Reply with a number:
```

| Scenario | Save location |
|----------|---------------|
| Standalone (no codebase) | `<HOME>/.claude/figma-suite/{project-name}/` (only option) |
| Inside a project — project-level (default) | `{project-root}/.figma-suite/` (shared; `.gitignore` it to keep local) |
| Inside a project — global | `<HOME>/.claude/figma-suite/{project-name}/` (personal, per-machine) |

`<HOME>` = home directory (`~` macOS/Linux, `%USERPROFILE%` Windows) — resolve to absolute path at runtime.

### Auto-discovery order (workspace)

1. `{project-root}/.figma-suite/config.json` — project-level workspace
2. `<HOME>/.claude/figma-suite/*/config.json` — global workspace matching `projectPath`
3. If neither found → run setup

### Auto-discovery order for tokens (codebase mode)

1. `design-tokens/*.tokens.json` — W3C Design Token Format (DTF/DTCG)
2. `tokens/**/*.json` — Style Dictionary format
3. `tailwind.config.js` / `tailwind.config.ts` — Tailwind theme tokens
4. `src/global.css` or `src/styles/globals.css` — CSS custom properties
5. `theme.ts` / `theme.js` — JS theme objects

Classify discovered tokens into: **colors**, **typography**, **spacing**, **radii**, **shadows**, **other**. A project can reference **multiple library files** and **multiple design files** — see [config-schema.md](reference/config-schema.md) for the full config structure.

---

## Workflow Router

Dispatch based on `$ARGUMENTS`:

| Argument | Workflow | Description |
|----------|----------|-------------|
| `setup` | [setup.md](workflows/setup.md) | First-time init: scan project, generate token map, component contracts, and the `component-mappings/` directory |
| `sync` | [sync.md](workflows/sync.md) | **Full bidirectional loop** — diff tokens + components + mapping, report, apply after approval, update the `component-mappings/` files |
| `sync --tokens` | [sync.md](workflows/sync.md) | Tokens only (classic token sync) |
| `sync --components` | [sync.md](workflows/sync.md) | Components + mapping only |
| `sync --to-figma` / `--to-code` | [sync.md](workflows/sync.md) | One-way direction (composes with scope flags) |
| `build-library` | [build-library.md](workflows/build-library.md) | Generate or rebuild Figma component library from code components |
| `design <description>` | [design-screen.md](workflows/design-screen.md) | Compose a new screen in Figma using design system components |
| `audit` | [audit.md](workflows/audit.md) | Read-only audit of Figma file for DS compliance |
| `update-guide` | [update-guidelines.md](workflows/update-guidelines.md) | Sync design guidelines between code docs and Figma annotations |
| *(no argument)* | Check if setup has been run; if not, run `setup`. Otherwise show the workflow menu. |

---

## Universal Safety Rules

These rules apply across ALL workflows:

### User prompting format

Whenever presenting the user with a choice, always use a **numbered list** with a clear default marked. Let the user reply with just a number or type a custom answer. Never present walls of text without structure.

```
Pick a platform:
1. mobile-ios (default) — 393×852, iOS status bar, tab bar
2. mobile-android — 393×852, Android status bar, bottom nav
3. web-desktop — 1440×900, top nav
4. custom — define your own

Reply with a number or describe your setup:
```

For yes/no questions, offer both options explicitly:
```
Apply all 9 changes? (yes / no / let me choose)
```

For text input, show what's expected:
```
Project name (kebab-case, e.g. "my-mobile-app"):
```

### Dry-run first
Every write produces a **dry-run report** first. Never write to Figma or code without user approval.

### Screenshot validation
After every visual change, capture a screenshot with `mcp__figma__get_screenshot` and verify. Max 3 fix iterations per section.

### Never delete without confirmation
Never delete tokens, variables, components, or pages. Flag stale items in the report for the user to decide.

### Preserve existing work
Back up / duplicate affected Figma frames before overwriting; show the diff before writing code tokens.

### Work incrementally

**Do one thing per `use_figma` call** — the top cause of bugs is doing too much in one call.

1. **Inspect first** — read-only `use_figma` to discover existing pages, components, variables, naming conventions
2. **Do one thing per call** — create variables in one call, components in the next, layouts in another
3. **Return all node IDs** — always `return { createdNodeIds: [...], mutatedNodeIds: [...] }`
4. **Validate after each step** — `get_metadata` for structure, `get_screenshot` for visuals
5. **Fix before moving on** — don't build on a broken foundation

### Sequential Figma writes
Never parallelize `use_figma` calls. Each must complete and be verified before the next.

### Page context resets between calls

`figma.currentPage` always starts on the **first page** at the beginning of each `use_figma` call. If your workflow targets a non-default page, call `await figma.setCurrentPageAsync(page)` at the start of each call. The sync setter `figma.currentPage = page` throws — always use the async version.

### Error recovery

**`use_figma` is atomic — failed scripts do NOT execute.** On error, no changes land; the file stays exactly as before. Safe to retry after fixing the script — no cleanup needed.

When `use_figma` returns an error:

1. **STOP** — do NOT immediately retry the same script
2. **Read the error message** — understand what went wrong
3. **If unclear**, call `get_metadata` or `get_screenshot` to check file state
4. **Fix the script** and retry

For code/file write failures (non-atomic):

1. **Identify what succeeded** — read back from Figma or code to see which changes landed
2. **Report partial state** — tell the user exactly what was applied and what wasn't
3. **Never retry blindly** — re-read state first to avoid duplicates
4. **Offer to resume** — present remaining changes as a new dry-run report
5. **Common failures:**
   - `use_figma` timeout → split the batch into smaller chunks
   - Stale nodeId → re-query via `get_metadata` or `use_figma`
   - Missing font → ask user to install or pick an alternative
   - File locked → wait and retry once, then ask user to close other editors
   - Rate limit → wait 5 seconds, retry with smaller batch size

---

## Token Architecture

The skill uses a two-collection model that works across token formats:

```
Primitives Collection (1 mode: "Value")
├── Raw color values (hex)
├── Raw spacing values (px)
├── Raw typography values (px, font names)
└── Hidden from consumers (scope: [])

Semantic Collection (N modes: "Light", "Dark", etc.)
├── Aliases into Primitives
├── Purpose-named (background, foreground, accent, surface, etc.)
└── Scoped to specific properties (FILL_COLOR, STROKE_COLOR, etc.)
```

### Variable scoping rules

| Token type | Figma scopes |
|-----------|--------------|
| Primitive colors | `[]` (hidden) |
| Semantic colors | `["FILL_COLOR", "STROKE_COLOR"]` |
| Spacing | `["GAP", "WIDTH_HEIGHT"]` |
| Radii | `["CORNER_RADIUS"]` |
| Font size | `["FONT_SIZE"]` |
| Font family | `["FONT_FAMILY"]` |
| Font weight | `["FONT_WEIGHT"]` |
| Line height | `["LINE_HEIGHT"]` |

### Code syntax

All variables must have `codeSyntax` with the `var()` wrapper for web consumption:
```
codeSyntax: { WEB: "var(--token-name)" }
```

### Choosing the right token

- **Consume the Semantic tier; Primitives are reference-only** — bind to `action-primary`, never `blue-500`.
- **Pick by role when tokens pixel-match** — inline gap → `gap-inline`, not any 8px `spacing-4`.
- **Reuse before you create** — a one-off is a raw value + logged exception, not a token.
- **Two tiers is the default** — add a component-token tier only at enterprise scale.

Full reasoning + reject list: [design-judgment.md §1](reference/design-judgment.md#1-token-judgment).

---

## MCP Tool Quick Reference

### Reading from Figma — local file content

**Always use `mcp__figma__use_figma` with Plugin API to read local file content.** The read-only MCP tools (`get_variable_defs`, `search_design_system`) only return **published library** data and may fail on local/unpublished content. To reliably read what's actually in the file:

| Task | Approach |
|------|----------|
| Local variables & collections | `use_figma` → `figma.variables.getLocalVariableCollectionsAsync()` + `getVariableByIdAsync()` |
| Local text styles | `use_figma` → `figma.getLocalTextStylesAsync()` |
| Local components | `use_figma` → `figma.root.findAllWithCriteria({ types: ["COMPONENT_SET"] })` |
| Local standalone components | `use_figma` → `figma.root.findAllWithCriteria({ types: ["COMPONENT"] })` |
| Page structure | `use_figma` → `figma.root.children.map(p => ({ id: p.id, name: p.name }))` |

**Critical `use_figma` rules for reading:**
- Always use `return JSON.stringify(result)` — **never** `console.log()`. Console output is discarded; only `return` values come back.
- If the result is large, split into multiple targeted queries rather than one massive dump.

### Reading from Figma — published libraries and metadata

These tools work for published/external library data and file metadata:

| Task | Tool |
|------|------|
| Search published DS components | `mcp__figma__search_design_system` |
| Get component design context | `mcp__figma__get_design_context` with nodeId |
| Take screenshot | `mcp__figma__get_screenshot` |
| Get file structure (pages) | `mcp__figma__get_metadata` — **avoid on root node** (`0:1`) for large files, it will overflow. Use on specific page nodeIds or use `use_figma` instead. |
| Get published variables | `mcp__figma__get_variable_defs` — **may fail** with "select a layer first" error. Fall back to `use_figma` Plugin API. |

### Writing to Figma
| Task | Tool |
|------|------|
| Create/update variables | `mcp__figma__use_figma` with Plugin API code that loops through tokens |
| Create/modify components | `mcp__figma__use_figma` with Plugin API code |
| Build full designs | `mcp__figma__use_figma` |
| Generate from description | `mcp__figma__generate_figma_design` |

### Reading from code
| Task | Approach |
|------|----------|
| Read token files | `Read` tool on discovered/configured paths |
| Read CSS variables | `Read` tool, parse `:root` and `.dark` blocks |
| Read Tailwind config | `Read` tool, extract `theme.extend` |
| Read component code | `Read` tool on component paths |
| Search for components | `Glob` pattern on component directories |

---

## Project Discovery

When invoked, run this discovery sequence before dispatching to a workflow:

1. **Check for existing workspace** (in order):
   - `{current-directory}/.figma-suite/config.json` — project-level workspace
   - `<HOME>/.claude/figma-suite/*/config.json` — global workspace where `projectPath` matches the current directory
   - If neither found → run setup
2. **Auto-discover tokens**: If no config or `tokenSource: "auto"`, scan for token files in the codebase
3. **Identify framework**: Check for `tailwind.config.*`, `global.css`, `theme.*` to understand the styling system
4. **Find components**: Scan configured or common paths (`src/components/ui`, `src/components`, `components/`)
5. **Load rules**: Read `design-rules.md` (designing in Figma) and `code-rules.md` (writing code from Figma) from the workspace folder (see [config-schema.md](reference/config-schema.md))
6. **Load component mapping**: Read every `component-mappings/{id}.json` file (skip `_meta.json`) and validate against [mapping-schema.md](reference/mapping-schema.md) — these per-component files are the agent's code↔Figma source of truth
7. **Report findings**: Tell the user what was discovered before proceeding

---

## Component Creation Rules

Apply when creating or modifying Figma components — `build-library`, `design`, or ad-hoc. The rules below are the floor; the *why* and what-a-senior-rejects live in [design-judgment.md](reference/design-judgment.md) — read it before building. Plugin API details: [plugin-api-patterns.md](reference/plugin-api-patterns.md), [build-library.md](workflows/build-library.md), [component-contracts.md](reference/component-contracts.md).

### No silent skipping

Every rule below MUST be followed for every qualifying element. If a rule doesn't apply to an element, report it as an explicit exception with a reason. A silently skipped binding or property is a bug — it looks complete but is broken for consumers.

### Every text layer = TEXT property + boolean toggle

Every user-facing text layer MUST have:
1. A **TEXT property** (edit without drilling into layers)
2. A **BOOLEAN property** to show/hide (e.g., `Show Description`)

**Skip:** internal layout helpers, decorative characters, separators — report as exception. → [design-judgment.md §2](reference/design-judgment.md#2-component-anatomy)

### Every content slot = SLOT (or INSTANCE_SWAP fallback) + boolean toggle

Every nested instance / content region MUST have:
1. A **SLOT property** (native — `createSlot()` / `addComponentProperty(name, "SLOT", ...)`) for freeform content, **or** an **INSTANCE_SWAP property** for swapping a specific component (icon, avatar; also the fallback on older runtimes)
2. A **BOOLEAN property** to show/hide (e.g., `Show CTA`)

Never use raw frames as content slots. **Skip:** structural instances integral to layout (e.g., an internal spacer) — report as exception. → [design-judgment.md §2](reference/design-judgment.md#2-component-anatomy)

### Every visual property = variable binding (pick the *semantically correct* token)

Every fill, stroke, radius, padding (all 4 sides individually), gap, and font property MUST be bound to a variable. Walk every node — don't use "looks correct" as a proxy for "is bound." **Bind the token whose *role* matches, not just the one whose *pixel value* matches** (inline gap → `gap-inline`, not any 8px `spacing-4`). Consume the semantic tier; primitives are reference-only.

**Skip:** one-off decorative values with no matching variable, gradient/image fills — use raw value, report as exception. → [design-judgment.md §1](reference/design-judgment.md#1-token-judgment)

### No text glyphs as icons

Before creating any glyph/icon as text **or** ad-hoc vector, search the file for an existing icon component and **instance it**. If none exists, create a proper vector icon component first. Text characters (`✕`/`✓`/`→`) are never acceptable substitutes for a DS icon. → [design-judgment.md §5](reference/design-judgment.md#5-iconography)

### Expose nested properties

Bubble up the most-used child properties to the parent. If Dialog nests a Button, expose `CTA Label` on the Dialog so consumers don't drill into the Button instance.

### Hug contents by default; sizing is a per-layer contract

Parent components MUST use **Hug Contents** (adapt when children resize, hide, swap). Use Fixed only when a design token defines the dimension (e.g., button height). Set each child's `FILL` vs `HUG` deliberately — containers that stretch use `FILL`, content that defines its own size uses `HUG`. → [design-judgment.md §2](reference/design-judgment.md#2-component-anatomy)

### Variant axes: only for meaningful difference

Variant count = product of all axis value-counts; each 2-value axis doubles the set. Promote to a variant property only what changes anatomy/visual treatment; everything else → boolean / text / instance-swap (these don't multiply). A with/without-icon toggle is a boolean, not a variant. Build **one** canonical variant 100% complete and verified, **then** clone it and rebind only what differs. → [design-judgment.md §3](reference/design-judgment.md#3-variant-set-design)

### Text Styles over individual bindings

Every text layer MUST have a Text Style applied via `setTextStyleIdAsync()` — it binds family/size/weight/line-height as one unit. **`TextStyle.setBoundVariable()` does NOT work in headless `use_figma`** — create Text Styles with raw values during token sync; bind variables on styles interactively in the Figma UI after the build.

**Skip:** no matching text style → set raw font properties, report as exception. → [design-judgment.md §4](reference/design-judgment.md#4-visual-hierarchy--composition)

### Mandatory verification — report a verification table

After creating/modifying any component, you MUST run the verification script ([component-contracts.md](reference/component-contracts.md#verification-script)) — it catches unbound properties, missing component properties, unapplied text styles. Fix all violations before proceeding.

**Don't just screenshot or claim "done" — output a verification table** (one row per rule, actual value) so the result is evidence:

| Rule | Status | Actual |
|------|--------|--------|
| Fills variable-bound | PASS | `Semantic/surface` |
| Padding (4 sides) bound | PASS | `Spacing/spacing-3` ×4 |
| Text Style applied | FAIL | raw Inter 16 — no style |
| … | … | … |

Report all exceptions alongside the table.

### Build in dependency order

Tier 1 (primitives) → Tier 2 (interactive) → Tier 3 (containers) → Tier 4 (overlays). Never build a component before its children exist.

### File flexibility

Works in any setup: single file, separate library file(s), no library yet, or adding to an existing one. Config supports multiple libraries and design files — see [config-schema.md](reference/config-schema.md).

### Component mapping

Setup generates `component-mappings/` (in workspace) — one **Zod-validated** `{id}.json` per component, tracking the relationship *and* property-/value-level mapping. See [mapping-schema.md](reference/mapping-schema.md) for schema, examples, validation, the filename==id rule, and Code Connect bridge.

Per-entry **status**:

- **matched** — direct counterpart, keep in sync
- **code-only** — no Figma representation (wrappers, logic-only)
- **figma-only** — no code equivalent (illustrations, decorative)
- **split** — one code component → multiple Figma components
- **merged** — multiple code components → one Figma component
- **diverged** — both exist but intentionally differ (document why)

Each entry's `propertyMap` links code props ↔ Figma properties (names may differ, e.g. code `style` ↔ Figma `Type`) with `figmaValue → codeValue` value maps — this drives translation in both directions.

Files are user-editable and Zod-validated (by inspection, or `node skills/figma-suite/schema/validate.mjs <workspace>/component-mappings/`). All workflows respect them: sync updates only changed files each loop, build-library skips code-only, audit ignores documented `diverged`, design uses the correct Figma component/value. Re-running setup adds only new `{id}.json` files, never clobbering existing ones.

---

### Naming conventions

During setup, the user picks a naming preset that applies across all workflows:

- **`figma-standard`** (default) — PascalCase, Title Case properties, `Has/Show/Is` booleans
- **`code-first`** — camelCase properties matching code props
- **`cti`** — Category-Type-Item token structure
- **`three-tier`** — Primitive → Semantic → Component token tiers
- **`custom`** — user-defined rules per aspect

The preset controls component names, property names, layer names, token separators, and boolean prefixes. See [naming-conventions.md](reference/naming-conventions.md) for full details.

---

## Reference Files

For detailed guidance on specific topics. **Only load these when actively needed — do not read all at once.**

- [Design judgment](reference/design-judgment.md) — **the craft layer**: how a senior chooses tokens, builds component anatomy, designs variant sets, composes hierarchy, handles iconography, and the master red-flag list. Read before `build-library` or `design`.
- [Config schema](reference/config-schema.md) — project config structure, multi-file model, design rules + code rules file formats
- [Component mapping schema](reference/mapping-schema.md) — per-component `component-mappings/{id}.json` Zod schema, examples, validation, Code Connect bridge
- [Token format mapping](reference/token-map.md) — how different code token formats map to Figma variables
- [Component contracts](reference/component-contracts.md) — component translation rules, sizing, slots
- [Plugin API patterns](reference/plugin-api-patterns.md) — correct Figma Plugin API usage: sizing, text styles, instance swap, composition, known constraints
- [Figma file structure](reference/figma-file-structure.md) — expected page/frame organization in the Figma file
- [Naming conventions](reference/naming-conventions.md) — presets for component, property, token, and layer naming
