# Official Figma Skills — Load Order and Our Overrides

figma-suite does not copy Figma's Plugin API guidance. It loads Figma's own skills and adds only what they do not cover. This is the single place that names them, so when Figma renames or splits a skill, only this file changes.

**Contents:** [Load order](#load-order) · [Session and logging parameters](#session-and-logging-parameters) · [Discovery order](#discovery-order-before-building-anything) · [Where we override](#where-we-override-official-guidance) · [If a skill is unavailable](#if-a-skill-is-unavailable)

## Load order

| You are about to… | Load first |
|---|---|
| Call `use_figma` for anything (read or write) | `figma-use` |
| Change anything visible (a property, a screen, a component placement) | `figma-use` + `figma-generate-design` |
| Build or change a reusable component, variants, variables, styles | `figma-use` + `figma-generate-library` |
| Create Code Connect templates | `figma-code-connect` |
| Turn a Figma node into code (`get_design_context`) | `figma-design-to-code` |
| Create a new Figma file | `figma-create-new-file` |

Each is available as the Figma plugin's skill, or as an MCP resource at `skill://figma/<name>/SKILL.md` (references at `skill://figma/<name>/references/<file>.md`). Prefer the plugin copy; fall back to the resource. The live resource is the authority when anything here disagrees.

Some sessions and subagents have no MCP resource reader (`ReadMcpResourceTool` missing). Then read the plugin's cached copy: `<HOME>/.claude/plugins/cache/claude-plugins-official/figma/<version>/skills/<name>/SKILL.md` (and its `references/`). Pass `skillNames` without the `resource:` prefix in that case. A cached copy can lag the live one; say so in the report if you relied on it.

## Session and logging parameters

- Call `create_session` with the `fileKey` and a short task description before any file read or write, then pass the returned `sessionId` to every tool that accepts it, including follow-ups and work across files. Create the file first (`create_new_file`) if none exists.
- Pass `skillNames` on `use_figma` (comma-separated, e.g. `figma-use,figma-generate-design`). When a skill was loaded from an MCP resource, prefix the name with `resource:`. It is a logging field and does not change execution.

## Discovery order before building anything

Reusing what exists is the whole point of the design system, so discover before you draw:

1. **Code Connect** — look for `*.figma.ts` / `*.figma.js` files next to the components you need. They give exact Figma component URLs.
2. **Library scope** — `get_libraries` first, then use the chosen `libraryKey`s in `includeLibraryKeys`.
3. **One whole-frame inventory** of an existing screen (component keys, bound variables, text and effect styles) through a single read-only `use_figma` call.
4. **Gap-only `search_design_system`** — `queries: [{ entity: "component" | "variable" | "style", query }]`, one intent per query. `getLocalVariableCollectionsAsync()` returning nothing does not mean no variables exist: remote library variables are only found by search.

figma-suite adds one step in front: read the project's `component-mappings/` so a code component resolves to its Figma component without searching (see [mapping-schema.md](mapping-schema.md)).

## Where we override official guidance

| Topic | Official | figma-suite | Why |
|---|---|---|---|
| Freeform content regions | `figma-use` documents Slots; the library recipes do not use them | Per region: native `SLOT` for freeform content, `INSTANCE_SWAP` for a specific swappable child | Slots exist and fit authored content; swap fits a chosen component ([component-contracts.md](component-contracts.md#content-regions-slot-vs-instance_swap)) |
| Typography binding | — | Bind variables on the Text Style, not on TextNodes | `TextStyle.setBoundVariable()` works; TextNode font properties are not bindable |
| Token tier bound by consumers | Both tiers are bindable | Consumers bind the semantic tier; primitives are reference-only (scope `[]`) | Themeable and intent-carrying ([component-craft.md](component-craft.md#1-token-judgment)) |
| Writing without asking | Not specified | Dry-run report and approval before any write in `sync`, `build-library`, `setup` | Our changes touch both code and Figma |

Everything else (return values, color ranges, font loading, sizing enums, page rules, error contract, screenshot cadence) follows the official skills exactly. [plugin-api-deltas.md](plugin-api-deltas.md) records the few Plugin API facts we add.

## If a skill is unavailable

If neither the plugin skill nor the `skill://` resource can be read, stop and tell the user: writing without the official rules is the main cause of hard-to-debug `use_figma` failures. Read-only work (audit, drift detection) can continue.
