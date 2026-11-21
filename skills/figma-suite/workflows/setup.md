# Workflow: Setup

Builds or upgrades the workspace every other workflow depends on: config, token map, component contracts, component mappings, `code-rules.md`, `DESIGN.md` and `state.json`. It also upgrades a 1.x workspace. Runs when the snapshot says `NEXT: setup`.

**Setup is proactive.** Do steps 1 to 8 without asking. Where a decision is needed, take the recommended default and mark it `inferred`. Ask once, at step 8. Setup writes only workspace files, `DESIGN.md` and (for `design-rules.md`) a `.bak` rename; it never writes to Figma or to source code, so it needs no dry-run approval.

Load [official-skills.md](../reference/official-skills.md) only for step 4. Schemas: [config-schema.md](../reference/config-schema.md), [mapping-schema.md](../reference/mapping-schema.md), [design-md-template.md](../reference/design-md-template.md).

**Done when** `node "<skill-dir>/scripts/check-contract.mjs" --setup --write-state` exits 0. Never report setup as finished without that result. Resolve `<skill-dir>` to the base directory shown when the skill was loaded; in Claude Code, `${CLAUDE_SKILL_DIR}` may be substituted.

## Steps

1. **Detect.** Read the `NEXT:` line of the snapshot (`discover.mjs`). `setup (upgrade; incomplete: ...)` means a workspace exists but items are missing: continue with the steps below on top of it. Mode is `codebase` when the directory has `package.json`, `pyproject.toml`, `Cargo.toml`, `.git` or sources (workspace `{project}/.figma-suite/`), else `standalone` (workspace `~/.figma-suite/{project}/`, no `--to-code`).
   *Verify:* you can name the mode and the workspace path.
2. **Read what exists.** Load `config.json` and use its `libraries` and `designFiles`. Ask for Figma URLs only when both arrays are empty; then extract `fileKey` from each URL and call `get_metadata` for the name.
   *Verify:* at least one library or design file is known.
3. **Scan the code** (codebase mode). Tokens in the discovery order of [SKILL.md](../SKILL.md#workspace-and-discovery) (name, type, value, category, mode); record the token files in `tokenPaths` / `cssVarsPath` / `tailwindConfigPath`. Components in `componentPaths` (or `src/components/ui`, `src/components`, `components/`): name, props (variant unions, booleans, strings, ReactNode slots), tokens used, imports; assign build tiers. Conventions for `code-rules.md`: styling system, token reference style, file naming and exports.
4. **Scan Figma** (read-only, skip with a note in the summary if the Figma MCP or the official skills cannot be loaded; steps 5 to 8 still run). Follow `figma-use`: `use_figma` for local content, small returns, one page switch per script. Pages; variable collections with mode names (names and types only); text and effect styles; components with **one read-only call per page, sent in parallel in one message** (`findAllWithCriteria` for `COMPONENT_SET` and `COMPONENT`); `get_libraries` per design file. Merge across files and flag name conflicts.
5. **Write the workspace files.** Fill gaps in `config.json` with the inferred defaults below and set `generatedAt`; never change a value that is already set. Write `token-map.generated.md` and `component-contracts.generated.md` ([token-map.md](../reference/token-map.md), [component-contracts.md](../reference/component-contracts.md)); write `code-rules.md` if missing. Seed `component-mappings/`: match code and Figma components by exact or normalized name (`matched`, `code-only`, `figma-only`), build `propertyMap` (union ↔ VARIANT `enum`, boolean ↔ BOOLEAN, string ↔ TEXT `text`, node ↔ INSTANCE_SWAP `instanceSwap`, children ↔ SLOT `slot`), set `published`, write `_meta.json`. An existing `{id}.json` is never rewritten; only new ids get files.
   *Verify:* `check-contract.mjs` reports no mapping errors.
6. **Create `DESIGN.md`** at `designMdPath` (default: project root) by following [design-md.md](design-md.md), Create. Fold in `design-rules.md` if it exists (layout, typography, iconography, "do not"), then rename it to `design-rules.md.bak`. If `DESIGN.md` already exists, refresh only the generated blocks and list proposed edits to authored sections in the summary.
   *Verify:* the file exists and parses.
7. **Check and record state.** Run the "Done when" command. Fix every error it prints and run it again.
8. **Summarize and ask once.** About ten lines: mode, workspace path, libraries and design files, token and component counts, mapping status counts, files written, items marked `inferred`, anything skipped and why, and what changed from 1.x. Then ask one batched question with the host's question UI when available (recommended option first): confirm the `mode`, the voice (casing, banned words) and the icon policy, or give corrections. Write the answers into `DESIGN.md` Project decisions as *confirmed*. Next steps to offer: `sync`, `build-library`, `design`.

## Inferred defaults

| Setting | How it is inferred |
|---|---|
| `platform` | `react-native` / `expo` → `mobile-cross`; `next`, `nuxt`, `svelte`, `vite` → `web-desktop`; Swift / Kotlin → `mobile-ios` / `mobile-android`; else ask in step 8 |
| `namingPreset` | match existing Figma components or code props; default `figma-standard` |
| `tokenSource` | first hit in the discovery order |
| `fileLayout`, `componentLayout`, `darkModeStrategy` | existing Figma pages and `.dark` selectors; else `page-per-component`, `full`, `variable-modes` |
| `DESIGN.md` `mode` | `consumer` for mobile and lifestyle apps, `operate` for tools, `persuade` for marketing sites |

## Rules

- **Hand work is never overwritten:** existing config values, mapping files, `code-rules.md` and authored `DESIGN.md` sections stay as they are. Missing files are not hand work: create them without asking.
- **Re-running** is the same sequence: re-scan, update generated files, add new mapping files, report what changed.
- Each global project has its own workspace folder (`~/.figma-suite/*/config.json`; existing `~/.claude/figma-suite/*/config.json` workspaces are still found); they never interfere.
