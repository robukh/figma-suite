# Config Schema

Single source of truth for the project config file structure. All workflows read config from `<HOME>/.claude/figma-suite/{project-name}/config.json`.

- `<HOME>` — the user's home directory (`~` on macOS/Linux, `%USERPROFILE%` on Windows). Always resolve to the absolute path at runtime.

The workspace folder is named by the project name (kebab-cased), not by a Figma file key — because a project may span multiple Figma files.

---

## Full Schema

```jsonc
{
  // === Project identity ===
  "name": "",                              // Human-readable project name
  "mode": "standalone",                    // "standalone" | "codebase"
  "projectPath": "",                       // Absolute path to codebase root (codebase mode only)
  "workspaceLocation": "project",          // "project" (.figma-suite/ in project root) | "global" (<HOME>/.claude/figma-suite/{name}/)
  "generatedAt": "",                       // ISO 8601 timestamp of last setup/re-setup run

  // === Figma files ===
  // Libraries: published DS files that provide components and variables.
  // Array because a project may consume multiple libraries
  // (e.g., core primitives + product-specific, or icons + components).
  "libraries": [
    {
      "fileKey": "",                       // From Figma URL
      "name": ""                           // Human-readable, auto-populated from Figma metadata
    }
  ],
  // Design files: files where screens are composed using library components.
  // Array because a project typically has multiple design files
  // (e.g., "Main Screens", "Onboarding", "Marketing Pages").
  "designFiles": [
    {
      "fileKey": "",
      "name": ""
    }
  ],

  // === Presets (chosen during setup) ===
  "namingPreset": "figma-standard",        // "figma-standard" | "code-first" | "cti" | "three-tier" | "custom"
  "platform": "mobile-ios",               // "mobile-ios" | "mobile-android" | "mobile-cross" | "tablet" | "web-desktop" | "web-responsive" | "landing" | "custom"
  "fileLayout": "page-per-component",     // "page-per-component" | "single-page-components" | "flat" | "custom"
  "componentLayout": "full",              // "full" | "compact" | "variants-only"
  "darkModeStrategy": "variable-modes",   // "variable-modes" | "duplicate-frames"
  "frameWidth": 393,                      // Default frame width in px (from platform preset)
  "frameHeight": 852,                     // Default frame height in px (from platform preset)

  // === Token discovery (codebase mode only) ===
  "tokenSource": "auto",                  // "auto" | "dtf" | "style-dictionary" | "css" | "tailwind" | "js"
  "tokenPaths": {
    "colors": [],                          // e.g. ["design-tokens/colors-light.tokens.json"]
    "typography": [],
    "spacing": [],
    "radii": [],
    "shadows": []
  },
  "cssVarsPath": "",                       // CSS custom properties file
  "tailwindConfigPath": "",                // Tailwind config for extended theme

  // === Components (codebase mode only) ===
  "componentPaths": [],                    // e.g. ["src/components/ui"]

  // === Figma variable collections ===
  "collections": {
    "primitives": "Primitives",
    "semantic": "Semantic",
    "typography": "Typography",
    "spacing": "Spacing"
  },

  // === Mode names for multi-mode collections ===
  "modes": {
    "light": "Light",
    "dark": "Dark"
  },

  // === Design rules ===
  // Path to the project's design rules file, relative to workspace folder.
  // Auto-generated during setup, user-editable afterward.
  "designRulesPath": "design-rules.md"
}
```

---

## Field Reference

### `libraries` (array)

Each entry is a Figma file that has been **published as a library**. These files contain the components and variables that design files consume.

- Most projects have 1 library. Some have 2+ (e.g., an icon library separate from a component library, or a shared primitives library + a product-specific library).
- The user adds libraries during setup. They can add more later by saying "add another library."
- Workflows that read the design system (`search_design_system`, `get_variable_defs`) query libraries.
- Workflows that write components or variables (`build-library`, `sync`) write to the **first library** by default, or ask the user which library to target if multiple exist.

### `designFiles` (array)

Each entry is a Figma file where screens and flows are composed using library components.

- A project may have many design files (one per feature area, platform, or sprint).
- The user adds design files during setup. They can add more later.
- Workflows that compose screens (`design`) or audit screens (`audit`) operate on a specific design file — ask the user which one, or use the most recently added if only one exists.

### `designRulesPath` (string)

Points to a markdown file in the workspace folder that contains project-specific design rules. This file is:

1. **Auto-generated** during setup by scanning the library's variables, components, and structure
2. **User-editable** — the designer can refine rules at any time
3. **Read by every workflow** that creates or evaluates visual design (design, build-library, audit)

See the "Design Rules File" section below for the expected format.

---

## Design Rules File

The design rules file (`design-rules.md` by default) lives in the project workspace folder alongside `config.json`. It contains project-specific rules that the AI follows when designing, building components, or auditing.

### How it's generated

During setup, after scanning the library:

1. Read all variables from the library — extract spacing scale, radius scale, color semantics, typography scale
2. Read all components — extract sizing patterns, common compositions
3. Infer layout conventions from existing screens (if any design files are connected)
4. Generate a draft `design-rules.md` with sensible defaults based on what was found
5. Present it to the user for review and editing

### Expected sections

```markdown
# Design Rules — {Project Name}

## Layout
- Screen horizontal padding: {inferred from library spacing scale}
- Section gap: {inferred}
- Max content width: {from platform preset}

## Cards
- Padding: {inferred from library}
- Corner radius: {inferred from library}
- Gap between cards: {inferred}
- Background: {semantic variable name}

## Typography hierarchy
- Screen title: {largest text style}
- Section header: {second largest}
- Body: {base text style}
- Caption: {smallest text style}
- Max text sizes per screen: 3-4

## Iconography
- Default icon size: {inferred or 24x24}
- Icon color: always semantic variables
- Icon library: {detected or ask user}

## Dark mode
- Strategy: {from config.darkModeStrategy}
- {any project-specific dark mode rules}

## Component-specific rules
- {rules inferred from component analysis}

## Do NOT
- {anti-patterns the designer wants to avoid}
```

### Fallback behavior

If no design rules file exists (e.g., the user deleted it or skipped generation), workflows should:

1. Use the library's spacing scale to infer padding/gap values (pick the most commonly used values)
2. Use the library's radius scale for corner radii
3. Follow the typography scale as-is
4. Apply general best practices (consistent spacing, visual hierarchy, no raw values)
5. **Never hardcode specific pixel values** — always derive from what's available in the library

---

## Workspace Folder Structure

The workspace can live in one of two locations, chosen during setup:

**Project-level** (`workspaceLocation: "project"`):
```
{project-root}/.figma-suite/
├── config.json                            # Project configuration (this schema)
├── design-rules.md                        # Project-specific design rules (user-editable)
├── token-map.generated.md                 # Library tokens → Figma variables
├── component-contracts.generated.md       # Library components → Figma component sets
└── component-mapping.generated.md         # Code ↔ Figma component relationships
```

**Global** (`workspaceLocation: "global"`):
```
<HOME>/.claude/figma-suite/{project-name}/
├── config.json
├── design-rules.md
├── token-map.generated.md
├── component-contracts.generated.md
└── component-mapping.generated.md
```

Project-level is default when inside a codebase. Global is default (and the only option) for standalone mode. The folder is named `{project-name}` (kebab-cased from `config.name`). If two global projects share a name, append a short hash.
