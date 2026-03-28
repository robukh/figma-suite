# Workflow: Build Library

Generate a professional-grade Figma component library from codebase components. Works in strict phase order with mandatory user checkpoints.

---

## Overview

This workflow reads UI components from the codebase, understands their props/variants/states, and creates corresponding Figma component sets with proper variable bindings, auto-layout, and variant properties.

**Typical scope:** 20-100+ `use_figma` calls depending on library size. Plan for a multi-step session.

---

## File Flexibility

This workflow adapts to the user's Figma file setup. Ask the user which scenario applies:

### Scenario A: Single file (library + screens)
Everything lives in one Figma file. Components are created and used in the same file.
- Build components directly in the file
- Screens can reference components immediately

### Scenario B: Separate library file
The component library is a dedicated Figma file, published for consumption by other files. If `config.libraries[]` has entries, ask which library to build into (default: first entry).
- Build components in the library file
- After building, remind the user to **publish the library** so other files can use it
- When designing screens in a different file, use `search_design_system` to find published components

### Scenario C: No library yet (starting from scratch)
The user has no existing Figma file. Create one and build the library in it.
- Create all foundations + components in a new file
- Offer to set up the file as a publishable library

### Scenario D: Existing published library (adding components)
A library already exists with some components. Adding new ones or updating existing ones.
- Search the library first with `search_design_system` to inventory what exists
- Only create what's missing or needs updating
- Respect existing naming conventions and structure in the file

The skill works identically in all scenarios — the only difference is where components are created and whether they need publishing afterward.

---

## Phase 0: Discovery

1. **Find component files** — scan configured `componentPaths` (or auto-discover `src/components/ui/`, `src/components/`, `components/`)
2. **Read each component** — extract:
   - Component name
   - Props and their types (variants, sizes, states)
   - Default prop values
   - Styling classes/tokens used
   - Accessibility attributes
   - Slot/children patterns
3. **Read design guide** — if a design system guide exists, extract component specifications (sizes, spacing, radius rules)
4. **Check existing Figma library** — call `mcp__figma__search_design_system` to see what already exists. Map code components to existing Figma components.
5. **Present inventory** to user — list every component discovered, with its variants, sizes, and states as found in the code or library. Do not assume any specific number of components, variants, or sizes. Report exactly what was discovered.

Example format (illustrative only — real content comes from discovery):

```markdown
## Component Library Plan

### New components to create ({N})
- {ComponentName} ({variants discovered} × {sizes discovered})
- ...

### Existing in Figma ({N})
- {ComponentName} — up to date | needs variant update
- ...

### Skipped
- {ComponentName} — {reason: wrapper, logic-only, etc.}
```

**CHECKPOINT:** Wait for user approval before proceeding. The user may add, remove, or reorder components.

---

## Phase 1: Foundations (if not already synced)

Before components, ensure Figma has the token foundation:

1. Check if variable collections exist (Primitives, Semantic, Typography, Spacing)
2. If missing, run the [sync-tokens](sync-tokens.md) workflow first
3. Verify font family is available in the Figma file

> **If tokens are already synced, skip to Phase 2.**

---

## Phase 2: File Structure

Set up the Figma file organization based on the `config.fileLayout` preset chosen during setup. See [figma-file-structure.md](../reference/figma-file-structure.md) for all presets.

1. **Check existing pages** — never duplicate. If the file already has pages, respect the existing structure.
2. **Create pages** following the chosen preset:
   - `page-per-component` — one page per component under `Components/`
   - `single-page-components` — all components on one page with sections
   - `flat` — minimal pages
   - `custom` — whatever the user defined
3. Always create a **Foundations** page (color swatches, typography samples, spacing/radius reference) if one doesn't exist
4. Use sections within pages to organize variants

---

## Component Creation Rules

These rules are mandatory for every component created in Figma. Violations fail QA.

All universal component rules from SKILL.md apply here (Zero Raw Values, Text Styles, Component Composition, Hug Contents, Build Order). Below are the **build-library-specific details** that expand on those rules.

### Zero Raw Values — Binding Reference

| Property | Must bind to | Never use |
|----------|-------------|-----------|
| Fill color | Semantic color variable | Hex value (`#6366f1`) |
| Text color | Semantic color variable | Hex value |
| Stroke color | Semantic color variable | Hex value |
| Corner radius | `Spacing/radius-*` variable | Pixel number (`24`) |
| Padding (all sides) | `Spacing/spacing-*` variable | Pixel number (`16`) |
| Gap | `Spacing/spacing-*` variable | Pixel number (`12`) |
| Width / Height (fixed) | `Spacing/spacing-*` variable | Pixel number (`56`) |
| Font family | `Typography/font-family/*` variable | Raw font name ("Inter") |
| Font size | `Typography/font-size/*` variable | Pixel number (`17`) |
| Font weight | `Typography/font-weight/*` variable | Numeric weight (`700`) |
| Line height | `Typography/line-height/*` variable | Pixel number (`26`) |

If a needed variable doesn't exist, create it first (or flag it) — never use a raw value as a workaround.

### Adaptive Sizing Rule

Parent components that contain nested instances must use **Hug Contents** sizing so they adapt when children change.

| Scenario | Parent sizing | Why |
|----------|--------------|-----|
| Card contains variable-length list rows | Hug Contents (vertical) | Card grows/shrinks with row count |
| EmptyState with optional CTA button | Hug Contents (vertical) | Collapses when CTA is hidden |
| Button with optional icon | Hug Contents (horizontal) | Shrinks when icon is hidden |
| Dialog with variable body text | Hug Contents (vertical) | Grows with content |
| Fixed-height input/button | Fixed height, Fill (horizontal) | Height is a design token, width fills parent |

**Rules:**
- Default to **Hug Contents** on both axes unless the component has a fixed dimension from a design token (e.g., button height)
- When a boolean property hides a child, the parent must automatically collapse the gap — this only works with Hug Contents + auto-layout
- When a child instance is swapped for a different variant (bigger icon, different button size), the parent must resize — Hug Contents ensures this
- Only use **Fill Container** when the component should stretch to its parent's width (e.g., full-width buttons, inputs in forms)
- Only use **Fixed** when a dimension comes from a design token (e.g., a button height defined by a spacing variable)

### Component Properties — Full Utilization

Every component must expose the right properties so consumers can customize without detaching.

| Property type | When to use | Example |
|--------------|------------|---------|
| **Variant** | Visual style choices (2+ options) | `Variant=Primary\|Secondary`, `Size=Sm\|Md\|Lg` |
| **Boolean** | Show/hide optional elements | `Show Icon`, `Show CTA`, `Disabled`, `Loading` |
| **Text** | Editable text content | `Label`, `Title`, `Description`, `Placeholder` |
| **Instance swap** | Replaceable child components | `Icon`, `Leading Action`, `Trailing Element` |
| **Exposed nested properties** | Bubble up child instance properties | Expose Button.Label through parent as `CTA Label` |

**Slots and instance swap best practices:**
- Define instance swap properties for every child component that users might want to customize
- Set a sensible **default instance** — the most common variant
- Use **preferred values** to constrain which components can be swapped in (e.g., only icon components for an icon slot)
- For optional slots, pair with a boolean property: `Show Icon` controls visibility, `Icon` controls which icon

**Exposed nested properties:**
When component A nests component B, expose B's most-used properties through A:
- A text field on the parent that maps to the child's label
- An instance swap on the parent that maps to the child's icon slot
- This lets consumers edit the child without drilling into layers

### Build Order

Components must be built in dependency order — primitives before composites:

```
Tier 1 (no dependencies):  Components with no library dependencies (e.g., icons, badges, switches)
Tier 2 (uses Tier 1):      Components that nest Tier 1 (e.g., buttons with icons, inputs)
Tier 3 (uses Tier 1-2):    Containers that nest Tier 1-2 (e.g., cards, list rows, toasts)
Tier 4 (uses Tier 1-3):    Overlays and shells that nest everything (e.g., dialogs, navigation)
```

Assign tiers based on the actual dependency graph discovered during Phase 0. Never build a higher-tier component before its dependencies exist.

---

## Phase 3: Build Components (one at a time)

For each component in the approved plan, following the build order above:

### Step 1: Analyze code component

Read the component file and extract:
- **Variant axis** — e.g., `variant: "primary" | "secondary" | "outline"`
- **Size axis** — e.g., `size: "sm" | "md" | "lg"`
- **State axis** — e.g., default, hover, pressed, disabled, focused, error
- **Slots** — icon position, text content, badge
- **Fixed dimensions** — height, min-width, padding from Tailwind classes
- **Tokens used** — map each class to the corresponding Figma variable
- **Child components used** — which existing library components does this code component render?

### Step 2: Create base component

Using `mcp__figma__use_figma`:

1. Navigate to the component's page
2. Create a **Section** named after the component
3. Create the base component frame:
   - Set to **auto-layout** immediately
   - Bind **every** visual property to a variable (see Zero Raw Values Rule above)
   - For text layers, bind all four typography properties individually (see Text Style Binding Rule)
   - For child components, place **instances** of existing library components (see Component Composition Rule)
   - **Never hardcode** any value when a variable exists
4. Set default sizing to **Hug Contents** (both axes)

### Step 3: Build variant matrix

For each combination of variant axes:
1. Duplicate the base component
2. Override the bound variables for that variant
3. Name using `Property=Value` format: `Variant=Primary, Size=Medium`
4. **Add component properties BEFORE combining** — `addComponentProperty()` returns a dynamic key (e.g., `"label#4:0"`). Capture this key and link it to child nodes via `componentPropertyReferences`. See [plugin-api-patterns.md](../reference/plugin-api-patterns.md) for details.
5. Combine all variants into a component set using `combineAsVariants`
6. **Layout variants in a grid after combining** — all children stack at (0,0) after `combineAsVariants`. Position them in a grid and resize the ComponentSet:
   ```javascript
   cs.children.forEach((child, i) => {
     child.x = (i % 4) * colWidth;
     child.y = Math.floor(i / 4) * rowHeight;
   });
   let maxX = 0, maxY = 0;
   for (const child of cs.children) {
     maxX = Math.max(maxX, child.x + child.width);
     maxY = Math.max(maxY, child.y + child.height);
   }
   cs.resizeWithoutConstraints(maxX + 40, maxY + 40);
   ```

### Step 4: Verify component properties

After combining, verify the component set inherited all properties from its children. Do NOT add properties to the `ComponentSetNode` directly — add them to individual variant components before combining.

### Step 5: Screenshot and validate

1. Call `mcp__figma__get_screenshot` on the component set
2. Verify:
   - All variants are visually distinct
   - Spacing and sizing match code specifications
   - **Zero Raw Values**: every fill, stroke, radius, padding, gap, and text property is variable-bound
   - **Text styles**: all four typography properties (family, size, weight, line-height) bound per text layer
   - **Composition**: child components are instances, not recreated from scratch
   - Auto-layout behaves correctly (resize test)
3. If issues found, fix and re-screenshot (max 3 iterations)

### Step 6: Annotate

Add a frame below the component set with:
- Component name and description
- Props table (name, type, default, description)
- Usage guidelines from design guide (if available)

**Repeat Steps 1-6 for each component.**

---

## Phase 4: Patterns Page

After all components are built:

1. Create a **Patterns** page
2. Build common layout compositions using instances of the new components. Derive patterns from what was actually built — compose the components into realistic screen sections that demonstrate how they work together. If unsure which patterns are most useful for this project, ask the user.
3. Screenshot and validate each pattern

---

## Phase 5: QA and Handoff

1. **Variable audit** — ensure every component property is bound to a variable (no raw values)
2. **Consistency check** — spacing, radius, and colors should all come from the same token collections
3. **Component naming** — verify all use consistent `ComponentName/Variant=Value` naming
4. **Generate report**:

```markdown
## Library Build Complete

### Components created: {N}
| Component | Variants | Properties | Status |
|-----------|----------|-----------|--------|
| {name} | {count} | {count} ({list}) | Complete |
| ... | ... | ... | ... |

### Foundations
- Color variables: {N}
- Typography variables: {N}
- Spacing variables: {N}
- Radius variables: {N}

### Next steps
- Publish library to team
- Set up Code Connect mappings
```

Report the actual counts from the build. Do not assume any specific number of variables or components.

---

## Updating an Existing Library

When components already exist in Figma:

1. **Compare** code component props with Figma component properties
2. **Flag differences** — new variants, removed variants, changed defaults
3. **Present diff** to user with recommended updates
4. **Apply approved changes** — add new variants, update properties, rebind variables
5. **Never delete existing variants** without explicit confirmation — they may be in use

---

## Figma Plugin API Implementation Rules

See [plugin-api-patterns.md](../reference/plugin-api-patterns.md) for the full reference on correct Plugin API usage: sizing (hug vs fixed), text style application, instance swap slots, component composition via instances, the Slots vs INSTANCE_SWAP API limitation, and known API constraints.

All patterns in that file are **mandatory** for this workflow. Key reminders:

- Never call `resize()` on a HUG axis
- Use `setTextStyleIdAsync()` for typography, not individual variable bindings
- Content slots must be INSTANCE_SWAP properties, not empty frames
- Build in strict tier order — never build a component before its dependencies
- Keep `use_figma` scripts under ~200 lines — split larger operations
