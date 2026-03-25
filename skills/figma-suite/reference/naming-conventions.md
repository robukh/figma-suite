# Naming Conventions

During setup, the user picks a naming preset (or defines a custom one). The choice is stored in `config.json` as `"namingPreset"` and applied across all workflows.

---

## Presets

### 1. `figma-standard` (default)

The Figma-native convention. Best for teams working primarily in Figma.

| Aspect | Convention | Example |
|--------|-----------|---------|
| Components | PascalCase | `Button`, `EmptyState` |
| Grouping | Slash-separated | `Components / Button` |
| Variants | `Property=Value` | `Variant=Primary, Size=Medium` |
| Properties | Title Case | `Size`, `Has Icon`, `Show CTA` |
| Booleans | Conversational | `Has Icon`, `Show Description`, `Is Disabled` |
| Layers | Descriptive function | `Label`, `Icon`, `Container`, `Background` |
| Hidden components | `_` prefix | `_Slot Placeholder`, `_Internal` |
| Private components | `.` prefix | `.GuidelineCard` |
| Tokens (Figma vars) | Slash-separated lowercase | `color/bg/primary`, `spacing/4` |
| Tokens (code) | kebab-case | `color-bg-primary`, `spacing-4` |
| Pages | Plain Title Case | `Cover`, `Foundations`, `Button`, `Patterns` |

**Used by:** Figma UI3, most Figma community libraries, Figma MCP server guide.

---

### 2. `code-first`

Mirrors code conventions. Best for developer-heavy teams where code is source of truth.

| Aspect | Convention | Example |
|--------|-----------|---------|
| Components | PascalCase (matches React/Swift) | `Button`, `EmptyState` |
| Grouping | Slash-separated | `Components / Button` |
| Variants | `Property=Value`, values in camelCase | `variant=primary, size=md` |
| Properties | camelCase (matches code props) | `size`, `hasIcon`, `showCta` |
| Booleans | Code-style | `hasIcon`, `isDisabled`, `showDescription` |
| Layers | camelCase | `label`, `iconSlot`, `container` |
| Tokens (Figma vars) | Slash-separated kebab | `color/bg-primary`, `spacing/4` |
| Tokens (code) | camelCase or kebab | `bgPrimary` or `bg-primary` |
| Pages | PascalCase | `Cover`, `Foundations`, `Button` |

**Used by:** Teams with Style Dictionary pipelines, React-heavy organizations.

---

### 3. `cti` (Category-Type-Item)

Amazon/Style Dictionary convention. Best for multi-platform token systems.

| Aspect | Convention | Example |
|--------|-----------|---------|
| Components | PascalCase | `Button`, `Card` |
| Variants | `Property=Value` | `Variant=Primary, Size=Medium` |
| Properties | Title Case | `Size`, `Has Icon` |
| Tokens (Figma vars) | `category/type/item` | `color/background/primary`, `size/font/body` |
| Tokens (code) | `category-type-item` | `color-background-primary`, `size-font-body` |
| Token categories | Fixed set | `color`, `size`, `font`, `duration`, `opacity`, `space`, `radius` |

**Used by:** Amazon, Salesforce Lightning, AWS Cloudscape, enterprise design systems.

---

### 4. `three-tier`

Primitive → Semantic → Component token tiers. Best for themed/multi-brand systems.

| Aspect | Convention | Example |
|--------|-----------|---------|
| Components | PascalCase | `Button`, `Card` |
| Variants | `Property=Value` | `Variant=Primary, Size=Medium` |
| Tier 1 (primitive) | `{color}/{shade}` | `blue/500`, `gray/50` |
| Tier 2 (semantic) | `{role}/{modifier}` | `bg/primary`, `text/error`, `border/default` |
| Tier 3 (component) | `{component}/{property}` | `button/bg-primary`, `input/border-focus` |
| Primitives scope | Hidden (`[]`) | Not visible to consumers |
| Semantic scope | Per-property | `FILL_COLOR`, `STROKE_COLOR` |

**Used by:** Material Design 3, Shopify Polaris, Adobe Spectrum, Atlassian Design System.

---

### 5. `custom`

User defines their own rules. Setup prompts for each aspect:

```jsonc
{
  "namingPreset": "custom",
  "naming": {
    "componentCase": "PascalCase",       // PascalCase | camelCase | kebab-case
    "variantFormat": "Property=Value",   // Property=Value | slash-separated
    "propertyCase": "Title Case",        // Title Case | camelCase | Sentence case
    "booleanPrefix": "Has/Show/Is",      // Has/Show/Is | has/show/is | none
    "layerCase": "Descriptive",          // Descriptive | camelCase | BEM
    "tokenSeparator": "/",              // / | . | -
    "tokenStructure": "semantic",        // flat | semantic | cti | three-tier
    "hiddenPrefix": "_",                // _ | . | --
    "pageStyle": "Title Case"           // Title Case | PascalCase | kebab-case
  }
}
```

---

## How Presets Are Applied

Each workflow reads `config.namingPreset` (or `config.naming` for custom) and applies it:

| Workflow | Uses naming for |
|----------|----------------|
| **setup** | Generating token-map and component-contracts with correct names |
| **sync** | Mapping code token names ↔ Figma variable names (separator conversion) |
| **build-library** | Component names, property names, layer names, variant format |
| **design** | Consistent with library naming when placing instances |
| **audit** | Checking names match the chosen convention |

### Separator conversion

The same token has different separators per platform:

| Platform | Separator | Example |
|----------|-----------|---------|
| Figma variables | `/` | `color/bg/primary` |
| CSS custom properties | `-` | `--color-bg-primary` |
| JSON tokens | `.` | `color.bg.primary` |
| JavaScript | camelCase | `colorBgPrimary` |

The sync workflow handles conversion automatically based on the preset.

---

## Property Naming Rules (All Presets)

Regardless of preset, these rules always apply:

1. **Every text layer** must have a TEXT property — named after its content role (`Title`, `Description`, `Label`, `Placeholder`)
2. **Every optional element** must have a BOOLEAN property — prefixed with the preset's boolean prefix (`Has Icon`, `Show CTA`, `Is Disabled`)
3. **Every swappable child** must have an INSTANCE_SWAP property — named after the slot role (`Icon`, `Leading Action`, `CTA Button`)
4. **Variant properties** must match code prop names (adjusted for case convention)
5. **No abbreviations** in property names unless universally understood (`CTA` is ok, `desc` is not — use `Description`)
