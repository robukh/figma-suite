# Plugin API Deltas

Load `figma-use` first (`skill://figma/figma-use/SKILL.md`). This file only records where figma-suite adds to or overrides it.
Everything the official skill already covers (return/no IIFE, 0–1 colors, read-only fills, font-load recipe, HUG/FILL rules, `createAutoLayout`/`query`/`set`, indexed traversal, error tables) is deliberately not repeated; when this file and the live official skill disagree, the live skill wins.

## Contents

- [Content slots and INSTANCE_SWAP](#content-slots-and-instance_swap)
- [Component properties](#component-properties)
- [Variables, scopes and paints](#variables-scopes-and-paints)
- [Text styles](#text-styles)
- [Sizing text that wraps](#sizing-text-that-wraps)
- [Instances, sizing and traversal gotchas](#instances-sizing-and-traversal-gotchas)
- [Unsupported or removed APIs](#unsupported-or-removed-apis)
- [Process deltas](#process-deltas)

---

## Content slots and INSTANCE_SWAP

Which kind to use is decided per region, not per component: see the table in [component-contracts.md](component-contracts.md#content-regions-slot-vs-instance_swap). The recipes in the official `figma-generate-library` do not use native Slots; we use `SLOT` for freeform regions because it models React `children`, while `figma-use` documents the Slot API itself.

```javascript
const card = figma.createComponent();
card.name = "Card";
card.layoutMode = "VERTICAL";
card.resize(320, 100);                      // resize before sizing modes: resize() resets them to FIXED
card.primaryAxisSizingMode = "AUTO";

const body = card.createSlot();             // already a child of card AND the SLOT property already exists
body.name = "Content";
body.layoutMode = "VERTICAL";
body.resize(320, 200);
const slotKey = body.componentPropertyReferences["slotContentId"];   // read the key, never guess it
```

- A new slot has a **default white solid fill** (verified on a real file). Set `slot.fills = []` right after `createSlot()`, otherwise consumers see a white box inside a tinted card.
- `createSlot()` creates the property itself; a follow-up `addComponentProperty(..., "SLOT", ...)` or `appendChild` makes a duplicate or throws. Each call yields one slot and one property.
- The only reference key for a slot is `slotContentId`, a fourth `componentPropertyReferences` key beside `characters`, `visible`, `mainComponent`. Manual wiring (rare): `addComponentProperty("Content", "SLOT", "")` (default is an empty string, not a node id), then set `slotContentId` on a frame that is a direct child of the component.
- Fill slots by `appendChild` on the slot found with `instance.findAllWithCriteria({ types: ["SLOT"] }).find(n => n.name === "Content")`. `instance.setProperties({ [slotKey]: ... })` throws because slot content is children, not a value. `slot.resetSlot()` (instances only) restores the empty default.
- If an edit right after `appendChild` throws `Internal Figma Error: Parent not found`, the handle was invalidated: re-find the child via `slot.children[slot.children.length - 1]` and edit that.
- Every slot gets `VERTICAL` or `HORIZONTAL` auto-layout, because a slot at `NONE` positions dropped content absolutely.
- `GRID` throws on slots. For a grid region keep the slot `VERTICAL` and put a `GRID` frame inside it (append first, then size; children of a canvas grid cannot be `FILL`).
- Official restrictions, all still true: no `GRID` on slots; Widgets, Stickies and ComponentNodes cannot be appended into a slot; a frame nested inside a slot cannot itself be bound to a slot property; `setProperties` on a slot key throws; `resetSlot()` is instance-only.
- Slots inside variants are undocumented. Create them on each COMPONENT before `combineAsVariants` and verify afterwards with `scripts/verify-component.js`.
- Pairing an optional slot with a `Show X` BOOLEAN is our convention; official docs never pair them, so confirm visibility toggling on a real instance before relying on it.

**INSTANCE_SWAP**: the default value must be a real component id; constrain the picker with `preferredValues` (component *keys*, not ids). Never make an icon a variant axis: one swap property covers every icon without multiplying variants.

## Component properties

**Timing, one rule.** `addComponentProperty` works on a standalone COMPONENT and on a COMPONENT_SET, and throws on a COMPONENT that is already a child of a set (`Can only get/set component property definitions of a component set or non-variant component`). So either add to each COMPONENT before `combineAsVariants` (the set inherits them), or add to the set afterwards. Pick one per component and do not mix; never reach into `set.children[i]`. `componentPropertyReferences` is set on the *child layer a property drives* and is unaffected by this.

**Never read `componentPropertyDefinitions` on a variant** for the same reason. Read from the owner:

```javascript
const owner = node.parent && node.parent.type === "COMPONENT_SET" ? node.parent : node;
const defs = owner.componentPropertyDefinitions;
```

**Keys carry a `#uid` suffix** (`Label#4:0`) that changes between files and sessions. Capture the return value inside the same script; across scripts look the key up by name in the owner's definitions. Never hardcode, persist, or guess one, because a wrong key fails silently.

**Re-running `addComponentProperty` after an interrupted call creates a duplicate** (`Label` → `Label2`), leaving an orphan next to the linked one. After any interruption read the owner's definitions first and `deleteComponentProperty` the orphan before adding again.

**Show X pairing and nested properties** (our convention):
- Optional region: a `Show X` BOOLEAN (drives `visible`) plus the property that fills it (TEXT, INSTANCE_SWAP or SLOT). Consumers toggle first, edit second.
- To bubble a nested instance's properties up to the parent, set `nestedInstance.isExposedInstance = true` on the instance inside the component (typed in the plugin API; verify on a real component). Do not recreate the child's TEXT property on the parent by hand.

**Renaming variant properties:** rename the variant children (`Property 1=` → `size=`) and let the definition follow; `editComponentProperty` is fine for TEXT/BOOLEAN but fragile for VARIANT because Figma validates child names against the current keys.

**Do not dump definitions in bulk.** Broad reads return `id`, `name`, `type` and counts only; do not return or iterate whole `componentPropertyDefinitions`, `componentProperties` or `valuesByMode` maps across many components or collections in one call. Read one component at a time and measure large returns first (`JSON.stringify(result).length`).

**IDs change at `combineAsVariants`:** re-query component ids after combining instead of reusing the ones from before.

## Variables, scopes and paints

**Scopes** are set explicitly on every variable, because the default `ALL_SCOPES` pollutes every property picker. The complete enum (anything else throws; there is no `FILL_COLOR`):

`ALL_SCOPES TEXT_CONTENT CORNER_RADIUS WIDTH_HEIGHT GAP ALL_FILLS FRAME_FILL SHAPE_FILL TEXT_FILL STROKE_COLOR STROKE_FLOAT EFFECT_FLOAT EFFECT_COLOR OPACITY FONT_FAMILY FONT_STYLE FONT_WEIGHT FONT_SIZE LINE_HEIGHT LETTER_SPACING PARAGRAPH_SPACING PARAGRAPH_INDENT`

| Token role | Scopes |
|---|---|
| Surface / background | `FRAME_FILL`, `SHAPE_FILL` |
| Text / icon color | `TEXT_FILL` (add `SHAPE_FILL` for icon glyphs) |
| Border / divider | `STROKE_COLOR` |
| Spacing / gap | `GAP` (add `WIDTH_HEIGHT` for sizing tokens) |
| Radius | `CORNER_RADIUS` |
| Opacity | `OPACITY` |
| Primitives only referenced by aliases | `[]` (hidden from pickers) |

Match the file's existing scope convention before inventing one. Duplicate variable names do not error (Figma silently creates a second one), so look up by name and collection before `createVariable`.

**Paints:** `figma.variables.setBoundVariableForPaint(paint, "color", variable)` returns a new paint; assign it back (`node.fills = [bound]`). For tinted fills (a tone at 10%, scrims, hover states) set `opacity` on the returned paint *after* binding: `bound = { ...bound, opacity: 0.1 }`. In practice a binding that lost the opacity produced a solid block instead of a tint while the binding itself looked correct, so re-applying it is the cheap guard. `setBoundVariableForEffect` and `...ForLayoutGrid` also return new objects.

**Dimensional bindings** go on the node via `setBoundVariable`, one side at a time: `paddingTop/Right/Bottom/Left`, `itemSpacing`. `cornerRadius` is not bindable even though it looks like it; bind `topLeftRadius`, `topRightRadius`, `bottomLeftRadius`, `bottomRightRadius`. Which token to pick is judgment: see [component-craft.md](component-craft.md#1-token-judgment).

**Audit reads:** mixed values can come back as a Symbol, so check `typeof node.topLeftRadius === "number"` before comparing. Optional chaining does not stop `no such property` errors; narrow by `node.type` first.

## Text styles

Bind typography variables on the **Text Style**, not on text layers. `TextStyle.setBoundVariable` accepts `fontFamily`, `fontSize`, `fontStyle`, `fontWeight`, `letterSpacing`, `lineHeight`, `paragraphSpacing`, `paragraphIndent`; the same call on a TextNode silently does nothing for font properties. A layer takes typography by `await text.setTextStyleIdAsync(style.id)`, and its color is a separate variable-bound fill (styles carry no color).

```javascript
const style = figma.createTextStyle();
style.name = "Body / Bold";
await figma.loadFontAsync({ family: "Inter", style: "Bold" });   // style string from listAvailableFontsAsync()
style.fontName = { family: "Inter", style: "Bold" };
style.setBoundVariable("fontSize", fontSizeVar);                  // prefer variables; raw values only where none exist
style.setBoundVariable("lineHeight", lineHeightVar);
```

Unbind with `style.setBoundVariable(field, null)`. Verifying typography therefore means checking `node.textStyleId` starts with `S:` and the *style's* `boundVariables`, never the node's.

## Sizing text that wraps

A new TEXT node is `WIDTH_AND_HEIGHT`, which ignores `FILL` and collapses to a thread a few pixels wide and thousands tall. Set the mode and width before the content:

```javascript
t.textAutoResize = "HEIGHT";
t.layoutSizingHorizontal = "FIXED";
t.resize(852, t.height);          // plausible width; never resize(w, 1) on an axis that should HUG
t.characters = longString;
if (t.width === 0) throw new Error("text collapsed");
```

A `resize(w, 1)` placeholder whose `HUG` then fails leaves a 1px frame that looks catastrophically broken for no visible reason.

## Instances, sizing and traversal gotchas

Found by running the design workflow on a real file; each cost an agent a failed call or a broken screenshot.

- **A child inside an instance cannot be resized** (`This property cannot be overridden in an instance: size`; some paths no-op silently). For a per-row bar width, make that cell a native `SLOT` in the component and put a plain frame in each instance's slot, or build a variant set per fixed step.
- **A library Card instance may not hug vertically** if its main component has a fixed primary axis. Set `layoutSizingVertical = "HUG"` on the instance before judging the layout.
- **`resize()` after setting `FILL` resets that axis to `FIXED`.** Resize first, then set the sizing mode; clipped button labels are the usual symptom.
- **`FILL` children inside a hugging wrapper can collapse the wrapper** (a 1440 frame came out 224px high). Make the intermediate containers `HUG` on that axis.
- **`findAll` / `findOne` skip hidden children of instances** unless `figma.skipInvisibleInstanceChildren = false`, and may return nothing inside slot content of a cloned frame. Use plain `.children` traversal and check for `null`.
- **After `INSTANCE_SWAP` the nested layer is named after the swapped component**, not the property's layer name. Take the first `INSTANCE` child instead of finding by name.
- **Removing a node while walking its subtree throws.** Collect first, remove after.
- **`constraints` cannot be overridden on an instance.**
- **`createAutoLayout()` and `createSlot()` default to a white fill.** Set `fills = []` unless white is intended; the scan reports leftovers as S22 advisories.
- **Text styles are namespaced.** Prefer the library's `heading/page`, `body/default` style names; do not detach a style to change one property, create a variant style or accept the exception (T12).
- **A paint bound to a variable plus a node `opacity`** compounds: the contrast check sees the paint, the eye sees both.

## Unsupported or removed APIs

| API | Use instead |
|---|---|
| `figma.loadAllPagesAsync()` | `figma.root.children` for page ids, then one call per page |
| `figma.teamLibrary.*` | `search_design_system` / `get_libraries` for discovery, then `importComponentByKeyAsync` / `importVariableByKeyAsync` |
| `figma.getLocalComponents*()` | `page.findAllWithCriteria({ types: ["COMPONENT", "COMPONENT_SET"] })` per page |
| `figma.createImage*()` | `upload_assets` (the only image path; `use_figma` has no network) |
| `figma.currentPage = page` | `await figma.setCurrentPageAsync(page)` |
| `figma.notify()` | `return` the message |
| `getPluginData` / `setPluginData` | Keep a ledger of returned ids (see Process deltas); do not store workflow state on Figma objects |
| `figma.createPage()` in FigJam or Slides | Design files only; create pages in a Design file |

## Process deltas

- **Build one canonical variant fully, verify it, then clone and rebind only what differs.** Bindings, auto-layout, text styles and properties get checked once instead of once per variant, and an error found late costs one fix instead of N.
- **Batch retry-safe work; do not split for checkpoints.** Splitting working operations into extra calls only adds round trips. A whole page may be one call. Split at a page-context boundary, where partial execution would be hard to recover, or for a targeted retry after a failure.
- **After an error, obey `safeToRetryWithoutCanvasRead`.** `true`: fix the script and retry. `false`: read the canvas first, because some of the script may have applied.
- **One `setCurrentPageAsync` per script.** Multi-page reads fan out as parallel calls, one per page. Multi-page writes run sequentially, because later pages often depend on ids and placement from earlier ones.
- **Keep a ledger instead of tagging nodes.** Return created and mutated ids from every call and carry them forward as string literals; store no workflow state on Figma objects.
- **Visual checks:** one screenshot after composition and one after a visual fix, not after every operation.
