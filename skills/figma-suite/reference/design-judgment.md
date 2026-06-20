# Design Judgment — Build Like a Senior

This is the craft layer. The other reference files tell you **how** the Plugin API works and
**what** every rule mandates. This file tells you **why a senior product designer does it that
way, and what they reject on sight.**

A component that passes the verification script can still be amateur work. Mechanics are
necessary, not sufficient. Read this before `build-library` or `design`, and apply its judgment
on every component — not just the ones the checklist flags.

> **How to use this file:** each section ends with a **A senior rejects** list. Those are the
> red flags. The audit workflow scores against them; the build workflows must not produce them.

---

## 1. Token Judgment

The single most common amateur mistake is **picking a token by its pixel value instead of its
role.** Tokens are not a lookup table from px → variable. They encode *intent*.

### Three tiers, reference flows downward only

```
Primitive   raw value, appearance-named:  blue-500, neutral-50, spacing-4, radius-8
   ↓ aliased by
Semantic    role-named, themeable:         action-primary, surface, text-secondary, gap-inline
   ↓ (optional) aliased by
Component   component-scoped:              button-padding-x, card-radius   ← use sparingly
```

- **Reference flows downward only.** Semantic aliases a primitive. A component token aliases a
  semantic. **Never alias semantic → semantic** — that creates indirection chains nobody can
  reason about.
- **Consumers bind the semantic (or component) tier. Primitives are for reference only** — they
  are scoped `[]` (hidden) precisely so they don't show up in pickers. Binding a node directly to
  `blue-500` instead of `action-primary` is a red flag: it can't be themed and it hides intent.

### Pick by role, not by pixel

> When `spacing-4` and `gap-inline` both resolve to `8px`, they are **not interchangeable.**

- `gap-inline` is the *semantic* token for space between inline siblings. Bind a button's icon-to-
  label gap to `gap-inline`.
- `spacing-4` is the *primitive* that `gap-inline` happens to reference today. If the design
  system later decides inline gaps should be `6px`, only `gap-inline`'s alias changes — everything
  bound to it updates, and everything bound to `spacing-4` (a different decision) does not.
- **Binding to the primitive throws away that distinction.** Two things that are the same pixel
  *today* for different *reasons* must use different semantic tokens.

When several tokens pixel-match, ask: *what is this space/color FOR?* Bind the one whose **name
describes the reason**, not just the value.

### Name for role, not appearance

`text-secondary` survives a redesign that turns the gray blue. `gray-text` does not. A hex value
is a fact; a token name is a **decision**. If a token's name describes how it looks
(`gray-text`, `blue-button`) rather than what it's for (`text-secondary`, `action-primary`), it's
a primitive masquerading as a semantic — fix the name or move it to the primitive tier.

### Reuse before you create

Create a new token **only** when a visual decision (a) recurs across more than one place, **or**
(b) carries distinct intent the existing set can't express. Otherwise alias an existing one.

- Many semantics may alias one primitive — that's correct (single source of truth).
- A one-off value used in exactly one place is usually **not** a token; use the raw value and log
  it as an exception (per the no-silent-skipping rule).
- Don't mint `accent-blue-2` because a design used a slightly different blue once. Ask whether the
  design is right first.

### The component-token tier is optional — default to two tiers

Primitive + Semantic is the right architecture for **most** libraries. Reach for component tokens
(`button-padding-x`, `input-height`) **only** at enterprise scale or for genuine token *families*
(form-field sizing across many controls). Inventing a component token per component bloats the
system and is itself a red flag. When unsure, use a semantic token and move on.

### Scope tightly

A token's `scopes` are part of its meaning. A text-fill color scoped to `["TEXT_FILL"]` must not
appear in the stroke picker; a gap spacing scoped to `["GAP"]` must not appear in the corner-
radius picker. Loose scoping (`ALL_SCOPES`) is how the wrong token gets bound — it pollutes every
picker and invites misuse. (Scoping syntax: SKILL.md "Variable scoping rules".)

### A senior rejects

- A node bound directly to a **primitive** (`blue-500`) where a semantic exists.
- A token **named for appearance** (`gray-text`) instead of role.
- The **same pixel value bound via different tokens inconsistently** — or different roles
  collapsed onto one token.
- A **new token minted for a one-off**, or a component-token tier introduced "just in case."
- `ALL_SCOPES` / unscoped variables.

---

## 2. Component Anatomy

A well-built component is a **contract with its consumer**, not a picture that happens to look
right.

### Expose intent, hide implementation

- Surface only the properties a consumer should set: label text, icon slot, state, variant.
  **Lock internal structure** — decorative layers, spacers, background shapes get no property.
- **Every exposed property must bind to a descendant.** A property that references nothing is dead
  — it appears in the panel and does nothing. (This is the silent-failure class the verification
  script catches.)
- Bubble up the **most-used** child property to the parent (Dialog exposing Button's `CTA Label`)
  so consumers don't drill into nested instances. "Most-used" is a judgment about what the
  consumer actually reaches for — not "everything."

### Hug vs Fill is a per-layer contract

Every layer's sizing is a decision, not a default. The single most common layout bug — a lopsided
component — is almost always **a child set to HUG that should be FILL** (e.g. an input that won't
stretch to fill its row, a label that won't take available width).

- **Containers** that should stretch to their parent → `FILL`.
- **Content that defines its own size** (a label, a badge) → `HUG`.
- A `HUG` parent cannot give `FILL` children meaningful space — the parent must be `FIXED` or
  `FILL` for children to expand. (Mechanics: plugin-api-patterns.md "Sizing".)
- Default the **component itself** to Hug Contents so it adapts when children resize, hide, or
  swap. Use Fixed only when a design token defines the dimension (button height).

### Property *kind* encodes meaning

| Use… | for… | not… |
|------|------|------|
| **Boolean** | show/hide a toggle (`Show Icon`) | a 2-value variant axis |
| **Instance-swap** | swap a specific child component (icon, avatar) | a raw frame slot |
| **Slot** (native) | freeform content region (Card body) | a raw frame |
| **Variant** | a *meaningful anatomical/visual* difference | a toggle that could be boolean |

A with/without-icon button is `Show Icon` (boolean) + `Icon` (swap) — **not two variants.** Using a
variant axis for something that should be boolean is what causes combinatorial explosion (§3).

### Split when anatomy diverges

If the shared layers between two "variants" stop making sense as one structure, it's **two
components**, not one set. Forcing divergent anatomy into one variant set produces variants full
of hidden/empty layers.

### A senior rejects

- Internal/decorative layers **exposed as properties**; or an exposed property that **binds to
  nothing**.
- A child **HUG that should FILL** (lopsided layout).
- A **boolean's worth of difference modeled as a variant axis**.
- A component set whose variants share almost no anatomy (should be split).

---

## 3. Variant-Set Design

### Respect the math

Variant count = **product** of all axis value-counts. `3 sizes × 2 styles × 4 states = 24` is
fine. **Each additional 2-value variant axis *doubles* the set.** This is how a button reaches
1,600 variants. Before adding a variant axis, multiply it out.

### Promote to a variant property only what changes anatomy

- **Variant property** → only axes that change the component's anatomy or visual treatment
  (`Style`, `Size`, `State`).
- **Everything else → boolean / text / instance-swap**, which **do not multiply** the set. A
  toggle, an editable label, a swappable icon cost zero extra variants.

This is Figma's own guidance: prioritize fewer variants and more boolean/text properties.

### Build one canonical variant, then propagate

1. **Perfect ONE cell** of the matrix completely — all paint + dimensional bindings, text styles,
   nested instances, **and** component properties.
2. **Verify it** against the component-creation checklist (run the verification script on it).
3. **Then** `clone()` it per remaining variant and rebind **only what differs** (e.g. the tone
   color, the size tokens).
4. Add set-level / non-variant properties **after** the matrix exists.

Cloning an *incomplete* canonical variant multiplies every omission across the whole set — one
missing binding becomes N missing bindings. The verify-before-clone gate is non-negotiable.
(Mechanics: build-library.md Step 3.)

### State lives in the matrix

default / hover / pressed / disabled / focus are a **State variant axis** (or interactive states),
never detached copies sitting next to the component. A library that ships only the happy-path
frame is incomplete.

### A senior rejects

- A **combinatorial variant set** where axes should have been booleans/swaps.
- Cloning before the **canonical variant is verified complete**.
- **Missing states** — only the default frame exists.
- Variant **values named for appearance** instead of role, or inconsistent casing.

---

## 4. Visual Hierarchy & Composition

The things a checklist can't catch but a senior's eye does immediately.

- **Spacing rhythm comes from the scale.** Every gap and padding is a token on the 4/8-based
  scale — no off-scale magic numbers (`13px`, `27px`). It reads intentional because it *is*
  systematic. Outer containers carry proportionally more space than inner elements (~1.4×
  per nesting level, snapped to the token grid).
- **Optical over mathematical balance.** Equal numeric padding can look wrong around glyphs,
  icons, or caps — nudge for *perceived* weight. "Centered" means *optically* centered.
- **One clear hierarchy per surface.** A dominant element, then secondary, then tertiary. Don't
  let two elements fight to be the loudest.
- **Use the type scale.** Role-named (`heading`, `body`, `caption`) via Text Styles — never an
  ad-hoc `15px`. At most **3–4 text sizes per screen**; more reads as noise.
- **Align to a grid and to each other.** Shared baselines, consistent edges. A few px of
  misalignment is the single most common amateur tell.
- **Content-first.** Realistic, domain-appropriate copy — never "Lorem ipsum". Pull actual copy
  from specs/wireframes when they exist.

### A senior rejects

- **Off-scale spacing** / magic numbers; flat spacing with no hierarchy.
- **Ad-hoc font sizes** outside the type scale; >4 sizes on one screen.
- **Misaligned edges/baselines**; mathematically-but-not-optically centered content.
- **Lorem ipsum** or placeholder gibberish in a finished screen.

---

## 5. Iconography

**A real icon component, never a text glyph.** Typing `✕`, `✓`, `→`, or `▾` as text characters is
amateur work:

- They render **inconsistently** across platforms and fonts.
- They **can't be system-recolored or resized** like a vector icon.
- They **break swapping** — there's no instance to swap.

Before drawing any glyph/icon as text **or** an ad-hoc vector, search the file for an existing
icon component (e.g. an `Icons` page) and **instance it**. If none exists, create a proper vector
icon component first. Text characters like `✕`/`✓` are **never** acceptable substitutes for a DS
icon.

- **One sizing grid** (commonly 16 / 20 / 24px) with a live area + optical padding (e.g. 14px live
  inside a 16px box). All icons on the same keyline.
- **Uniform stroke and style** — one stroke weight per size, consistent radius/terminals across
  the whole set. Mixed strokes scream amateur.
- **Color bound to a token, size to the slot** — never hardcoded.

### A senior rejects

- **Text-as-icon** (`✕`/`✓`/`→` typed as characters).
- An ad-hoc vector drawn when an **icon component already exists**.
- **Mixed stroke weights / sizes** across the icon set; hardcoded icon color.

---

## 6. The Quality Bar — What a Senior Rejects (master list)

The shared vocabulary. The **audit** workflow scores findings against this list; the build
workflows must not produce any of it.

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

When you produce a component or screen, walk this list. When you audit, cite the row number. A
green verification script plus a clean pass on this table is the senior bar.
