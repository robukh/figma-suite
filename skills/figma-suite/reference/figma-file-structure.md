# Figma File Structure

Organization of the Figma design file. All options below are configurable during setup — stored in `config.json` as `"platform"`, `"fileLayout"`, and `"componentLayout"`.

---

## Platform Presets

Setup asks the user to pick a platform. This sets default frame sizes, status bars, and navigation patterns.

| Preset | Frame size | Status bar | Navigation | Best for |
|--------|-----------|------------|------------|----------|
| `mobile-ios` | 393 x 852 | iOS status bar (59px, Dynamic Island) | Tab bar (83px) + nav bar (44px) | iPhone apps |
| `mobile-android` | 393 x 852 | Android status bar (24px) | Bottom nav (80px) + top app bar (56px) | Android apps |
| `mobile-cross` | 393 x 852 | Generic (44px) | Bottom tabs + nav bar | Cross-platform mobile |
| `tablet` | 1024 x 1366 | Varies | Side nav or top nav | iPad / Android tablet |
| `web-desktop` | 1440 x 900 | None | Top nav bar | Web apps, dashboards |
| `web-responsive` | Multiple (375, 768, 1440) | None | Responsive nav | Responsive websites |
| `landing` | 1440 x auto (hug) | None | Sticky header | Marketing pages, landing pages |
| `custom` | User-defined | User-defined | User-defined | Anything else |

Stored in config as:
```jsonc
{
  "platform": "mobile-ios",        // or any preset name
  "frameWidth": 393,               // overridable
  "frameHeight": 852               // overridable, "auto" for landing pages
}
```

---

## File Organization Presets

How pages are structured in the Figma file.

### `page-per-component` (default)

Each component gets its own page. Best for large design systems.

```
📄 Cover
📄 Foundations
📄 Components / Button
📄 Components / Input
📄 Components / Card
📄 Components / [...]
📄 Patterns
📄 Screens / [Feature]
📄 Flows / [Flow]
```

### `single-page-components`

All components on one page, separated by sections. Best for small-medium libraries.

```
📄 Cover
📄 Foundations
📄 Components          ← all components here, one section each
   ├── Section: Button
   ├── Section: Input
   ├── Section: Card
   └── Section: [...]
📄 Patterns
📄 Screens / [Feature]
```

### `flat`

Minimal page structure. Best for small projects or landing pages.

```
📄 Components          ← everything in sections
📄 Screens
```

### `custom`

User defines their own page structure during setup.

Stored in config as:
```jsonc
{
  "fileLayout": "page-per-component"  // or "single-page-components" | "flat" | "custom"
}
```

---

## Component Page Structure

Within each component page (or section), the internal organization.

### `full` (default)

```
Section: Variant Matrix
   └── Component set with all variants laid out in grid
Section: Specs
   └── Sizing, padding, token references, state documentation
Section: Usage
   └── Do/Don't examples, guidelines
```

### `compact`

```
Section: [Component Name]
   ├── Component set
   └── Brief spec annotation below
```

### `variants-only`

```
Component set only — no documentation sections
```

Stored in config as:
```jsonc
{
  "componentLayout": "full"  // or "compact" | "variants-only"
}
```

---

## Variable Collections Structure

The collections pattern is determined by the naming convention preset (see [naming-conventions.md](naming-conventions.md)). The general structure:

```
📦 Primitives (1 mode: "Value")
   ├── {color-family}/          ← one group per color family
   │   └── {shade}              ← raw values
   └── scope: [] (hidden from consumers)

📦 Semantic (N modes: "Light", "Dark", etc.)
   ├── {role-name}              ← aliases into Primitives, different per mode
   └── scope: ["FILL_COLOR", "STROKE_COLOR"]

📦 Typography (1 mode: "Value")
   ├── font-family/
   ├── font-weight/
   ├── font-size/
   └── line-height/

📦 Spacing (1 mode: "Value")
   ├── spacing/
   └── radius/
```

---

## Screen Frame Template

All values come from platform preset and spacing variables — never hardcoded.

```
Frame: "Screen Name" ({frameWidth} x {frameHeight} from config)
├── Fill: bound to Semantic/background variable
├── Auto-layout: vertical, top-left aligned
├── Clip content: true
│
├── Status Bar (from platform preset, or component instance)
│
├── Navigation Bar (component instance if available)
│   ├── Leading action
│   ├── Title (typography variables bound)
│   └── Trailing action
│
├── Content (fill container)
│   ├── Padding: bound to spacing variables
│   ├── Gap: bound to spacing variable
│   ├── [Content sections — composed from library component instances]
│   └── Bottom padding: bound to spacing variable
│
└── Bottom Navigation (from platform preset, or component instance)
```

---

## Slots Note

Figma's native **Slots** feature cannot be created via the Plugin API (no `createSlot()` method). The skill uses **INSTANCE_SWAP** properties with placeholder components as a workaround. After the automated build, users can optionally convert these to native Slots in the Figma UI (right-click → "Convert to slot" or Ctrl+Shift+S).

---

## Dark Mode Strategy

Two approaches — the user picks during setup:

### `variable-modes` (recommended)
- Single screen frame
- Toggle between Light and Dark mode on the Semantic collection
- All colors automatically update

### `duplicate-frames`
- Two frames side-by-side: "Screen - Light" and "Screen - Dark"
- Each pinned to its respective mode
- Better for presentation and stakeholder review

Stored in config as:
```jsonc
{
  "darkModeStrategy": "variable-modes"  // or "duplicate-frames"
}
```

---

## Naming Conventions

Page, frame, component, and layer naming follows the chosen naming preset. See [naming-conventions.md](naming-conventions.md).

Universal rules regardless of preset:
- No unnamed frames or layers ("Frame 1", "Rectangle 3")
- All components in component sets with proper variant naming
- Descriptive layer names matching function ("Label", "Icon", "Container")

---

## File Health Checklist

- [ ] All pages follow the chosen file layout preset
- [ ] No unnamed frames or layers
- [ ] All components are in component sets with proper variant naming
- [ ] All visual properties bound to variables (no hardcoded hex/px)
- [ ] Variable scopes correctly set (not ALL_SCOPES)
- [ ] Code syntax (`var(--name)`) set on all variables
- [ ] Font family loaded and consistent with project tokens
- [ ] Screen frames use platform preset dimensions
- [ ] Auto-layout used throughout (no absolute positioning except where intentional)
- [ ] Light/dark modes both represented (per chosen strategy)
- [ ] INSTANCE_SWAP used for all content slots (native Slots can be converted manually)
