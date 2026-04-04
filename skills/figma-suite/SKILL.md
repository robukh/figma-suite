---
name: figma-suite
description: >
  Bidirectional design system sync between code tokens and Figma variables,
  component library generation, screen design composition, and design audit.
  Use when syncing design tokens to/from Figma, building Figma component libraries,
  designing new screens in Figma, or auditing Figma files for design system compliance.
argument-hint: "[sync|build-library|design|audit|update-guide] [options]"
allowed-tools: Read, Write, Edit, Glob, Grep, WebSearch, mcp__figma__get_design_context, mcp__figma__get_screenshot, mcp__figma__get_metadata, mcp__figma__search_design_system, mcp__figma__use_figma, mcp__figma__get_variable_defs, mcp__figma__generate_figma_design, mcp__figma__get_figjam, mcp__figma__whoami, mcp__figma__get_code_connect_map, mcp__figma__get_code_connect_suggestions, mcp__figma__send_code_connect_mappings, mcp__figma__add_code_connect_map, mcp__figma__create_design_system_rules
compatibility: >
  Requires the official Figma MCP server (https://mcp.figma.com/mcp), a first-party
  remote endpoint operated by Figma, Inc. The mcp__figma__use_figma tool sends Figma
  Plugin API code to this server for execution within the user's authenticated Figma
  session. All operations require user-initiated OAuth authentication and edit access
  to the target Figma files. No data is sent to any third-party or skill-author-controlled
  endpoint.
metadata:
  author: robukh
  version: "1.2.0"
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

If the Figma MCP server is connected but returns errors:
- **Auth expired:** Ask the user to re-authenticate via the MCP server's OAuth flow
- **File not found / no access:** Verify the user has edit access to the Figma file
- **Rate limits:** Wait briefly and retry; batch operations to reduce call count
- **Plugin API errors:** Check the error message from `use_figma` — common causes are stale nodeIds or missing fonts

---

## Configuration

Run `/figma-suite setup` to generate config and project mappings.

### Workspace location

The skill supports three usage scenarios. During setup, it detects which applies and asks the user where to save:

**Scenario 1: Standalone (no codebase)**
The user launches Claude from their home folder or any non-project directory. Generated files go to `<HOME>/.claude/figma-suite/{project-name}/`. This is the only option — there's no project directory to save into.

**Scenario 2: Inside a project — user chooses location**
The user launches Claude from a project directory. Setup asks:
```
Where should I save the figma-suite workspace?
1. Project-level (default) — .figma-suite/ in this project directory (shared with teammates via git)
2. Global — <HOME>/.claude/figma-suite/{project-name}/ (personal, not committed)

Reply with a number:
```

- **Project-level** (`{project-root}/.figma-suite/`): config and generated files live in the project. Teammates who install the skill see the same config. Add `.figma-suite/` to `.gitignore` if you don't want it committed, or commit it to share.
- **Global** (`<HOME>/.claude/figma-suite/{project-name}/`): config is personal to this machine. Multiple users can have different configs for the same project.

**Scenario 3: Skill installed at project level only**
The skill lives in `.claude/skills/figma-suite/` inside the project. Works identically to Scenario 2 — setup asks the same location question.

`<HOME>` — the user's home directory (`~` on macOS/Linux, `%USERPROFILE%` on Windows). Always resolve to the absolute path at runtime.

### Auto-discovery order

When invoked, the skill searches for an existing workspace in this order:

1. `{project-root}/.figma-suite/config.json` — project-level workspace
2. `<HOME>/.claude/figma-suite/*/config.json` — global workspace matching `projectPath`
3. If neither found → run setup

### Auto-discovery order for tokens (codebase mode)

1. `design-tokens/*.tokens.json` — W3C Design Token Format (DTF/DTCG)
2. `tokens/**/*.json` — Style Dictionary format
3. `tailwind.config.js` / `tailwind.config.ts` — Tailwind theme tokens
4. `src/global.css` or `src/styles/globals.css` — CSS custom properties
5. `theme.ts` / `theme.js` — JS theme objects

When auto-discovering, read each found file and classify tokens into: **colors**, **typography**, **spacing**, **radii**, **shadows**, **other**.

The skill auto-detects whether you're in a codebase (scans tokens + components) or standalone (scans Figma file only).

A project can reference **multiple library files** (published DS sources) and **multiple design files** (where screens are composed). See [config-schema.md](reference/config-schema.md) for the full config structure, field reference, and design rules file format.

---

## Workflow Router

Dispatch based on `$ARGUMENTS`:

| Argument | Workflow | Description |
|----------|----------|-------------|
| `setup` | [setup.md](workflows/setup.md) | First-time init: scan project, generate token map and component contracts |
| `sync` | [sync-tokens.md](workflows/sync-tokens.md) | Diff code tokens vs Figma variables, show drift report, apply after approval |
| `sync --to-figma` | [sync-tokens.md](workflows/sync-tokens.md) | One-way push: code to Figma |
| `sync --to-code` | [sync-tokens.md](workflows/sync-tokens.md) | One-way pull: Figma to code tokens |
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
Every write operation must produce a **dry-run report** first. Never write to Figma or code without user approval.

### Screenshot validation
After every visual change in Figma, capture a screenshot with `mcp__figma__get_screenshot` and verify the result. Maximum 3 fix iterations per section.

### Never delete without confirmation
Tokens, variables, components, and pages are never deleted. Stale items are flagged in the report for the user to decide.

### Preserve existing work
When updating Figma files, back up or duplicate affected frames before overwriting. When updating code tokens, show the diff before writing.

### Work incrementally

**Do one thing per `use_figma` call.** The most common cause of bugs is trying to do too much in a single call. Break complex tasks into small steps:

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

**`use_figma` is atomic — failed scripts do NOT execute.** If a script errors, no changes are made to the file. The file remains in the exact state before the call. This means it's safe to retry after fixing the script — no cleanup needed.

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
5. **Load design rules**: Read the project's `design-rules.md` from the workspace folder (see [config-schema.md](reference/config-schema.md))
6. **Report findings**: Tell the user what was discovered before proceeding

---

## Component Creation Rules

These apply whenever creating or modifying Figma components — in `build-library`, `design`, or any ad-hoc component work. For Plugin API implementation details, see [build-library.md](workflows/build-library.md) and [component-contracts.md](reference/component-contracts.md).

### No silent skipping

**Every rule below MUST be followed for every qualifying element.** If you decide a rule doesn't apply to a specific element (e.g., a decorative separator doesn't need a TEXT property), you MUST report it as an explicit exception with a reason. Silently skipping a binding or property is a bug — it produces components that look complete but are broken for consumers.

### Every text layer = TEXT property + boolean toggle

Every user-facing text layer in a component MUST have:
1. A **TEXT property** so consumers can edit it without drilling into layers
2. A **BOOLEAN property** to show/hide it (e.g., `Show Description`)

**When to skip:** Internal layout helpers, decorative characters, or separators that consumers should never edit. Report each skip as an exception.

Example: Dialog has Title (text + `Show Title`) and Body (text + `Show Body`). This lets consumers create a title-only dialog by hiding the body.

### Every child component = INSTANCE_SWAP + boolean toggle

Every nested component instance MUST have:
1. An **INSTANCE_SWAP property** so consumers can swap variants/components
2. A **BOOLEAN property** to show/hide it (e.g., `Show CTA`, `Show Icon`)

**When to skip:** Structural instances that are integral to the component's layout and should never be swapped (e.g., an internal spacer component). Report as exception.

Never use raw frames as content slots — only INSTANCE_SWAP properties.

### Every visual property = variable binding

Every fill, stroke, radius, padding (all 4 sides individually), gap, and font property MUST be bound to a variable. Walk every node and bind each property — do not rely on "looks correct" as a proxy for "is bound."

**When to skip:** One-off decorative values with no matching variable in the scale, gradient fills (which don't support variable binding), or image fills. Use the raw value and report as exception.

### Expose nested properties

Bubble up the most-used child properties to the parent level. If Dialog nests a Button, expose `CTA Label` on the Dialog itself so consumers don't have to drill into the Button instance.

### Hug contents by default

Parent components MUST use **Hug Contents** so they adapt when children resize, get hidden, or get swapped. Only use Fixed height when a design token defines it (e.g., button heights).

### Text Styles over individual bindings

Every text layer MUST have a Text Style applied via `setTextStyleIdAsync()`. Text Styles bind all 4 properties (family, size, weight, line-height) as one unit. **`TextStyle.setBoundVariable()` does NOT work in headless `use_figma`** — create Text Styles with raw values during token sync; variable binding on styles must be done interactively in the Figma UI after the build.

**When to skip:** If no matching text style exists, set raw font properties and report as exception.

### Mandatory verification

After creating or modifying any component, you MUST run the programmatic verification script (see [component-contracts.md](reference/component-contracts.md#verification-script)). This catches unbound properties, missing component properties, and unapplied text styles. Fix all violations before proceeding. Report all exceptions to the user.

### Build in dependency order

Tier 1 (primitives) → Tier 2 (interactive) → Tier 3 (containers) → Tier 4 (overlays). Never build a component before its children exist.

### File flexibility

Works in any setup: single file, separate library file(s), no library yet, or adding to an existing library. The config supports multiple libraries and multiple design files — see [config-schema.md](reference/config-schema.md). The only difference is where components are created and whether publishing is needed after.

### Component mapping

Code and Figma components are not always 1:1. Setup generates a `component-mapping.generated.md` (relative within workspace) that tracks the relationship:

- **matched** — direct counterpart, keep in sync
- **code-only** — no Figma representation (wrappers, logic-only)
- **figma-only** — no code equivalent (illustrations, decorative)
- **split** — one code component → multiple Figma components
- **merged** — multiple code components → one Figma component
- **diverged** — both exist but intentionally differ (document why)

This file is user-editable. All workflows respect it: build-library skips code-only, audit ignores diverged with documented reason, design uses the correct Figma component regardless of code structure.

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

- [Config schema](reference/config-schema.md) — project config structure, multi-file model, design rules file format
- [Token format mapping](reference/token-map.md) — how different code token formats map to Figma variables
- [Component contracts](reference/component-contracts.md) — component translation rules, sizing, slots
- [Plugin API patterns](reference/plugin-api-patterns.md) — correct Figma Plugin API usage: sizing, text styles, instance swap, composition, known constraints
- [Figma file structure](reference/figma-file-structure.md) — expected page/frame organization in the Figma file
- [Naming conventions](reference/naming-conventions.md) — presets for component, property, token, and layer naming
