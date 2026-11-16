# Workflow: Setup

First-time initialization (and safe re-runs). Scans the codebase and/or the Figma files, then generates the workspace that every other workflow depends on: config, token map, component contracts, component mappings, a DESIGN.md draft, and code rules. Runs automatically when a workflow starts without a workspace.

**Contents:** [Principles](#principles) · [Step 0: Files](#step-0-collect-figma-files) · [Step 1: Code scan](#step-1-scan-the-code-codebase-mode) · [Step 2: Figma scan](#step-2-scan-figma-read-only) · [Step 3: Generate](#step-3-generate-workspace-files) · [Step 4: Mapping](#step-4-seed-component-mappings) · [Step 5: DESIGN.md](#step-5-draft-designmd) · [Step 6: Finish](#step-6-finish) · [Re-running](#re-running-setup)

Load first: [official-skills.md](../reference/official-skills.md). Schemas: [config-schema.md](../reference/config-schema.md), [mapping-schema.md](../reference/mapping-schema.md), [design-md-template.md](../reference/design-md-template.md).

## Principles

- **Infer first, ask last.** The user should only answer what cannot be derived. Ask for the Figma file URLs, then show one summary of inferred defaults ("Here is what I detected; change anything wrong") instead of a quiz.
- **Never overwrite hand work.** Re-runs add new files and propose diffs; they do not rewrite existing `config.json` values, `component-mappings/{id}.json`, `code-rules.md` or the authored parts of DESIGN.md.
- **Read-only against Figma.** Setup scans; it does not create anything in Figma.

## Mode and workspace

- **Codebase mode** if the directory is a project (`package.json`, `pyproject.toml`, `Cargo.toml`, `.git`, or source files). Default workspace: `{project-root}/.figma-suite/`.
- **Standalone mode** if there is no codebase (ask once: navigate to a project, or continue standalone). Workspace: `<HOME>/.claude/figma-suite/{project-name}/`. `--to-code` is unavailable.
- Offer the global workspace as an alternative only when the user wants a personal, uncommitted setup. Project name: kebab-case, derived from the repo or the Figma file name; confirm it in the summary.

## Inferred defaults

| Setting | How it is inferred |
|---|---|
| `platform` | `react-native` / `expo` → `mobile-cross`; `next`, `nuxt`, `svelte`, `vite` → `web-desktop`; Swift/Kotlin → `mobile-ios` / `mobile-android`; else ask |
| `namingPreset` | match existing Figma components or code props; default `figma-standard` |
| `tokenSource` | first hit in the discovery order of [SKILL.md](../SKILL.md#workspace-and-discovery) |
| `fileLayout`, `componentLayout`, `darkModeStrategy` | existing Figma pages / `.dark` selectors; else `page-per-component`, `full`, `variable-modes` |

## Step 0: Collect Figma files

Ask for the library URL, then (optionally) more libraries (icons, primitives), then a design file URL and more design files. Extract each `fileKey` and call `get_metadata` for its name. If one file serves both roles, add it to both arrays. Users can add files later by saying "add a library" or "add a design file".

## Step 1: Scan the code (codebase mode)

1. **Tokens.** Find token files in discovery order; for each token record name, type, value, category (`colors | typography | spacing | radii | shadows | other`), and the mode it belongs to (`colors-light` → Light, `.dark` → Dark). Record the file paths into `tokenPaths`/`cssVarsPath`/`tailwindConfigPath` so freshness can be tracked.
2. **Components.** In `componentPaths` (or `src/components/ui`, `src/components`, `components/`) extract per component: name, props interface (variant unions, booleans, strings, ReactNode slots), tokens used, child components imported. Build the dependency graph and assign build tiers (primitives → interactive → containers → overlays).
3. **Conventions** for `code-rules.md`: styling system, token reference style, file naming and export style.

## Step 2: Scan Figma (read-only)

Use `use_figma` (local content; `get_variable_defs` and `search_design_system` only see published libraries). Follow `figma-use`: return JSON, keep returns small, one page switch per script.

1. Pages: `figma.root.children.map(p => ({ id: p.id, name: p.name }))`.
2. Variables: collections with mode names and per-variable `name`/`resolvedType` only (no `valuesByMode` dumps; fetch values later for the ids that matter). One inventory per call.
3. Text styles and effect styles: names and ids.
4. Components: **one read-only call per page, emitted in parallel in a single message**, each doing `setCurrentPageAsync(page)` once and `findAllWithCriteria({ types: ["COMPONENT_SET", "COMPONENT"] })`, returning id, name, type, parent type. Standalone components are those whose parent is not a `COMPONENT_SET`.
5. Check `get_libraries` for libraries added to each design file.

Merge across files, de-duplicate by name, flag conflicts, prefix with the file name where ambiguous.

## Step 3: Generate workspace files

- `config.json` per [config-schema.md](../reference/config-schema.md); show it with the inferred defaults before writing.
- `token-map.generated.md` — every token mapped to its Figma variable name, collection, mode, type and scopes ([token-map.md](../reference/token-map.md)).
- `component-contracts.generated.md` — every component with props, variants, tokens, dependencies, build tier ([component-contracts.md](../reference/component-contracts.md)).

## Step 4: Seed component mappings

Write one `component-mappings/{id}.json` per component ([mapping-schema.md](../reference/mapping-schema.md)):

1. **Match** code components (step 1) to Figma components (step 2) by exact or normalized name: found both → `matched`; code only → `code-only`; Figma only → `figma-only`.
2. **Build `propertyMap`** by pairing props with properties: union ↔ VARIANT → `enum` with `values` for every Figma value; boolean ↔ BOOLEAN → `boolean`; string ↔ TEXT → `text`; node/icon ↔ INSTANCE_SWAP → `instanceSwap`; children ↔ SLOT → `slot`. Base names only.
3. Set `published` from the scan (it gates the Code Connect bridge).
4. Write `_meta.json` (`version: 1`, current `generatedAt`).
5. Run the contract check; fix errors before continuing.

Re-runs write only **new** `{id}.json` files; an existing file is never touched. A stray legacy single `component-mapping.json` is ignored and reported, never read alongside the directory.

## Step 5: Draft DESIGN.md

Derive it from what steps 1–4 produced so it cannot start out of sync, then ask only what cannot be derived. Full procedure and the derive-vs-ask table: [design-md.md](design-md.md) and [design-md-template.md](../reference/design-md-template.md).

- If a `design-rules.md` exists from an earlier version, fold its content into the matching DESIGN.md sections (layout, typography, iconography, Do not), tell the user, and remove the old file after confirmation.
- If DESIGN.md already exists, do not replace it: refresh only the generated blocks and propose changes to authored sections as a diff.

## Step 6: Finish

1. Generate `code-rules.md` ([config-schema.md](../reference/config-schema.md#code-rulesmd)); present for review.
2. Run the contract check with `--write-state` so freshness tracking starts clean.
3. Summarize: mode, project, libraries, design files, token and component counts per tier, generated files, mapping status counts, DESIGN.md items marked `inferred`, and next steps (review DESIGN.md Project decisions; `sync`; `build-library`; `design`).

## Re-running setup

Re-scan, show what changed since the last setup, and update generated files after approval. Offer to add libraries or design files. Add newly discovered components as new mapping files. Preserve manual edits to config, rules files, mapping files and authored DESIGN.md sections. Each global project has its own workspace folder and they never interfere; list them with `<HOME>/.claude/figma-suite/*/config.json`.
