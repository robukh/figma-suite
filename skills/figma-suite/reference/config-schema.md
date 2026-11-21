# Config Schema

The project config and the workspace folder around it. Every workflow resolves the workspace the same way (`scripts/discover.mjs` does it for you).

**Contents:** [Workspace](#workspace) · [config.json](#configjson) · [Field notes](#field-notes) · [Presets](#presets) · [code-rules.md](#code-rulesmd) · [state.json](#statejson)

## Workspace

| Location | Path | Default for |
|---|---|---|
| Project-level | `{project-root}/.figma-suite/` | codebase projects (shareable via git) |
| Global | `<HOME>/.figma-suite/{project-name}/` | standalone (no codebase); personal setups |

`<HOME>` is `~` on macOS/Linux and `%USERPROFILE%` on Windows. A global folder is named by the kebab-cased project name, not a Figma file key, because a project can span several Figma files. Discovery order: project-level first, then `~/.figma-suite/` matching `projectPath`, then the legacy `~/.claude/figma-suite/` location. Existing workspaces there need no migration; newly created global workspaces use the host-neutral path.

```
{workspace}/
├── config.json                       # this schema
├── code-rules.md                     # rules for coding from Figma (user-editable)
├── token-map.generated.md            # tokens -> Figma variables
├── component-contracts.generated.md  # components -> Figma component sets
├── component-mappings/               # one {id}.json per component + optional _meta.json
└── state.json                        # sync hashes (written by check-contract --write-state)

{project-root}/DESIGN.md              # the design contract's authored half (standalone: in the workspace)
```

## config.json

```jsonc
{
  "name": "",                          // human-readable project name
  "mode": "codebase",                  // "codebase" | "standalone"
  "projectPath": "",                   // absolute path to the codebase root (relative paths resolve from the folder holding .figma-suite/)
  "workspaceLocation": "project",      // "project" | "global"
  "generatedAt": "",                   // ISO 8601, last setup run

  "libraries":   [{ "fileKey": "", "name": "" }],   // published DS files (components + variables)
  "designFiles": [{ "fileKey": "", "name": "" }],   // files where screens are composed

  "namingPreset": "figma-standard",    // figma-standard | code-first | cti | three-tier | custom
  "platform": "web-desktop",           // see Presets
  "fileLayout": "page-per-component",  // page-per-component | single-page-components | flat | custom
  "componentLayout": "full",           // full | compact | variants-only
  "darkModeStrategy": "variable-modes",// variable-modes | duplicate-frames
  "frameWidth": 1440, "frameHeight": 900,

  "tokenSource": "auto",               // auto | dtf | style-dictionary | css | tailwind | js
  "tokenPaths": { "colors": [], "typography": [], "spacing": [], "radii": [], "shadows": [] },
  "cssVarsPath": "", "tailwindConfigPath": "",
  "componentPaths": [],                // e.g. ["src/components/ui"]

  "collections": { "primitives": "Primitives", "semantic": "Semantic", "typography": "Typography", "spacing": "Spacing" },
  "modes": { "light": "Light", "dark": "Dark" },

  "designMdPath": "DESIGN.md",         // relative to projectPath (standalone: to the workspace)
  "codeRulesPath": "code-rules.md"     // relative to the workspace
}
```

## Field notes

- **`libraries`** — published files that provide components and variables. Reads query them; `build-library` and `sync` write to the first one unless the user picks another. If library and screens live in one file, list it in both arrays.
- **`designFiles`** — where `design` and `audit` operate; ask which one when there are several.
- **`tokenPaths`, `cssVarsPath`, `tailwindConfigPath`** — the files whose content hashes feed freshness detection, so keep them accurate. A token file missing from this list will not trigger a stale warning.
- **`designMdPath`** — see [design-md-template.md](design-md-template.md). It replaces the old `designRulesPath`/`design-rules.md`; setup migrates an existing `design-rules.md` into DESIGN.md and then removes it.
- **`mode: "standalone"`** — no codebase: token and component data come from the Figma files, DESIGN.md lives in the workspace, and `--to-code` is unavailable.

## Presets

| `platform` | Frame | Notes |
|---|---|---|
| `mobile-ios` | 393×852 | iOS status bar, tab bar |
| `mobile-android` | 393×852 | Android status bar, bottom nav |
| `mobile-cross` | 393×852 | generic nav; suggested for React Native / Expo |
| `tablet` | 1024×1366 | side or top nav |
| `web-desktop` | 1440×900 | top nav; suggested for Next / Nuxt / Svelte |
| `web-responsive` | 375, 768, 1440 | one frame per breakpoint |
| `landing` | 1440 wide, auto height | hug vertically |
| `custom` | user-defined | |

`fileLayout` and `componentLayout` presets are described with the library layouts in [build-library.md](../workflows/build-library.md). `darkModeStrategy: variable-modes` (default) toggles one frame via variable modes; `duplicate-frames` places light and dark side by side. Naming presets: [naming-conventions.md](naming-conventions.md).

## code-rules.md

Rules for the coding agent when writing or maintaining code from Figma (the `--to-code` half of `sync`, and design-to-code handoffs). Generated at setup from the detected styling system, token format and component conventions; user-editable. It is separate from DESIGN.md because the audiences are opposite (designing in Figma vs coding from Figma). Expected sections:

- **Component mapping** — consult `component-mappings/{id}.json` before generating code from a Figma node; translate values through `propertyMap.values` (figmaValue → codeValue); never invent code for `figma-only`, never expect a node for `code-only`.
- **Naming & files** — where components go, file naming, export style.
- **Props & types** — VARIANT → union type; BOOLEAN → boolean; TEXT → string; SLOT / INSTANCE_SWAP → children / node.
- **Tokens in code** — canonical format, reference tokens (`var(--token)`), never hardcode values that exist as tokens.
- **Styling system** and **accessibility** — framework conventions; roles, labels, target sizes.
- **Do not** — project-specific anti-patterns.

If the file is missing, follow the codebase's conventions, reference tokens instead of values, and consult the mapping files.

## state.json

Written by `check-contract.mjs --write-state` after a clean sync: content hashes of every token source file, of each generated DESIGN.md block, and of each mapping file, plus `syncedAt`. A later hash mismatch means that piece changed outside a sync. It is machine-owned; never edit it by hand. Commit it with the workspace so teammates see the same freshness.
