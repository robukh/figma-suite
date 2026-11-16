# Token Format Mapping

How code token formats map to Figma variable collections, modes, scopes and code syntax. Official `figma-generate-library` owns the Plugin API recipes for creating variables; this file owns the format-to-Figma translation rules.

## Contents

1. [Collection model](#collection-model)
2. [Format rules](#format-rules)
3. [Variable names](#variable-names)
4. [Scopes by role](#scopes-by-role)
5. [Code syntax](#code-syntax)
6. [Token paths for DESIGN.md](#token-paths-for-designmd)

---

## Collection model

Two collections carry the meaning; non-color values sit in single-mode collections beside them.

| Collection | Contents | Modes |
|-----------|----------|-------|
| Primitives | raw palette: hex, px, font names | `Value` (one) |
| Semantic | role-named colors that alias Primitives | `Light`, `Dark` (or the project's themes) |
| Typography | font families, sizes, weights, line heights | `Value` |
| Spacing | spacing scale and radii | `Value` |

Semantic variables alias a primitive and never hold a raw value, so a theme change edits one alias and not every consumer. A project with only semantic tokens and no palette gets a flat Semantic collection without Primitives. Choosing between tiers (and the optional component-token tier): [component-craft.md](component-craft.md#1-token-judgment).

---

## Format rules

### W3C Design Tokens (DTCG)

Files: `*.tokens.json`, `design-tokens/*.json`.

| Code | Figma |
|------|-------|
| `colors-light.tokens.json` / `colors-dark.tokens.json` | Semantic collection, `Light` / `Dark` mode (same token names, one variable, two mode values) |
| `typography.tokens.json`, `spacing*.tokens.json` | Typography, Spacing collections (`Value` mode) |
| `$type: color` / `number` / `string` | `COLOR` / `FLOAT` / `STRING` |
| `$value.hex` | color 0-1 floats: `r = parseInt(hex.slice(1,3),16)/255`, same for g, b |
| `$description` | variable description |
| `{group.token}` reference | alias to the referenced variable |

Read the `hex` field, not `components`, so the value matches what the code ships.

### Style Dictionary

Files: `tokens/**/*.json`, `properties/**/*.json`.

| Code | Figma |
|------|-------|
| nested path `color.background.value` | variable `color/background` |
| category folder `color/` / `size/` | Semantic / Spacing collection |
| `"value": "16"` | `FLOAT` 16 (parse the string) |
| `"value": "{color.primary.value}"` | alias to the referenced variable |
| `"comment"` | variable description |

### CSS custom properties

Files: `src/global.css`, `src/styles/globals.css`, `styles/variables.css`.

| Code | Figma |
|------|-------|
| `:root { --background: #fff }` | `background`, `Light` mode |
| `.dark`, `[data-theme="dark"]`, `@media (prefers-color-scheme: dark)` | same variable, `Dark` mode |
| `--surface-secondary` | variable `surface-secondary` (drop the `--`) |

Value parsing: `#fff`, `rgb()`, `hsl()` (convert to RGB first) -> `COLOR`; `16px` -> `FLOAT` 16; `0.5rem` -> `FLOAT` 8 (x16); quoted name -> `STRING`.

### Tailwind config

Files: `tailwind.config.*`. Read `theme.extend`: `colors.*` -> Semantic, `fontSize.*` -> `font-size/*`, `borderRadius.*` -> `radius/*`, `fontFamily.*` -> `font-family/*`. When a value is `var(--x)`, resolve it through the CSS file to get the per-mode values; a direct hex is used as-is.

### JavaScript theme objects

Files: `theme.ts`, `theme.js`, `src/theme/*`. `theme.colors.*` -> Semantic, `theme.space[4]` / `theme.spacing.md` -> `spacing/4`, `theme.radii.lg` -> `radius/lg`, `theme.fonts.body` -> `font-family/body`.

---

## Variable names

Use `/` as the group separator so the Variables panel groups them. The naming preset ([naming-conventions.md](naming-conventions.md)) decides case and depth; mirror the code's nesting depth.

| Kind | Example |
|------|---------|
| Primitive with shade | `neutral/50`, `brand/500` |
| Flat or grouped semantic | `background`, `surface/secondary` |
| Typography | `font-size/display`, `font-weight/bold`, `line-height/display` |
| Spacing, radius | `spacing/4`, `radius/xl` |

Vendor prefixes (`--p-`, `--md-sys-`) belong in code syntax, not in the Figma name. Duplicate names within a collection are created silently, so check for an existing variable by name before creating.

---

## Scopes by role

Scopes decide which pickers show a variable, so set them from the token's role and never leave `ALL_SCOPES`. These are the real enum values; `FILL_COLOR` does not exist.

| Token role | Scopes |
|-----------|--------|
| Primitives (all) | `[]` (hidden from every picker) |
| Surface / background | `FRAME_FILL`, `SHAPE_FILL` |
| Text color | `TEXT_FILL` |
| Border color | `STROKE_COLOR` |
| Spacing (gap, padding) | `GAP`, `WIDTH_HEIGHT` (drop `WIDTH_HEIGHT` if the scale is not used for sizes) |
| Radius | `CORNER_RADIUS` |
| Font family / size / line height | `FONT_FAMILY` / `FONT_SIZE` / `LINE_HEIGHT` |
| Font weight | `FONT_WEIGHT` (numeric) or `FONT_STYLE` (string like `Semi Bold`) |
| Letter spacing | `LETTER_SPACING` |
| Shadow color / semi-transparent overlay primitive | `EFFECT_COLOR` |
| Opacity | `OPACITY` |

`BOOLEAN` variables take no scopes. The full enum also includes `TEXT_CONTENT`, `ALL_FILLS`, `STROKE_FLOAT`, `EFFECT_FLOAT`, `PARAGRAPH_SPACING`, `PARAGRAPH_INDENT`.

---

## Code syntax

Set `codeSyntax` on every variable, because Dev Mode and round-tripping read it.

- `WEB` uses the `var()` wrapper: `var(--color-bg-primary)`, never bare `--color-bg-primary`, or Dev Mode shows the raw hex instead of the variable.
- `ANDROID` and `iOS` take no wrapper (`colorBgPrimary`, `Color.bgPrimary`).
- Use the original code identifier (the actual CSS variable, including any vendor prefix) rather than deriving it from the Figma name, so the two systems stay independent.
- JS-theme projects with no CSS variables set `WEB` to the property path (`colors.gray.500`).

Separators per platform: Figma `/` (`color/bg/primary`), CSS `-` (`--color-bg-primary`), JSON `.` (`color.bg.primary`), JS camelCase (`colorBgPrimary`). Sync converts between them using the naming preset.

---

## Token paths for DESIGN.md

The token map is the source of the token path list that DESIGN.md front matter references as `{colors.name}`, `{typography.name}`, `{rounded.name}` and `{spacing.name}`. When setup generates `token-map.generated.md`, it also emits those four groups (colors, typography, rounded, spacing) with one path per token, taken from the Semantic tier for colors and from the scale names for the rest. A path that is not in the token map must not appear in DESIGN.md, and a token renamed here is renamed there.
