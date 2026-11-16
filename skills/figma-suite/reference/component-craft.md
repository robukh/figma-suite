# Component Craft: Build Like a Senior

The craft layer for components and tokens: why a senior designs this way and what they reject on sight. A component that passes the verification script can still be amateur work, because mechanics are necessary and not sufficient. Read before `build-library`, and apply on every component.

Screen-level composition, hierarchy and copy judgment lives in craft-floor.md and anti-slop.md.

## Contents

1. [Token judgment](#1-token-judgment)
2. [Component anatomy](#2-component-anatomy)
3. [Variant-set design](#3-variant-set-design)
5. [Iconography](#5-iconography)
6. [The quality bar](#6-the-quality-bar--what-a-senior-rejects-master-list): the master red-flag table the audit cites by row number

---

## 1. Token Judgment

The most common amateur mistake is picking a token by its pixel value instead of its role. Tokens encode intent; they are not a px-to-variable lookup.

### Three tiers, reference flows downward only

```
Primitive   raw value, appearance-named:  blue-500, neutral-50, spacing-4
   | aliased by
Semantic    role-named, themeable:         action-primary, surface, text-secondary, gap-inline
   | (optional) aliased by
Component   component-scoped:              button-padding-x, card-radius
```

- A semantic token aliases a primitive; a component token aliases a semantic. Never alias semantic to semantic: chains of indirection that nobody can reason about.
- Consumers bind the semantic (or component) tier. Primitives are scoped `[]` so they stay out of pickers; a node bound straight to `blue-500` cannot be themed and hides intent.

### Pick by role, not by pixel

When `spacing-4` and `gap-inline` both resolve to 8px they are not interchangeable. Bind a button's icon-to-label gap to `gap-inline`, because if inline gaps later change to 6px only that alias moves and everything bound to it follows, while anything bound to `spacing-4` (a different decision) stays put. When several tokens pixel-match, ask what the value is for and bind the token whose name states the reason.

### Name for role, not appearance

`text-secondary` survives a redesign that turns the gray blue; `gray-text` does not. A hex value is a fact and a token name is a decision. A name that describes how it looks (`gray-text`, `blue-button`) is a primitive posing as a semantic: rename it or move it to the primitive tier.

### Reuse before you create

Mint a token only when the decision recurs in more than one place or carries intent the existing set cannot express; otherwise alias an existing one. Many semantics aliasing one primitive is correct (single source of truth). A value used exactly once is usually a raw value plus a logged exception, not `accent-blue-2`; question the design first.

### The component-token tier is optional

Primitive plus Semantic is the right architecture for most libraries. Add component tokens (`input-height`) only at enterprise scale or for a genuine family (form-field sizing across many controls). A component token per component bloats the system and is itself a red flag. When unsure, use a semantic token.

### Scope tightly

A token's `scopes` are part of its meaning. A text color scoped to `TEXT_FILL` must not appear in the stroke picker; a gap scoped to `GAP` must not appear in the radius picker. `ALL_SCOPES` pollutes every picker and is how the wrong token gets bound. Scope values by role: [token-map.md](token-map.md#scopes-by-role).

---

## 2. Component Anatomy

A well-built component is a contract with its consumer, not a picture that looks right.

### Expose intent, hide implementation

- Surface only what a consumer should set: label text, icon, state, variant. Decorative layers, spacers and background shapes get no property, so the structure stays safe to evolve.
- Every exposed property binds to a descendant. A property that references nothing shows in the panel and does nothing; this is the silent-failure class the verification script catches.
- Bubble up the most-used child property (a Dialog exposing its Button's `CTA Label`) so consumers do not drill into nested instances. "Most-used" is a judgment about what the consumer reaches for, not "everything".

### Hug vs fill is a per-layer contract

The most common layout bug, a lopsided component, is usually a child set to HUG that should be FILL (an input that will not stretch to its row, a label that will not take the available width).

- Containers that stretch to their parent are `FILL`; content that defines its own size (label, badge) is `HUG`.
- A HUG parent gives its FILL children nothing to fill, so the parent must itself be `FIXED` or `FILL` for children to expand.
- The component itself defaults to Hug Contents so it adapts when children resize, hide or swap. Fixed applies only where a design token defines the dimension (button height).

### Property kind encodes meaning

| Use | For | Not |
|-----|-----|-----|
| BOOLEAN | show/hide toggle (`Show Icon`) | a 2-value variant axis |
| INSTANCE_SWAP | a specific swappable child (icon, avatar) | a freeform region the consumer authors |
| SLOT | a freeform content region (Card body) | a specific swappable child, or a raw frame |
| Variant | a meaningful anatomical or visual difference | a toggle that could be a boolean |

A button with or without an icon is `Show Icon` (BOOLEAN) plus `Icon` (INSTANCE_SWAP), not two variants; modeling it as a variant axis is what causes the explosion in section 3.

Slot versus swap is decided per region, not per component. A Card whose header carries a swappable icon and whose body holds authored content needs both: INSTANCE_SWAP on the icon, SLOT on the body. Ask of each region "does the consumer pick a component here, or write content here?" Choosing one kind for the whole component is the tell of a shallow pass. Decision table: [component-contracts.md](component-contracts.md#content-regions-slot-vs-instance_swap).

### Split when anatomy diverges

When the layers two "variants" share stop making sense as one structure, they are two components. Forcing divergent anatomy into one set produces variants full of hidden or empty layers.

---

## 3. Variant-Set Design

### Respect the math

Variant count is the product of every axis's value count: `3 sizes x 2 styles x 4 states = 24` is fine, and each added 2-value axis doubles the set. That is how a button reaches 1,600 variants. Multiply before adding an axis. Limits: warn at 20, ceiling 30.

### Promote only what changes anatomy

- Variant property: only axes that change anatomy or visual treatment (`Style`, `Size`, `State`).
- Everything else is BOOLEAN, TEXT or INSTANCE_SWAP, which do not multiply the set. A toggle, an editable label and a swappable icon cost zero extra variants.

This is Figma's own guidance: prefer fewer variants and more boolean/text properties.

### Canonical variant first, then propagate

1. Perfect one cell of the matrix: every paint and dimension binding, Text Styles, nested instances, component properties.
2. Verify it (run the verification script on it).
3. Then `clone()` it per remaining variant and rebind only what differs (tone color, size tokens).

Cloning an incomplete canonical variant turns one missing binding into N, so the verify-before-clone gate is firm. Mechanics: [build-library.md](../workflows/build-library.md#6-building-a-component).

### States live in the matrix

default / hover / pressed / disabled / focus belong to a State axis, never to detached copies beside the component. A library that ships only the happy-path frame is incomplete.

---

## 5. Iconography

An icon is a real icon component, never a text glyph. Typing `✕`, `✓`, `→` or `▾` as text renders inconsistently across platforms and fonts, cannot be recolored or resized like a vector, and leaves no instance to swap.

- Before drawing any icon, search the file for an existing icon component (an `Icons` page) and instance it. If none exists, create a proper vector icon component first.
- When importing an SVG, use `createNodeFromSvg` with `viewBox` plus explicit `width` and `height`, so the icon lands on the sizing grid. Never rebuild an icon from rotated primitives or text.
- One sizing grid (commonly 16 / 20 / 24px) with a live area and optical padding (14px live inside a 16px box); every icon sits on the same keyline.
- Uniform stroke: one weight per size and consistent radius/terminals across the set. Mixed strokes read as amateur work.
- Color bound to a token and size set by the slot, never hardcoded.

---

## 6. The Quality Bar — What a Senior Rejects (master list)

The shared vocabulary. The audit workflow scores findings against this table and cites the row number; the build workflows must not produce any of it. One list, so it is not repeated per section.

| # | Red flag | Right way |
|---|----------|-----------|
| 1 | Raw hex / hardcoded color where a token exists | Bind to a semantic color variable |
| 2 | Bound to a **primitive** where a semantic exists | Bind the semantic tier |
| 3 | Off-scale or **unbound** padding / gap / radius | Bind to spacing/radius variables on the scale |
| 4 | **Detached instance** | Keep the instance; expose properties instead |
| 5 | **Text-as-icon** (`✕`/`✓` glyphs) | Instance a real icon component |
| 6 | Inconsistent radius / stroke / shadow drift | One token per role, applied uniformly |
| 7 | **Combinatorial variant set** that should be booleans/swaps | Variant only for anatomy; booleans/swaps for the rest |
| 8 | **Missing states** (happy-path frame only) | States in the variant matrix |
| 9 | **Appearance-named or unnamed** layers/tokens (`Frame 47`, `gray-text`) | Role-named |
| 10 | System component **edited off-spec** locally (variant drift) | Use the component as-is; propose a system change |
| 11 | Exposed property that **binds to nothing** | Bind it to a descendant or remove it |
| 12 | High-leverage patterns (nav, forms) built from **custom frames** instead of system components | Compose from instances |

Also rejected in review, with no row of their own (cite the section): a token minted for a one-off or a component-token tier added "just in case" (section 1), `ALL_SCOPES` variables (section 1), a child set to HUG that should be FILL (section 2), and cloning before the canonical variant is verified (section 3).

When you produce a component, walk this list. When you audit, cite the row. A green verification script plus a clean pass on this table is the senior bar.
