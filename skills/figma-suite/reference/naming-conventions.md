# Naming Conventions

Setup stores one naming preset in `config.json` (`"namingPreset"`; `"naming"` for custom), and every workflow reads it: setup when generating the token map and contracts, sync when converting token separators, build-library for component/property/layer/variant names, design when placing instances, audit when checking names. When a file already has a consistent convention, match it instead of imposing a preset.

## Presets

| Preset | Components, variants | Properties and booleans | Layers | Figma tokens | Code tokens |
|--------|---------------------|-------------------------|--------|--------------|-------------|
| `figma-standard` (default) | PascalCase; `Variant=Primary, Size=Medium` | Title Case: `Size`, `Has Icon`, `Show CTA`, `Is Disabled` | descriptive: `Label`, `Icon`, `Container` | lowercase slash: `color/bg/primary` | kebab: `color-bg-primary` |
| `code-first` | PascalCase; values camelCase: `variant=primary, size=md` | camelCase matching code props: `size`, `hasIcon`, `showCta`, `isDisabled` | camelCase: `label`, `iconSlot` | slash kebab: `color/bg-primary` | camelCase or kebab |
| `cti` | PascalCase; `Variant=Primary, Size=Medium` | Title Case, as `figma-standard` | descriptive | `category/type/item`: `color/background/primary` | `category-type-item`; categories fixed to `color`, `size`, `font`, `duration`, `opacity`, `space`, `radius` |
| `three-tier` | PascalCase; `Variant=Primary, Size=Medium` | Title Case, as `figma-standard` | descriptive | primitive `blue/500`; semantic `bg/primary`, `text/error`; component `button/bg-primary` | kebab |
| `custom` | per `naming` object below | per `booleanPrefix` | per `layerCase` | per `tokenSeparator` + `tokenStructure` | per user |

`three-tier` keeps primitives scoped `[]` and semantic tokens scoped per property ([token-map.md](token-map.md#scopes-by-role)). `figma-standard` marks hidden components with a `_` prefix (`_Icon Placeholder`) and private ones with `.` (`.GuidelineCard`); pages use plain Title Case (`Cover`, `Foundations`, `Button`).

Custom preset keys (setup prompts for each):

```jsonc
"naming": {
  "componentCase": "PascalCase",     // PascalCase | camelCase | kebab-case
  "variantFormat": "Property=Value", // Property=Value | slash-separated
  "propertyCase": "Title Case",      // Title Case | camelCase | Sentence case
  "booleanPrefix": "Has/Show/Is",    // Has/Show/Is | has/show/is | none
  "layerCase": "Descriptive",        // Descriptive | camelCase | BEM
  "tokenSeparator": "/",             // / | . | -
  "tokenStructure": "semantic",      // flat | semantic | cti | three-tier
  "hiddenPrefix": "_",               // _ | . | --
  "pageStyle": "Title Case"          // Title Case | PascalCase | kebab-case
}
```

## Boolean prefix rule

Every boolean component property starts with the preset's prefix, so its purpose reads at a glance:

| Prefix | Use for | `figma-standard` | `code-first` |
|--------|---------|------------------|--------------|
| `Show X` | toggling an optional element or region | `Show Description`, `Show CTA` | `showDescription` |
| `Has X` | presence of a sub-element | `Has Icon` | `hasIcon` |
| `Is X` | a state | `Is Disabled` | `isDisabled` |

Figma boolean values are `true` / `false`, never `Yes/No` or `On/Off`.

## Property, variant and layer naming

1. A TEXT property is named for its content role (`Title`, `Description`, `Label`, `Placeholder`).
2. A content region takes its property kind from the [SLOT vs INSTANCE_SWAP table](component-contracts.md#content-regions-slot-vs-instance_swap): a specific swappable child is an INSTANCE_SWAP named for its role (`Icon`, `Leading Action`, `CTA Button`); a freeform region is a SLOT, Title Case and singular (`Content`, `Header`, `Footer`).
3. Variant property names match the code prop names, adjusted for the preset's case (`style` in code is `Style` in Figma). When the Figma name must differ from the code name, record the pair in the component's `propertyMap` rather than renaming either side.
4. Variant values are Title Case in Figma (`Primary`, `Medium`) and map to the lowercase code values through the mapping file.
5. No abbreviations unless universal: `CTA` is fine, `desc` is not (`Description`).
6. No unnamed layers (`Frame 47`, `Rectangle 3`); a layer is named for its function, because the name is what the audit and consumers see (red flag #9 in [component-craft.md](component-craft.md#6-the-quality-bar--what-a-senior-rejects-master-list)).
7. Figma names are for designers and code identifiers live in `codeSyntax` and the mapping file: if code says `button-primary` and Figma says `Button`, keep `Button`.
