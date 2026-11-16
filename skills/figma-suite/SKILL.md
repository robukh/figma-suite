---
name: figma-suite
description: >
  Keeps a codebase and Figma in sync and designs UI like a senior product designer.
  Use to sync design tokens and components between code and Figma, map code props to
  Figma properties (incl. Code Connect), build a component library in Figma, design or
  review screens without generic "AI slop", write the project DESIGN.md, or audit a
  Figma file against the design system. Triggers: "sync tokens", "sync components",
  "map component props", "design this screen in Figma", "audit this Figma file",
  "create DESIGN.md", "set up figma-suite".
when_to_use: >
  Figma work that involves the project's own code, tokens, component mapping, or
  design taste. For raw Plugin API questions or Code Connect syntax alone, the
  official figma-use / figma-code-connect skills are enough.
argument-hint: "[setup|sync|build-library|design|design-md|audit|update-guide] [options]"
allowed-tools: Read, Write, Edit, Glob, Grep, Agent, Bash(node *), mcp__figma__create_session, mcp__figma__get_libraries, mcp__figma__get_design_context, mcp__figma__get_screenshot, mcp__figma__get_metadata, mcp__figma__search_design_system, mcp__figma__use_figma, mcp__figma__get_variable_defs, mcp__figma__get_code_connect_map, mcp__figma__get_code_connect_suggestions, mcp__figma__get_context_for_code_connect
compatibility: >
  Requires the official Figma MCP server (https://mcp.figma.com/mcp), a first-party
  remote endpoint operated by Figma, Inc. use_figma sends Figma Plugin API code to that
  server for execution in the user's authenticated Figma session; all access needs
  user-initiated OAuth and edit access to the target files. Nothing is sent to any
  other endpoint. Node >= 18 is needed only for the bundled scripts.
metadata:
  author: robukh
  external-endpoint: https://mcp.figma.com/mcp
  external-endpoint-provider: Figma, Inc.
  external-endpoint-auth: OAuth (user-initiated)
  external-endpoint-docs: https://developers.figma.com/docs/figma-mcp-server/remote-server-installation/
---

# figma-suite

Connects a codebase design system to Figma and keeps the two honest. It adds four things on top of Figma's official skills: a **code ↔ Figma contract** (tokens, component mapping, DESIGN.md that stay in sync), **sync** across it, a **senior-designer screen workflow** with an anti-slop gate, and **audit**.

Project snapshot (blank if shell commands are disabled; then run `node "${CLAUDE_SKILL_DIR}/scripts/discover.mjs"` yourself):

!`node "${CLAUDE_SKILL_DIR}/scripts/discover.mjs" || true`

> Load only the workflow and references you are executing. They are large.

## Load Figma's skills first

figma-suite does not restate the Plugin API. Before any `use_figma` call, load `figma-use`; before changing anything visible also `figma-generate-design`; for components/variables also `figma-generate-library`. Call `create_session` before file tools. Details, discovery order and where we override: [official-skills.md](reference/official-skills.md). If the Figma MCP server is missing: `claude plugin install figma@claude-plugins-official`, or add `https://mcp.figma.com/mcp` and authenticate via OAuth.

## Workflow router

| `$ARGUMENTS` | Workflow | Must read |
|---|---|---|
| `setup` (also the upgrade from 1.x) | [setup.md](workflows/setup.md) | config-schema, mapping-schema, design-md-template |
| `sync` (`--tokens`, `--components`, `--to-figma`, `--to-code`) | [sync.md](workflows/sync.md) | mapping-schema, token-map |
| `build-library` | [build-library.md](workflows/build-library.md) | component-contracts, component-craft, plugin-api-deltas |
| `design <description>` | [design-screen.md](workflows/design-screen.md) | craft-floor first; anti-slop, ux-checklist, critique-rubric on demand |
| `design-md` | [design-md.md](workflows/design-md.md) | design-md-template, craft-floor |
| `audit` | [audit.md](workflows/audit.md) | component-craft §6, anti-slop, critique-rubric |
| `update-guide` | [update-guidelines.md](workflows/update-guidelines.md) | design-md-template |
| *(none)* | Follow the snapshot's `NEXT:` line (`setup`, `sync` or `none`), then show this menu. | |

## The contract: one source of truth per fact

| Fact | Owner | Appears elsewhere as |
|---|---|---|
| Token values (colors, type, spacing, radii) | code token source (or Figma variables in standalone mode) | DESIGN.md front matter (generated), Figma variables (synced) |
| Component structure (props ↔ Figma properties, value maps, status) | `component-mappings/{id}.json` | DESIGN.md `components:` holds only the id and usage policy |
| Usage policy, taste, voice, project decisions | `DESIGN.md` (authored) | never overwritten by sync |

`state.json` records content hashes at each successful sync, so any workflow can tell whether the contract is fresh. If the snapshot says **STALE**, offer `sync` before `design`, `audit` or `build-library`, and never design against a stale contract silently. Schemas: [config-schema.md](reference/config-schema.md), [mapping-schema.md](reference/mapping-schema.md), [design-md-template.md](reference/design-md-template.md).

### Commands (defined once; workflows say "run the contract check")

- Contract check: `node "${CLAUDE_SKILL_DIR}/scripts/check-contract.mjs" [--project DIR] [--design-md FILE] [--strict] [--json]` — validates mappings and DESIGN.md and cross-checks them. Exit 1 = errors. `--design-md FILE` lints one DESIGN.md even when no workspace exists (mapping checks then only warn).
- Record sync state (only after a clean sync): add `--write-state`.
- Setup is done only when `check-contract.mjs --setup --write-state` exits 0: it also requires the workspace files, `DESIGN.md` and `state.json`, and no leftover `design-rules.md`.
- Verify a component: paste `scripts/verify-component.js` into `use_figma` ([component-contracts.md](reference/component-contracts.md#verification)).
- Scan a screen for slop: paste `scripts/slop-scan.min.js` into `use_figma` ([design-screen.md](workflows/design-screen.md)).

## Workspace and discovery

Workspace = `{project-root}/.figma-suite/` (default, shareable) or `<HOME>/.claude/figma-suite/{project-name}/` (personal; always for standalone). `discover.mjs` finds it, `config.json` describes it. Token sources are auto-discovered in this order: `design-tokens/*.tokens.json` (W3C DTCG) → `tokens/**/*.json` (Style Dictionary) → `tailwind.config.*` → CSS custom properties (`src/global.css`, `src/styles/globals.css`) → `theme.ts|js`. A project may reference several libraries and design files.

## Safety rules (apply to every workflow)

- **Dry-run, then approval** for writes to code or Figma (`sync`, `build-library`, `design`): show a report first. Reason: our changes cross two systems and are hard to unwind. Reads, `audit` and `setup` need no approval; `setup` writes only workspace files and `DESIGN.md`.
- **Never delete** tokens, variables, components or pages without explicit confirmation; flag stale items instead.
- **Preserve existing work.** Show the diff before editing code tokens; duplicate or snapshot a frame before overwriting it.
- **Sequential writes, parallel reads.** `use_figma` writes run one at a time; independent per-page reads may fan out in one message.
- **Retry contract.** Obey the error's `safeToRetryWithoutCanvasRead`: true → fix and retry; false → read the canvas first. Never repeat the same failing script.
- **Evidence over claims.** Return created/mutated node IDs from every write; report verification tables and screenshots, not "done".
- **Proactive by default.** Do the work, take the recommended default, mark it `inferred`, and ask once at the end. Do not stop to ask before writing files that do not exist yet.
- **Ask well.** Use `AskUserQuestion` (recommended option first, at most 3 questions per round). Infer from code and Figma before asking; the user should only answer what cannot be derived. When no user can answer (an autonomous or delegated run), choose the recommended default, state the assumption in the report, and continue.

## Component rules (the floor)

The reasoning and the reject list live in [component-craft.md](reference/component-craft.md); mechanics in [plugin-api-deltas.md](reference/plugin-api-deltas.md) and [component-contracts.md](reference/component-contracts.md). In short, every component has: a TEXT property plus a Show toggle per text layer; a native SLOT or INSTANCE_SWAP per content region (decided per region); variables bound on every fill, stroke, radius, padding side, gap (the role-correct semantic token, never a primitive); Text Styles with variables bound on the style; auto-layout on every container of related children; hug by default; variants only for real anatomy changes; no text glyphs as icons; and a verification table from `verify-component.js`. Skipped items are reported as exceptions with a reason, never silently.

## Design quality

Screens are designed from a brief and a content inventory, checked by `slop-scan.js`, subtracted, and reviewed by a fresh-context critic. Read [craft-floor.md](reference/craft-floor.md) before drawing and again at the start of each major section. Project taste overrides generic defaults, in this order: `DESIGN.md` project decisions → [anti-slop.md](reference/anti-slop.md) defaults → general judgment. Bans can be waived only with a written reason.

## Naming

The preset chosen in setup (`figma-standard` default, `code-first`, `cti`, `three-tier`, `custom`) governs component, property, layer and token names: [naming-conventions.md](reference/naming-conventions.md).
