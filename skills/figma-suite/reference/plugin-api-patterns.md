# Figma Plugin API Implementation Rules

These rules encode correct Plugin API usage patterns. Violating them produces components that look right in screenshots but are broken for consumers.

---

## Return Values (Critical)

**Always use `return` to send data back from `use_figma` — never `console.log()`.**

`console.log()` output is silently discarded by the MCP server. Only the `return` value is sent back. This is the #1 cause of "Code executed with no return value" errors.

```javascript
// WRONG — returns nothing
console.log(JSON.stringify(result));

// CORRECT — returns data to Claude
return JSON.stringify(result);
```

For large results, split into multiple targeted `use_figma` calls rather than returning everything at once.

---

## Sizing: Hug Contents vs Fixed

**Never call `resize(width, height)` on an axis that should hug.**

The `resize()` method sets FIXED dimensions. If a component should hug its content vertically:

```javascript
// WRONG — sets fixed height of 10, then AUTO may not override
comp.resize(320, 10);
comp.primaryAxisSizingMode = "AUTO";

// CORRECT — set fixed width, then explicitly hug height
comp.layoutMode = "VERTICAL";
comp.resize(320, 1); // width matters, height is throwaway
comp.primaryAxisSizingMode = "AUTO"; // hug height (primary = vertical)
comp.counterAxisSizingMode = "FIXED"; // fixed width (counter = horizontal)

// ALSO CORRECT — use layoutSizing shorthands after auto-layout is set
comp.layoutSizingHorizontal = "FIXED";
comp.layoutSizingVertical = "HUG";
```

**Rule:** For components with dynamic height (Card, Dialog, BottomSheet, EmptyState, Toast, Input multiline), ALWAYS use `layoutSizingVertical = "HUG"`. Only call `resize()` for the fixed axis. For fully hug components (Button), use `layoutSizingHorizontal = "HUG"` and `layoutSizingVertical = "HUG"`.

**Rule:** Children that should stretch to parent width must have `layoutSizingHorizontal = "FILL"` set AFTER being appended to the auto-layout parent.

---

## Text Style Application (Preferred over Individual Variable Binding)

**Use Figma Text Styles, NOT individual variable bindings for typography.**

Text Styles bundle font family, size, weight, and line height into a single reusable style. When a Text Style has variables bound to it, applying the style to a text node automatically applies all variable bindings.

```javascript
// 1. Load the font FIRST
await figma.loadFontAsync({ family: "Inter", style: "Bold" });

// 2. Create text, set static font (required for characters)
const text = figma.createText();
text.fontName = { family: "Inter", style: "Bold" };
text.characters = "Button";

// 3. Apply the Text Style — this binds ALL typography variables at once
await text.setTextStyleIdAsync(textStyleId);

// 4. Set fill color separately (text styles don't include color)
text.fills = [paint(colorVar)];
```

**Rule:** Always use `setTextStyleIdAsync()` — never set font properties individually per text layer. This ensures consistent typography AND proper variable binding in one call.

**Rule:** Text Styles should be created once during token sync (or setup), with all 4 typography variables bound to the style itself:
```javascript
const style = figma.createTextStyle();
style.name = "Body / Bold";
style.fontName = { family: "Inter", style: "Bold" };
style.fontSize = 17;
style.lineHeight = { unit: "PIXELS", value: 26 };
style.setBoundVariable("fontFamily", fontFamilyVar);
style.setBoundVariable("fontSize", fontSizeVar);
style.setBoundVariable("fontWeight", fontWeightVar);
style.setBoundVariable("lineHeight", lineHeightVar);
```

**Rule:** Before building components, query existing text styles with `figma.getLocalTextStylesAsync()`. Create missing weight variants (e.g., "Body / Bold", "Label / Medium") if they don't exist.

**Rule:** Text color is NOT part of Text Styles — always set `text.fills` separately using semantic color variables.

---

## Instance Swap Slots (NOT Empty Frames)

**Content slots must be real INSTANCE_SWAP component properties, not empty frames.**

Empty frames labeled "Content Slot" are NOT slots — consumers cannot swap content into them. Use the Plugin API's `addComponentProperty` method:

```javascript
// 1. Create a small placeholder component for the default slot value
const placeholder = figma.createComponent();
placeholder.name = "_Slot Placeholder";
placeholder.resize(100, 40);
placeholder.fills = [];

// 2. Create the parent component
const card = figma.createComponent();
card.name = "Card";
// ... set up auto-layout, fills, padding, radius ...

// 3. Create an instance of the placeholder inside the parent
const slotInstance = placeholder.createInstance();
slotInstance.name = "Content";
card.appendChild(slotInstance);
slotInstance.layoutSizingHorizontal = "FILL";

// 4. Add INSTANCE_SWAP property pointing to the placeholder
card.addComponentProperty("Content", "INSTANCE_SWAP", placeholder.id);
```

Now consumers can swap the "Content" slot for any other component instance.

**For optional slots** (e.g., EmptyState CTA), pair with a boolean:
```javascript
comp.addComponentProperty("Show CTA", "BOOLEAN", true);
comp.addComponentProperty("CTA", "INSTANCE_SWAP", buttonComponent.id);
```

**For text that consumers should edit**, use TEXT properties:
```javascript
comp.addComponentProperty("Title", "TEXT", "Dialog title");
// Then link the text layer to this property via componentPropertyReferences
textLayer.componentPropertyReferences = { characters: "Title#..." };
```

---

## Component Composition via Instances

**Composite components MUST nest instances of already-built components.**

When Dialog needs action buttons, it should contain instances of the Button component — NOT raw frames styled to look like buttons:

```javascript
// WRONG — rebuilding a button from scratch
const btn = figma.createFrame();
btn.fills = [paint(accent)];
btn.cornerRadius = 12;
// ... manually recreating Button styling ...

// CORRECT — instantiate the existing Button component
const buttonComponent = figma.getNodeById("BUTTON_COMPONENT_ID");
const btnInstance = buttonComponent.createInstance();
// Set the instance's variant properties
btnInstance.setProperties({ "Variant": "Primary", "Size": "Medium" });
dialog.appendChild(btnInstance);
```

**Rule:** Build components in strict tier order. Before building Dialog, Button must already exist and its component ID must be known.

**Rule:** After combining variants with `combineAsVariants`, the individual component IDs change. Always re-query component IDs after combining.

---

## Slots vs INSTANCE_SWAP (API Limitation)

Figma's native **Slots** feature (Schema 2025, open beta) is superior to INSTANCE_SWAP for content areas — slots accept any layer type (text, images, groups, multiple objects), not just component instances. However:

- `"SLOT"` is a valid `ComponentPropertyType` — `addComponentProperty("name", "SLOT", "")` creates the property definition
- **But there is no way to convert a frame into a SlotNode via the Plugin API** — no `createSlot()` method, and `componentPropertyReferences` explicitly rejects SLOT properties
- The only way to create functional slots is via the **Figma UI**: right-click a frame → "Convert to slot" (Ctrl+Shift+S)

**Current approach:** Use `INSTANCE_SWAP` with placeholder components for content slots (Card, Dialog, BottomSheet). After the automated library build, the user can optionally convert these to native Slots manually in Figma.

**When to revisit:** If Figma adds `figma.createSlot()` or allows SLOT in `componentPropertyReferences`, switch to native Slots.

*(Last verified: 2026-03-25 against Figma Plugin API)*

---

## Variable Binding on Paints (Fills and Strokes)

**Never use `setBoundVariable("fills", ...)` or `setBoundVariable("strokes", ...)` directly on a node.** Fills and strokes require binding on the paint object itself, not the node.

```javascript
// WRONG — throws "fills and strokes variable bindings must be set on paints directly"
node.setBoundVariable("fills", 0, "color", colorVar);

// CORRECT — create a paint with the variable bound, then assign it
const paint = figma.variables.setBoundVariableForPaint(
  figma.util.solidPaint("#ffffff"), "color", colorVar
);
node.fills = [paint];
node.strokes = [strokePaint]; // same pattern for strokes
```

---

## Renaming Variant Properties

**Always rename variant component names BEFORE renaming variant property definitions.** Figma validates that all variant names use the current property keys. If you rename the property first, existing variant names become invalid.

```javascript
// WRONG order — editComponentProperty fails because children still reference old name
btnSet.editComponentProperty("Property 1", { name: "size" });

// CORRECT order:
// 1. Rename all variant children first
for (const child of btnSet.children) {
  child.name = child.name.replace("Property 1=", "size=");
}
// 2. Now the property definition auto-updates to match
```

Note: `editComponentProperty` may still fail in some cases. Renaming children directly is the reliable approach — Figma infers property names from the `key=value` pattern in variant names.

---

## Safe Property Access in Audits

When reading `boundVariables`, `fills`, `strokes`, or other mixed-type properties, some values may be Symbols or unexpected types. Always use safe checks:

```javascript
// WRONG — may throw "cannot convert symbol to number"
if (variant.cornerRadius > 0 && !boundVars.topLeftRadius) { ... }

// CORRECT — check type and existence first
if (variant.topLeftRadius !== undefined && typeof variant.topLeftRadius === "number"
    && variant.topLeftRadius > 0 && !bv.topLeftRadius) { ... }
```

---

## Known API Constraints

- `letter-spacing` cannot be bound to variables — apply as raw value
- `combineAsVariants` needs manual grid layout after — arrange in a matrix
- `fullWidth` / `iconOnly` cannot drive layout switching automatically — use boolean property to toggle visibility
- Keep `use_figma` Plugin API scripts under ~200 lines — split larger operations into multiple calls
- Sequential `use_figma` calls only — never parallelize
- `resize()` on a HUG axis gets overridden — only use it for FIXED axes
- `layoutSizingHorizontal = "FILL"` can only be set AFTER the node is appended to an auto-layout parent
- Font loading (`loadFontAsync`) must happen BEFORE setting `fontName` or `characters`
- `editComponentProperty` for variant properties may fail — rename variant children directly instead
- `setBoundVariable` on fills/strokes must use `setBoundVariableForPaint` on the paint object
