# Token Format Mapping

How different code token formats map to Figma variable collections, modes, and values.

---

## Supported Formats

### 1. W3C Design Token Format (DTF/DTCG)

The W3C standard format using `$type`, `$value`, and `$description` fields.

**File pattern:** `*.tokens.json`, `design-tokens/*.json`

**Mapping:**

| Code structure | Figma variable |
|---------------|----------------|
| File name `colors-light.tokens.json` | Semantic collection, Light mode |
| File name `colors-dark.tokens.json` | Semantic collection, Dark mode |
| File name `typography.tokens.json` | Typography collection |
| File name `spacing*.tokens.json` | Spacing collection |
| Token key `"background"` | Variable name `background` |
| `$type: "color"` | Variable type: `COLOR` |
| `$type: "number"` | Variable type: `FLOAT` |
| `$type: "string"` | Variable type: `STRING` |
| `$value.hex: "#ffffff"` | Color value `{ r: 1, g: 1, b: 1, a: 1 }` |
| `$value` (number) | Float value |
| `$description` | Variable description |

**Color value conversion (DTF to Figma):**
```
DTF:   { "colorSpace": "srgb", "components": [r, g, b], "alpha": a, "hex": "#rrggbb" }
Figma: { r: float_0_1, g: float_0_1, b: float_0_1, a: float_0_1 }

Conversion: Use hex → parse to 0-1 floats
  r = parseInt(hex.slice(1,3), 16) / 255
  g = parseInt(hex.slice(3,5), 16) / 255
  b = parseInt(hex.slice(5,7), 16) / 255
```

**Multi-mode strategy:**
- Separate files per mode (e.g., `colors-light.json`, `colors-dark.json`)
- Same token names in each file → same variable, different mode values
- Non-color tokens (spacing, typography) → single "Value" mode

---

### 2. Style Dictionary

Token format used by Amazon Style Dictionary.

**File pattern:** `tokens/**/*.json`, `properties/**/*.json`

**Mapping:**

| Code structure | Figma variable |
|---------------|----------------|
| Nested path `color.background.value` | Variable: `color/background` |
| Category folder `color/` | Collection: Semantic |
| Category folder `size/` | Collection: Spacing |
| `"value": "#ffffff"` | Color value |
| `"value": "16"` | Float value (parse string to number) |
| `"type": "color"` | Variable type: `COLOR` |
| `"comment"` | Variable description |

**Alias resolution:**
```json
{ "value": "{color.primary.value}" }  →  Figma alias to the referenced variable
```

---

### 3. CSS Custom Properties

Token values defined as CSS variables in `:root` and theme selectors.

**File pattern:** `src/global.css`, `src/styles/globals.css`, `styles/variables.css`

**Mapping:**

| Code structure | Figma variable |
|---------------|----------------|
| `:root { --background: #fff }` | Semantic/background, Light mode |
| `.dark { --background: #0a0a0a }` | Semantic/background, Dark mode |
| `[data-theme="dark"]` | Same as `.dark` |
| `@media (prefers-color-scheme: dark)` | Same as `.dark` |
| Variable name `--surface-secondary` | Variable: `surface-secondary` |

**Value parsing:**
```
#ffffff           → COLOR { r: 1, g: 1, b: 1 }
rgb(255, 255, 255) → COLOR { r: 1, g: 1, b: 1 }
hsl(0, 0%, 100%)  → COLOR (convert to RGB first)
16px              → FLOAT 16 (strip unit)
0.5rem            → FLOAT 8 (× 16)
"Inter"            → STRING "Inter"
```

---

### 4. Tailwind Config

Theme extension tokens in `tailwind.config.js` or `tailwind.config.ts`.

**File pattern:** `tailwind.config.*`

**Mapping:**

| Code structure | Figma variable |
|---------------|----------------|
| `theme.extend.colors.background` | Semantic/background |
| `theme.extend.fontSize['display']` | Typography/font-size-display |
| `theme.extend.borderRadius['3xl']` | Spacing/radius-3xl |
| `theme.extend.fontFamily.sans` | Typography/font-family-sans |
| CSS var reference `var(--background)` | Resolve through CSS file |
| Direct value `"#ffffff"` | Direct color value |

**When Tailwind references CSS vars:**
Tailwind often references CSS vars: `colors: { background: 'var(--background)' }`. In this case, resolve through the CSS file to get actual values per mode.

---

### 5. JavaScript Theme Object

Framework-specific theme files.

**File pattern:** `theme.ts`, `theme.js`, `src/theme/*`

**Mapping:**

| Code structure | Figma variable |
|---------------|----------------|
| `theme.colors.background` | Semantic/background |
| `theme.space[4]` or `theme.spacing.md` | Spacing/spacing-4 |
| `theme.radii.lg` | Spacing/radius-lg |
| `theme.fonts.body` | Typography/font-family-body |

---

## Collection Organization

Regardless of input format, tokens are organized into Figma collections:

| Collection | Contents | Modes |
|-----------|----------|-------|
| **Primitives** | Raw color values, full palette | Value (single mode) |
| **Semantic** | Purpose-named colors (background, foreground, accent...) | Light, Dark |
| **Typography** | Font families, sizes, weights, line heights | Value (single mode) |
| **Spacing** | Spacing values, border radii | Value (single mode) |

### When to use Primitives vs Semantic

- **Primitives**: The base color palette (e.g., neutral-50 through neutral-950, brand colors with shade variants)
- **Semantic**: Named by purpose, alias into Primitives (e.g., `background` → `Primitives/neutral-50` in Light, `Primitives/neutral-950` in Dark)

If the project only has semantic tokens (no primitive palette), create a flat Semantic collection without a Primitives layer.

---

## Variable Naming Conventions

| Pattern | Example |
|---------|---------|
| Flat semantic | `background`, `foreground`, `accent` |
| Grouped semantic | `surface/primary`, `surface/secondary`, `surface/elevated` |
| Primitive with shade | `neutral/50`, `neutral/100`, `brand/500` |
| Typography | `font-size/display`, `font-weight/bold`, `line-height/display` |
| Spacing | `spacing/4`, `spacing/6` |
| Radius | `radius/xl`, `radius/3xl` |

Use `/` as the group separator in Figma (creates visual grouping in the variables panel).
