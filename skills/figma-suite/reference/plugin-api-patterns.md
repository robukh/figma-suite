# Figma Plugin API Implementation Rules

These rules encode correct Plugin API usage patterns for `use_figma` MCP calls. Violating them produces components that look right in screenshots but are broken for consumers — or causes silent failures that are hard to debug.

Aligned against the official Figma skills. **The authoritative source is the live MCP resource** — the GitHub mirror can lag. Read these before assuming this file is current:

| Topic | Resource URI |
|---|---|
| Core rules, efficient APIs, page rules | `skill://figma/figma-use/SKILL.md` |
| Components, variants, **slots**, instances | `skill://figma/figma-use/references/component-patterns.md` |
| Gotchas and failure modes | `skill://figma/figma-use/references/gotchas.md` |
| Variables, collections, modes, scopes | `skill://figma/figma-use/references/variable-patterns.md` |
| Text styles + variable binding on styles | `skill://figma/figma-use/references/working-with-design-systems/wwds-text-styles.md` |
| Supported / unsupported API surface | `skill://figma/figma-use/references/api-reference.md` |

Mirror: [figma/mcp-server-guide](https://github.com/figma/mcp-server-guide/tree/main/skills/figma-use). Where the official docs contradict each other (component-property timing, `teamLibrary` support), this file says so explicitly rather than picking silently.

The terse master list of every constraint is **[Known API Constraints](#known-api-constraints)** at the bottom — scan it before each `use_figma` call. The sections below explain each in full.

---

## Return Values (Critical)

**Always use `return` to send data back from `use_figma` — never `console.log()`.**

`console.log()` output is silently discarded. Only the `return` value is sent back. The return value is JSON-serialized automatically (objects, arrays, strings, numbers).

```javascript
// WRONG — returns nothing
console.log(JSON.stringify(result));

// WRONG — not needed, handled for you
figma.closePlugin();

// CORRECT — returns data
return { createdNodeIds: [frame.id], count: 5 };
```

**Rule: Return ALL created/mutated node IDs.** Every script that creates or mutates nodes must return their IDs so subsequent calls can reference them:
```javascript
return { createdNodeIds: [...ids], mutatedNodeIds: [...ids] };
```

For large results, split into multiple targeted `use_figma` calls rather than returning everything at once.

---

## Script Environment

**Scripts are auto-wrapped in an async context.** Write plain JavaScript with top-level `await` and `return`. Do NOT wrap code in `(async () => { ... })()`.

```javascript
// WRONG — double-wrapped, may cause issues
(async () => {
  const pages = figma.root.children;
  return pages;
})();

// CORRECT — plain top-level code
const pages = figma.root.children;
return pages.map(p => ({ id: p.id, name: p.name }));
```

---

## Page Context Rules (Critical)

**Page context resets between `use_figma` calls** — `figma.currentPage` always starts on the **first page** at the beginning of each call.

```javascript
// Switch to a specific page (loads its content)
const targetPage = figma.root.children.find(p => p.name === "My Page");
await figma.setCurrentPageAsync(targetPage);
// targetPage.children is now populated

// WRONG — sync setter throws in use_figma
figma.currentPage = targetPage; // Error!
```

**If your workflow spans multiple `use_figma` calls** and targets a non-default page, call `await figma.setCurrentPageAsync(page)` at the start of **each** call.

### One page switch per script — fan out, never loop

**A single script must call `setCurrentPageAsync` at most once.** Looping over `figma.root.children` and switching pages inside the loop reloads the file on every iteration and is the top cause of slow, timing-out scripts.

```javascript
// WRONG — switches pages N times in one script
for (const page of figma.root.children) {
  await figma.setCurrentPageAsync(page);
  // ...
}

// CORRECT — step 1: cheap read-only discovery call, no page switch
return figma.root.children.map(p => ({ id: p.id, name: p.name }));
```

Then **step 2: emit N `use_figma` calls, one per target page, each switching once.** For read-only work these go out **in parallel — all N tool calls in a single message.** For writes they stay strictly sequential (see below).

```javascript
// One of the N calls — switches exactly once
const page = await figma.getNodeByIdAsync("PAGE_ID");
await figma.setCurrentPageAsync(page);
return page.findAllWithCriteria({ types: ["COMPONENT_SET"] }).map(n => ({ id: n.id, name: n.name }));
```

**Reads fan out; writes do not.** Multi-page *discovery* should be parallel. Multi-page *mutation* must remain one call at a time — see [SKILL.md § Sequential Figma writes; parallel reads](../SKILL.md#sequential-figma-writes-parallel-reads). The only reason to switch pages twice in one script is a genuine atomicity requirement; "it's read-only" and "I want a consistent snapshot" do not qualify.

---

## Unsupported APIs

These throw errors in `use_figma` headless runtime:

| API | Error | Alternative |
|-----|-------|-------------|
| `figma.notify()` | "not implemented" | Use `return` for output |
| `figma.currentPage = page` (sync setter) | "not supported" | `await figma.setCurrentPageAsync(page)` |
| `getPluginData()` / `setPluginData()` | Not supported | `getSharedPluginData()` / `setSharedPluginData()` with namespace |
| `figma.loadAllPagesAsync()` | Not implemented | Enumerate `figma.root.children` and fan out one call per page |
| `figma.createImage()` / `createImageAsync()` | Unsupported, being removed | `upload_assets` — the only supported image path (`use_figma` has no network access) |
| `figma.getLocalComponents*()` | Does not exist | `page.findAllWithCriteria({ types: ["COMPONENT", "COMPONENT_SET"] })` |
| `figma.teamLibrary.*` | Unreliable / not implemented | `importVariableByKeyAsync` / `importComponentByKeyAsync` |
| `figma.createPage()` | Design files only | Throws in FigJam and Slides |

### Variable Binding on Text Styles — bind the STYLE, not the TextNode

This is a two-level rule that is easy to get backwards:

| Target | `setBoundVariable` | Do this |
|---|---|---|
| **TextStyle** | ✅ **Works — and is preferred** | Bind `fontFamily`, `fontSize`, `fontStyle`, `fontWeight`, `letterSpacing`, `lineHeight`, `paragraphSpacing`, `paragraphIndent` |
| **TextNode** | ❌ `fontSize`/`fontWeight`/`lineHeight` are not bindable | Apply a Text Style with `setTextStyleIdAsync()` |

```javascript
const style = figma.createTextStyle();
style.name = "Body / Bold";
await figma.loadFontAsync({ family: "Inter", style: "Bold" });
style.fontName = { family: "Inter", style: "Bold" };

// PREFERRED — bind to variables where they exist
style.setBoundVariable("fontSize", fontSizeVar);
style.setBoundVariable("lineHeight", lineHeightVar);
style.setBoundVariable("letterSpacing", trackingVar);

// Fallback only where no variable exists — raw values
style.fontSize = 17;
style.lineHeight = { unit: "PIXELS", value: 26 };

// Apply to nodes
await textNode.setTextStyleIdAsync(style.id);
```

Unbind with `style.setBoundVariable(field, null)`. Setting `textStyleId` on a node does **not** require the font to be loaded — only editing text content or font properties directly does.

---

## Efficient APIs — prefer these over verbose alternatives

The `use_figma` sandbox exposes helpers that are not in the vanilla Plugin API. They cut script size sharply, which matters against the per-call operation budget.

**`figma.createAutoLayout(direction?, props?)`** — **prefer over `createFrame()`** for any container holding related children:

```javascript
const row = figma.createAutoLayout("HORIZONTAL", { itemSpacing: 8, paddingLeft: 16 });
```

**`node.set(props)`** — batch setter, chainable. `layoutMode` is always applied first regardless of key order, and `width`/`height` route through `resize()`:

```javascript
card.set({ layoutMode: "VERTICAL", itemSpacing: 12, width: 320, cornerRadius: 8 });
```

**`node.query(selector)`** — CSS-like search within a subtree, with combinators (`>`, ` `, `+`, `~`), pseudo-classes (`:first-child`, `:nth-child(n)`, `:not()`, `:is()`), and dot-path attributes:

```javascript
frame.query("FRAME > TEXT[fills.0.type=SOLID]").set({ opacity: 0.6 });
figma.currentPage.query("INSTANCE[mainComponent.name=Button]").first();
```

`QueryResult` supports `.first() .last() .toArray() .each() .map() .filter() .values(keys) .set(props) .query()` and `for...of`. There is **no global `figma.query()`** — scope it to a node.

**`await node.screenshot(opts?)`** — returns a PNG inline in the tool response. Cheaper than a separate `get_screenshot` round-trip for mid-build checks. Defaults to 0.5× capped at 1024px.

**`node.placeholder`** — shimmer overlay during a long build. **Always clear it when done.**

---

## Traversal and Performance

**Use `findAllWithCriteria({ types: [...] })` — not `findAll(predicate)`.** The criteria API is index-backed and hundreds of times faster. When the predicate mixes type with a non-indexed attribute, use criteria for the type and `.find()`/`.filter()` for the rest:

```javascript
// WRONG — walks every node
const slot = instance.findOne(n => n.type === "SLOT" && n.name === "Content");

// CORRECT — type-indexed, then narrow
const slot = instance.findAllWithCriteria({ types: ["SLOT"] }).find(n => n.name === "Content");
```

`types` is an array — pass all the types you need in one call rather than issuing several. *Caveat:* if you would have to list ~10+ types just to use criteria, plain `findAll(() => true)` is shorter and equivalently fast on a screen-sized subtree.

**Scope traversal to the smallest known ancestor.**

| Call | Cost |
|---|---|
| `someFrame.findAllWithCriteria(...)` | one frame's subtree |
| `figma.currentPage.findAllWithCriteria(...)` | one page |
| `figma.root.findAll(...)` | **every loaded page — never do this** |

**Batch independent awaits with `Promise.all`.** Sequential `import*ByKeyAsync` calls at the top of a script, and per-variable loads inside a loop, are the common offenders:

```javascript
// WRONG — one IPC round-trip per item
for (const key of keys) { comps.push(await figma.importComponentByKeyAsync(key)); }

// CORRECT
const comps = await Promise.all(keys.map(k => figma.importComponentByKeyAsync(k)));
```

The only awaits that must stay sequential are `setCurrentPageAsync` and genuine per-iteration dependencies.

---

## Incremental Workflow

The most common cause of bugs is trying to do too much in a single `use_figma` call. **Work in small steps and validate after each one.**

**At most ~10 logical operations per call.** A "logical operation" is creating a node, setting its properties, and parenting it. Creating 20 nodes means splitting across 2–3 calls.

1. **Inspect first** — run a read-only `use_figma` to discover what exists (pages, components, variables, naming conventions)
2. **Do one thing per call** — create variables in one call, components in the next, layouts in another
3. **Return IDs from every call** — always return created node/variable/collection IDs
4. **Validate after each step** — use `get_metadata` for structure, `get_screenshot` for visuals
5. **Fix before moving on** — don't build on a broken foundation

### Validation guide

| After... | Check with `get_metadata` | Check with `get_screenshot` |
|---|---|---|
| Creating variables | Collection count, variable count, mode names | — |
| Creating components | Child count, variant names, property definitions | Variants visible, grid readable |
| Binding variables | Node properties reflect bindings | Colors/tokens resolved correctly |
| Composing layouts | Instance nodes, hierarchy | No clipped text, no overlap, correct spacing |

---

## Error Recovery

**`use_figma` is atomic — failed scripts do NOT execute.** If a script errors, no changes are made to the file. The file remains in the exact state before the call. This means:

- No partial nodes or orphaned elements from failed scripts
- Safe to retry after fixing the script
- No cleanup needed after errors

### When `use_figma` returns an error

1. **STOP.** Do NOT immediately retry the same script.
2. **Read the error message carefully.** Understand what went wrong.
3. **If unclear**, call `get_metadata` or `get_screenshot` to understand current file state.
4. **Fix the script** based on the error.
5. **Retry** the corrected script.

### Common errors

| Error message | Cause | Fix |
|---|---|---|
| `"not implemented"` | Used `figma.notify()` | Remove it — use `return` |
| `"node must be an auto-layout frame..."` | Set `FILL`/`HUG` before `appendChild` | Append first, then set sizing |
| `"Setting figma.currentPage is not supported"` | Used sync page setter | `await figma.setCurrentPageAsync(page)` |
| Color value out of range | Used 0–255 instead of 0–1 | Divide by 255 |
| `"Cannot read properties of null"` | Wrong node ID or wrong page | Check page context, verify ID |
| `"fills and strokes variable bindings must be set on paints directly"` | Used `setBoundVariable` on node | Use `setBoundVariableForPaint` on paint object |
| `"not a function"` / silent no-op binding a font prop | Called `setBoundVariable` on the **TextNode** | Bind on the **TextStyle**, then `setTextStyleIdAsync()` |

---

## Sizing: Hug Contents vs Fixed

**`resize()` resets BOTH sizing modes to FIXED.** Always call `resize()` BEFORE setting sizing modes, not after.

```javascript
// WRONG — resize overwrites the HUG you just set
comp.layoutSizingVertical = "HUG";
comp.resize(320, 100); // resets vertical to FIXED!

// CORRECT — resize first, then set modes
comp.resize(320, 100);
comp.layoutSizingHorizontal = "FIXED";
comp.layoutSizingVertical = "HUG";
```

**Never pass a throwaway value (`1`, `0`) to `resize()` on an axis you intend to HUG.** If the `HUG` then fails to apply — a very common outcome, see the value rules below — you are left with a 1px-tall frame and a layout that looks catastrophically broken for a non-obvious reason. Pass a plausible height; `HUG` will recompute it.

### `HUG` and `FILL` are value-restricted — `FIXED` always works

The property exists on every `SceneNode`; what fails is the *value*.

| Value | Allowed when | Typical error |
|---|---|---|
| `'FIXED'` | always | never throws |
| `'HUG'` | the node **is** an auto-layout frame, **or** is a **TEXT** child of one | `"HUG can only be set on auto-layout frames or text children of auto-layout frames"` |
| `'FILL'` | the node is a child of an auto-layout frame, and is not absolute-positioned, not inside an immutable frame, not a canvas-grid child | `"FILL can only be set on children of auto-layout frames"` |

Consequences:
- **Append first, then set.** A newly created or unparented node cannot satisfy the rule yet.
- **`'HUG'` on a non-text child of auto-layout still throws.** To shrink a non-text child to its content, set its own `primaryAxisSizingMode`/`counterAxisSizingMode` to `'AUTO'` instead.

### Don't cross the two sizing enums

| Property | Valid values | Set on |
|---|---|---|
| `layoutSizingHorizontal` / `layoutSizingVertical` | `'FIXED' \| 'HUG' \| 'FILL'` | the **child** (or the auto-layout frame itself) |
| `primaryAxisSizingMode` / `counterAxisSizingMode` | `'FIXED' \| 'AUTO'` | the **frame** itself |

`layoutSizingVertical = 'AUTO'` is invalid (use `'HUG'`); `counterAxisSizingMode = 'FILL'` throws `Expected 'FIXED' | 'AUTO', received 'FILL'`.

### Other sizing rules

- `layoutSizingHorizontal/Vertical = 'FILL'` MUST be set AFTER `parent.appendChild(child)`.
- A `HUG` parent cannot give `FILL` children meaningful space — the parent must be `FIXED` or `FILL`. This is a frequent cause of truncated text in inputs, selects, and action rows.
- `layoutGrow` on a child of a hugging parent **compresses** it below its natural size instead of expanding it.
- `counterAxisAlignItems` does NOT accept `'STRETCH'`. Use `'MIN'` plus `layoutSizing* = 'FILL'` on the children.
- `width` and `height` are **read-only** — assigning throws `"no setter for property"`. Use `resize()`. (`x` and `y` *are* writable.)
- Sections and component sets: use `resizeWithoutConstraints()`.

### Wrapping text collapses under `FILL`

A TEXT node defaults to `textAutoResize = 'WIDTH_AND_HEIGHT'`, which **ignores `FILL`** — the node collapses to a few pixels wide and thousands tall (a "text thread").

```javascript
// CORRECT — set autoresize and an explicit width BEFORE assigning characters
t.textAutoResize = "HEIGHT";      // grow vertically, wrap at a fixed width
t.layoutSizingHorizontal = "FIXED";
t.resize(852, t.height);          // e.g. parent 900 − 24 padding × 2
t.characters = longString;
if (t.width === 0) throw new Error("text collapsed — width not applied");
```

---

## Text Style Application

**Use `setTextStyleIdAsync()` to apply text styles to nodes.** This works in headless.

```javascript
// 1. Load the font FIRST
await figma.loadFontAsync({ family: "Inter", style: "Bold" });

// 2. Create text
const text = figma.createText();
text.fontName = { family: "Inter", style: "Bold" };
text.characters = "Button";

// 3. Apply the Text Style
await text.setTextStyleIdAsync(textStyleId);

// 4. Set fill color separately (text styles don't include color)
const colorPaint = figma.variables.setBoundVariableForPaint(
  figma.util.solidPaint("#18181b"), "color", foregroundVar
);
text.fills = [colorPaint];
```

**`lineHeight` and `letterSpacing` require `{value, unit}` objects** — never bare numbers:
```javascript
// WRONG — bare number, will fail
style.lineHeight = 24;

// CORRECT — structured object
style.lineHeight = { value: 24, unit: "PIXELS" };
style.letterSpacing = { value: 0, unit: "PERCENT" };
// Or auto line height:
style.lineHeight = { unit: "AUTO" };
```

### Font Style Discovery — list, never probe

Font style names vary by provider and file (`"SemiBold"` vs `"Semi Bold"` is the classic footgun). **Discover the exact string with `listAvailableFontsAsync()`** — do not probe with try/catch:

```javascript
// CORRECT — query the real list once, then match
const fonts = await figma.listAvailableFontsAsync();
const interStyles = fonts
  .filter(f => f.fontName.family === "Inter")
  .map(f => f.fontName.style);

const bold = ["Bold", "SemiBold", "Semi Bold"].find(s => interStyles.includes(s));
if (!bold) throw new Error(`No bold variant for Inter. Available: ${interStyles.join(", ")}`);
await figma.loadFontAsync({ family: "Inter", style: bold });

// WRONG — try/catch probing: slow, and swallows real errors
// for (const s of candidates) { try { await figma.loadFontAsync(...) } catch {} }
```

When **mutating existing** text, load the node's own fonts rather than a hardcoded default:

```javascript
const segments = textNode.getStyledTextSegments(["fontName"]);
await Promise.all(segments.map(s => figma.loadFontAsync(s.fontName)));
```

Font loading is required for more than `characters` — `appendChild`, `insertChild`, `setBoundVariable`, `setValueForMode`, `setExplicitVariableModeForCollection`, and `findAll` callbacks that touch text all throw on unloaded fonts. Inter is preloaded in most environments, so this bug usually surfaces first with a brand font.

---

## Variable Binding on Paints (Fills and Strokes)

**Only `SOLID` paint type supports color variable binding.** Gradients and image paints will throw.

`setBoundVariableForPaint` returns a **NEW** paint object — must capture and reassign:

```javascript
// WRONG — throws error
node.setBoundVariable("fills", 0, "color", colorVar);

// CORRECT — bind on paint, then assign
const paint = figma.variables.setBoundVariableForPaint(
  figma.util.solidPaint("#ffffff"), "color", colorVar
);
node.fills = [paint]; // reassign the entire array

// Same for strokes
const strokePaint = figma.variables.setBoundVariableForPaint(
  figma.util.solidPaint("#d4d4d8"), "color", borderVar
);
node.strokes = [strokePaint];
```

**GOTCHA: `setBoundVariableForPaint` returns a NEW paint and DROPS the input paint's `opacity` field.** For a tinted fill (a tone color at, say, 10% — alert backgrounds, hover states, scrims), set `opacity` AFTER binding, then reassign. Binding first wipes it:

```javascript
// Tinted fill: danger tone @ 10%
let paint = figma.variables.setBoundVariableForPaint(
  figma.util.solidPaint("#e7000b"), "color", dangerVar
);
paint = { ...paint, opacity: 0.1 };   // ← re-apply on the RETURNED paint; binding wiped it
node.fills = [paint];
```

Forgetting this produces a solid color block instead of a tint — a common, hard-to-spot bug because the binding itself succeeds.

**Fills/strokes are read-only arrays** — clone, modify, reassign:
```javascript
// WRONG — mutation has no effect
node.fills[0].color = { r: 1, g: 0, b: 0 };

// CORRECT — reassign entire array
node.fills = [{ type: "SOLID", color: { r: 1, g: 0, b: 0 } }];
```

---

## Binding Dimensional Variables (padding / gap / radius)

Color binds on the *paint* (above). Dimensional values (padding, gap, radius) bind on the **node**
via `setBoundVariable` — a different API surface. Float variables only.

```javascript
// Padding — bind each side individually (there is no shorthand)
node.setBoundVariable("paddingLeft", spacing4Var);
node.setBoundVariable("paddingRight", spacing4Var);
node.setBoundVariable("paddingTop", spacing3Var);
node.setBoundVariable("paddingBottom", spacing3Var);

// Gap (auto-layout)
node.setBoundVariable("itemSpacing", spacing3Var);
```

**Radius is per-corner — `cornerRadius` is NOT bindable.** The `cornerRadius` shorthand looks
bindable but isn't; bind the four corner properties individually:

```javascript
node.setBoundVariable("topLeftRadius", radiusXlVar);
node.setBoundVariable("topRightRadius", radiusXlVar);
node.setBoundVariable("bottomLeftRadius", radiusXlVar);
node.setBoundVariable("bottomRightRadius", radiusXlVar);
```

This is the API reference. The *rule* to bind every dimensional property (and to pick the
semantically-correct spacing token, not just the pixel match) lives in [component-contracts.md](component-contracts.md#variable-binding-checklist) and [design-judgment.md §1](design-judgment.md#1-token-judgment).

---

## Variable Scopes

**Variables default to `ALL_SCOPES` — this pollutes every property picker.** Always set scopes explicitly:

```javascript
const bgColor = figma.variables.createVariable("background", collection, "COLOR");
bgColor.scopes = ["FRAME_FILL", "SHAPE_FILL"]; // only in fill pickers

const textColor = figma.variables.createVariable("foreground", collection, "COLOR");
textColor.scopes = ["TEXT_FILL"]; // only in text color pickers

const spacing = figma.variables.createVariable("spacing-4", collection, "FLOAT");
spacing.scopes = ["GAP", "WIDTH_HEIGHT"]; // gap and size pickers

const radius = figma.variables.createVariable("radius-lg", collection, "FLOAT");
radius.scopes = ["CORNER_RADIUS"];
```

**The complete valid scope enum.** Anything outside this list throws — notably there is no `FILL_COLOR`:

```
ALL_SCOPES
TEXT_CONTENT
CORNER_RADIUS      WIDTH_HEIGHT      GAP
ALL_FILLS          FRAME_FILL        SHAPE_FILL       TEXT_FILL
STROKE_COLOR       STROKE_FLOAT
EFFECT_FLOAT       EFFECT_COLOR      OPACITY
FONT_FAMILY        FONT_STYLE        FONT_WEIGHT      FONT_SIZE
LINE_HEIGHT        LETTER_SPACING    PARAGRAPH_SPACING PARAGRAPH_INDENT
```

Match the file's existing scope conventions before inventing your own — check what local variables already use.

### Variable Collection Default Mode

New collections start with one default mode named **"Mode 1"**. Rename it — don't try to add a first mode:

```javascript
const collection = figma.variables.createVariableCollection("Semantic");
// Collection already has modes[0] = "Mode 1"
collection.renameMode(collection.modes[0].modeId, "Light");
// Now add additional modes
collection.addMode("Dark");
```

Never leave a mode named `"Mode 1"`. Single-mode collections use `"Value"` or `"Default"`; multi-mode collections take their names from the source (`Light`/`Dark`, `Desktop`/`Tablet`/`Mobile`).

**Mode limits are plan-dependent** — exceeding them throws or fails silently:

| Plan | Modes per collection |
|---|---|
| Free | 1 (no `addMode`) |
| Professional | up to 4 |
| Organization / Enterprise | 40+ |

If a token set needs more modes than the plan allows, split it across multiple collections.

### Duplicate variable names do NOT error

Figma silently creates a **second variable with the same name**. Always check before creating:

```javascript
const existing = (await figma.variables.getLocalVariablesAsync())
  .find(v => v.name === name && v.variableCollectionId === collection.id);
const variable = existing ?? figma.variables.createVariable(name, collection, "COLOR");
```

### Aliasing rules

`setValueForMode` requires the alias shape exactly — any deviation silently sets the wrong value or throws:

```javascript
semanticVar.setValueForMode(modeId, { type: "VARIABLE_ALIAS", id: primitiveVar.id });
```

**Cross-file aliasing is not supported.** To alias a library variable, `importVariableByKeyAsync` it into the file first. A variable with `remote === true` came from a library; `remote === false` is local.

**COLOR variable values use `{r, g, b, a}`** — but paint `color` objects must be `{r, g, b}` with **no** `a` (paint opacity goes at the paint level). Mixing them up throws `Unrecognized key(s) in object: 'a'`.

### Async and deprecated forms

- All sync variable getters are deprecated — use `getVariableByIdAsync`, `getLocalVariablesAsync`, `getVariableCollectionByIdAsync`, `getLocalVariableCollectionsAsync`.
- `getLocalTextStyles()` is deprecated — use `getLocalTextStylesAsync()`.
- `createVariable(name, collection, type)` — pass the **collection object**; the ID-string form is deprecated.
- `setBoundVariableForEffect` and `setBoundVariableForLayoutGrid` return **new** objects, exactly like `setBoundVariableForPaint` — capture and reassign.
- Shadows cannot be variables. Use effect styles (`figma.createEffectStyle()`), then bind the effect's `color`/`radius`/`spread`/`offsetX`/`offsetY` fields.

### Variable Modes on Components

Components do NOT automatically use non-default variable modes. All nodes default to the collection's first mode. To render a component in a specific mode (e.g., Dark), you MUST set it explicitly:

```javascript
comp.setExplicitVariableModeForCollection(collectionId, darkModeId);
```

Without this call, dark mode variants and alternative themes will render using the default (Light) mode values, even if the variable has Dark mode values defined.

---

## Font Property Binding on TextNodes

**`fontSize`, `fontWeight`, and `lineHeight` are NOT bindable via `setBoundVariable()` on a text *node*.** Attempting this silently fails — the binding appears to succeed but has no effect.

Typography is applied through **Text Styles** (`setTextStyleIdAsync`), which carry family, size, weight, and line height as a single unit. Bind the variables on the **style** — that *does* work and is preferred. See [§ Variable Binding on Text Styles](#variable-binding-on-text-styles--bind-the-style-not-the-textnode).

---

## Node Positioning and Auto-Layout

**Use auto-layout for any container holding structurally related children.** Absolute `x`/`y` governs where a container sits on the canvas; auto-layout governs how its children relate inside it. Skipping the container leaves nothing to protect the layout against text reflow, content changes, or overlap.

```javascript
// WRONG — children pinned by absolute coordinates
const card = figma.createFrame();
title.x = 16; title.y = 16;
body.x = 16;  body.y = 48;

// CORRECT — children related by auto-layout
const card = figma.createAutoLayout("VERTICAL", { itemSpacing: 12, paddingTop: 16 });
card.appendChild(title);
card.appendChild(body);
```

**New top-level nodes default to position (0,0).** Multiple nodes created via `figma.create*()` will stack on top of each other. Scan the page and position new nodes away from existing content:

```javascript
// Position new node to the right of existing content
const existingNodes = figma.currentPage.children;
let maxX = 0;
for (const node of existingNodes) {
  maxX = Math.max(maxX, node.x + node.width);
}
newNode.x = maxX + 100; // 100px gap
newNode.y = 0;
```

This only applies to **page-level nodes**. Nodes nested inside frames or auto-layout containers are positioned by their parent.

---

## Component Property Keys Are Dynamic

`addComponentProperty()` returns a dynamically generated string key (e.g., `"label#4:0"`). **Never hardcode or guess this key — always capture the return value:**

```javascript
// CORRECT — capture the key
const labelKey = comp.addComponentProperty("Label", "TEXT", "Button");
const showIconKey = comp.addComponentProperty("Show Icon", "BOOLEAN", true);
const iconSlotKey = comp.addComponentProperty("Icon", "INSTANCE_SWAP", iconComp.id);

// Link properties to child nodes
textNode.componentPropertyReferences = { characters: labelKey };
iconInstance.componentPropertyReferences = {
  visible: showIconKey,
  mainComponent: iconSlotKey
};
```

### Component Property Timing: before or after `combineAsVariants`

**Both paths work. The one hard constraint is that a variant already inside a set rejects them.**

```
comp.addComponentProperty(...)          → OK on a standalone COMPONENT
componentSet.addComponentProperty(...)  → OK on a COMPONENT_SET
variant.addComponentProperty(...)       → THROWS
```

The error: `"Can only get/set component property definitions of a component set or non-variant component"`. The same applies to reading `componentPropertyDefinitions`.

So pick one:

- **Before combining** — add properties to each `ComponentNode` while it is still standalone; the set inherits them from its children. (This is what official `figma-use` prescribes.)
- **After combining** — add properties to the `ComponentSetNode` itself, then wire `componentPropertyReferences` on the child nodes inside each variant. (This is what official `figma-generate-library` prescribes, and what our [build-library](../workflows/build-library.md) Phase 3 does.)

What you must never do is reach into `componentSet.children[i]` and call `addComponentProperty` on it. Note that `componentPropertyReferences` is set on the **child node** that the property drives — that is a different API and works on nodes inside a variant.

### Re-running `addComponentProperty` after an interruption creates a duplicate

If an `addComponentProperty` call is interrupted or partially applied and you re-run it, Figma does **not** overwrite — it auto-suffixes a duplicate (`"Label"` → `"Label2"`). You end up with an orphan property the consumer sees and a linked one that works (or vice versa).

**After any interrupted property-adding call, inspect and clean up before re-adding:**

```javascript
// Discover what's actually there
const defs = comp.componentPropertyDefinitions;
// e.g. { "Label#4:0": {...}, "Label2#7:1": {...} }  ← the 2nd is an orphan

// Delete the orphan, then re-add cleanly
comp.deleteComponentProperty("Label2#7:1");
```

Never blindly re-run `addComponentProperty` after a failure — inspect `componentPropertyDefinitions` first.

---

## Variant Layout After `combineAsVariants`

After `combineAsVariants`, all children stack at (0,0). **You must position them in a grid** or the component set appears as a single collapsed element:

```javascript
const cs = figma.combineAsVariants(components, figma.currentPage);
cs.name = "Button";

// Position in a grid
const colWidth = 200;
const rowHeight = 80;
cs.children.forEach((child, i) => {
  child.x = (i % 4) * colWidth; // 4 columns
  child.y = Math.floor(i / 4) * rowHeight;
});

// Resize the ComponentSet to fit its children
let maxX = 0, maxY = 0;
for (const child of cs.children) {
  maxX = Math.max(maxX, child.x + child.width);
  maxY = Math.max(maxY, child.y + child.height);
}
cs.resizeWithoutConstraints(maxX + 40, maxY + 40);
```

**`combineAsVariants` requires ComponentNodes** — passing FrameNodes throws.

---

## Renaming Variant Properties

**Always rename variant component names BEFORE renaming variant property definitions.** Figma validates that all variant names use the current property keys.

```javascript
// CORRECT order — rename children first
for (const child of btnSet.children) {
  child.name = child.name.replace("Property 1=", "size=");
}
// Property definition auto-updates to match
```

**Scope note:** `editComponentProperty` **works** for TEXT and BOOLEAN property name edits — use it freely there. It's specifically **variant**-property renames that are fragile (Figma validates variant names against the current property keys), so for those, rename the variant children directly as shown above rather than calling `editComponentProperty`.

---

## Content Slots: native SLOT — NOT empty frames

**Content regions must be real component properties, not empty frames.** A native slot is a `SlotNode` (type `'SLOT'`) plus a `SLOT`-typed component property — a designated drop zone where consumers place arbitrary content in instances.

Which kind to use for which region: [component-contracts.md § Content regions](component-contracts.md#content-regions-slot-vs-instance_swap) is the canonical decision table. In short — freeform region → `SLOT`; a *specific* swappable child component → `INSTANCE_SWAP`.

### Preferred — `component.createSlot()`

`createSlot()` creates the SlotNode **as a direct child of the component** and **auto-creates the linked `SLOT` component property**. There is no `appendChild` and no `addComponentProperty` to follow it.

```javascript
const card = figma.createComponent();
card.name = "Card";
card.layoutMode = "VERTICAL";
card.primaryAxisSizingMode = "AUTO";
card.counterAxisSizingMode = "FIXED";
card.resize(320, 100);

const contentSlot = card.createSlot();   // SlotNode, already parented
contentSlot.name = "Content";
contentSlot.layoutMode = "VERTICAL";     // GRID is NOT allowed on slots
contentSlot.resize(320, 200);            // resize BEFORE sizing modes

// The auto-created property key lives on the slot's own references
const slotKey = contentSlot.componentPropertyReferences["slotContentId"];  // "Content#7:1"
```

Each `createSlot()` call produces a separate slot and its own property:

```javascript
const header = card.createSlot(); header.name = "Header";
const body   = card.createSlot(); body.name   = "Content";
const footer = card.createSlot(); footer.name = "Footer";

return Object.keys(card.componentPropertyDefinitions);
// → ["Header#7:1", "Content#7:2", "Footer#7:3"]
```

**Always give a slot auto-layout.** A slot is a layout container: set `layoutMode` (`VERTICAL`/`HORIZONTAL`), call `resize()` before setting sizing modes, and set `FILL`/`HUG` only once it is parented (it already is, straight out of `createSlot()`). A slot left at `layoutMode: "NONE"` positions whatever a consumer drops in absolutely, which defeats the point.

**`GRID` is rejected on a slot node — this is an API restriction, not a style preference.** Figma throws; there is no design context in which it works. When a region genuinely needs grid arrangement, nest the grid rather than making the slot itself one:

```javascript
// WRONG — throws
const gallery = card.createSlot();
gallery.layoutMode = "GRID";

// CORRECT — slot stays VERTICAL, a GRID frame lives inside it
const gallery = card.createSlot();
gallery.name = "Gallery";
gallery.layoutMode = "VERTICAL";
gallery.layoutSizingHorizontal = "FILL";

const grid = figma.createFrame();
grid.layoutMode = "GRID";
gallery.appendChild(grid);
grid.layoutSizingHorizontal = "FILL";   // after append
```

The consumer still fills the slot; the grid frame is the default content they arrange into. Note that `layoutSizing* = 'FILL'` is rejected on canvas-grid children, so size grid children with `FIXED` or let the grid track govern them.

Map native slots to `kind: "slot"` in the component's `component-mappings/{id}.json`.

### Manual binding — `addComponentProperty` + `slotContentId`

Binds an ordinary frame to a `SLOT` property. The default value is an **empty string**, not a node id.

```javascript
const slotKey = component.addComponentProperty("Content", "SLOT", "");
const slotFrame = figma.createFrame();
component.appendChild(slotFrame);   // must be a direct child, not nested inside another slot
slotFrame.componentPropertyReferences = { slotContentId: slotKey };
```

`slotContentId` is a fourth valid `componentPropertyReferences` key alongside `characters` (TEXT), `visible` (BOOLEAN), and `mainComponent` (INSTANCE_SWAP).

### Filling and reading slots in instances

Slot content is set by **appending children** — never through `setProperties`.

```javascript
const instance = card.createInstance();
figma.currentPage.appendChild(instance);

// Type-indexed lookup, then narrow by name (see § Traversal and Performance)
const contentSlot = instance
  .findAllWithCriteria({ types: ["SLOT"] })
  .find(n => n.name === "Content");

contentSlot.appendChild(someFrame);
```

If a post-append edit throws `"Internal Figma Error: Parent not found"`, the original handle was invalidated — re-find the child through the slot and edit the fresh handle:

```javascript
const appended = contentSlot.children[contentSlot.children.length - 1];
appended.someProperty = ...;
```

### Slot restrictions

- `GRID` layoutMode is not allowed on slot nodes
- Widgets, Stickies, and ComponentNodes cannot be appended directly to a slot
- Frames nested inside another slot cannot themselves be bound to a slot property
- `instance.setProperties({ [slotKey]: ... })` **throws** — append children instead
- `slotNode.resetSlot()` (instance-only) reverts the slot to its default empty state
- Slots inside variant sets are undocumented — `createSlot()` is only ever documented on a `ComponentNode`. If you need slots on a variant set, create them on each component *before* `combineAsVariants` and verify the result.

### INSTANCE_SWAP (specific swappable child)

Use when consumers should swap a *specific* component — an icon, an avatar — rather than author freeform content:

```javascript
// Default value must be a real, existing component ID
const iconKey = parent.addComponentProperty("Icon", "INSTANCE_SWAP", iconComponent.id);

const iconInstance = iconComponent.createInstance();
parent.appendChild(iconInstance);
iconInstance.componentPropertyReferences = { mainComponent: iconKey };
```

Constrain the picker with `preferredValues` (component *keys*, not ids):

```javascript
parent.editComponentProperty(iconKey, {
  preferredValues: [
    { type: "COMPONENT", key: chevronRight.key },
    { type: "COMPONENT", key: close.key },
  ],
});
```

Never add an icon as a variant axis — one `INSTANCE_SWAP` property covers every icon and avoids combinatorial explosion.

---

## Component Composition via Instances

**Composite components MUST nest instances of already-built components.** Never rebuild a component from scratch when it already exists — and that includes icons: instance an existing icon component, never draw a glyph or hand-vector one that already exists. See [design-judgment.md §2](design-judgment.md#2-component-anatomy) and [§5](design-judgment.md#5-iconography) for the craft behind reuse.

```javascript
const buttonComponent = await figma.getNodeByIdAsync("BUTTON_ID");
const btnInstance = buttonComponent.createInstance();
btnInstance.setProperties({ "variant": "primary", "size": "md" });
dialog.appendChild(btnInstance);
```

**After `combineAsVariants`, component IDs change.** Always re-query IDs after combining.

---

## `detachInstance()` Invalidates Ancestor IDs

When `detachInstance()` is called on a nested instance, the **parent instance may also get implicitly detached** with a **new ID**. Cached parent IDs become invalid.

```javascript
// WRONG — parent ID becomes null after child detach
const parentId = parentInstance.id;
nestedChild.detachInstance();
const parent = await figma.getNodeByIdAsync(parentId); // null!

// CORRECT — re-discover by traversal from a stable frame
const stableFrame = await figma.getNodeByIdAsync(frameId);
nestedChild.detachInstance();
const parent = stableFrame.findOne(n => n.name === "ParentName");
```

---

## Safe Property Access in Audits

When reading `boundVariables`, `fills`, `strokes`, or other mixed-type properties, some values may be Symbols or unexpected types:

```javascript
// WRONG — may throw "cannot convert symbol to number"
if (variant.cornerRadius > 0) { ... }

// CORRECT — check type first
if (typeof variant.topLeftRadius === "number" && variant.topLeftRadius > 0) { ... }
```

**Reading a member that doesn't exist on that node type throws** `TypeError: node.X: no such property 'X' on Y node` — and **optional chaining does not defend against it**: the property access happens before `?.` is evaluated, so `node.children?.length` still throws on a TEXT node. Guard with a type check or `"children" in node`.

Notable absences: `children` / `appendChild` / `findAll*` are missing from `TEXT, RECTANGLE, VECTOR, ELLIPSE, LINE, STAR, POLYGON, SLICE`; `layoutMode` and padding exist only on `FRAME, COMPONENT, COMPONENT_SET, INSTANCE`; `fills`/`strokes` are absent from `GROUP`, `PAGE`, `DOCUMENT`; `createInstance` is `COMPONENT`-only.

**Writing** a non-existent property throws something different — `"Cannot add property X, object is not extensible"`. A plausible-sounding name that isn't real (`strokeDashes` instead of `dashPattern`) will always fail; verify against the typings rather than guessing.

---

## Icons: import SVG, never reconstruct

Build icons with `figma.createNodeFromSvg()`. Never assemble them from rotated line primitives — `node.rotation` pivots around the node's origin, not its center, so segments drift and the icon renders broken (a chevron collapses into a blob).

The SVG string must carry a `viewBox` **plus explicit `width`/`height`**. Without the dimensions the node falls back to the viewBox size, which is usually smaller than its container and reads as "the icon didn't size properly."

---

## Known API Constraints

The master pre-flight list — scan before every `use_figma` call. Each is explained in full in the sections above.

- Use `return` to send data back (NOT `console.log()` or `figma.closePlugin()`) — and `return` ALL created/mutated node IDs
- Do NOT wrap code in an async IIFE — it is auto-wrapped for you
- `await` every async call — no fire-and-forget Promises
- Colors use 0–1 range (not 0–255)
- Fills/strokes are reassigned as new arrays — never mutated in place
- Page switches use `await figma.setCurrentPageAsync(page)` — the sync setter throws
- **At most ONE `setCurrentPageAsync` per script** — fan multi-page work out as N calls, one per page
- Multi-page **reads** go out in parallel (all N tool calls in one message); **writes** stay strictly sequential
- Position new top-level nodes away from (0,0) — they stack otherwise
- Use `figma.createAutoLayout()` for containers of related children — not `createFrame()` + absolute x/y
- `combineAsVariants` needs manual grid layout — variants stack at (0,0)
- `combineAsVariants` requires `ComponentNode` inputs — not frames
- **At most ~10 logical operations per `use_figma` call** — split larger operations
- `resize()` resets both sizing modes to FIXED — call it before setting modes, and never with a throwaway `1`
- `layoutSizingHorizontal = "FILL"` can only be set AFTER `appendChild`
- `'HUG'` is only valid on an auto-layout frame or a TEXT child of one; `'AUTO'` is not a `layoutSizing*` value
- A HUG parent collapses its FILL children — parent must be FIXED or FILL
- Wrapping TEXT needs `textAutoResize = 'HEIGHT'` + FIXED width + `resize()` **before** `characters` — plain FILL collapses it
- `width`/`height` are read-only — use `resize()` (`x`/`y` are writable)
- Font loading (`loadFontAsync`) must happen BEFORE setting `fontName` or `characters`
- Discover font style names with `listAvailableFontsAsync()` — never guess, never try/catch probe
- `lineHeight`/`letterSpacing` need `{value, unit}` objects — bare numbers throw
- `editComponentProperty` for variant properties may fail — rename children directly
- `setBoundVariable` on fills/strokes must use `setBoundVariableForPaint`
- `setBoundVariableForPaint` DROPS the input paint's `opacity` — re-apply it on the returned paint (`paint = { ...paint, opacity }`) for tinted fills
- `setBoundVariableForEffect` / `ForLayoutGrid` also return NEW objects — capture and reassign
- `cornerRadius` shorthand is NOT bindable — bind `topLeftRadius`/`topRightRadius`/`bottomLeftRadius`/`bottomRightRadius` individually
- Re-running `addComponentProperty` after an interrupted call auto-suffixes a duplicate (`Label2`) — inspect `componentPropertyDefinitions` and `deleteComponentProperty` orphans before re-adding
- `addComponentProperty` throws on a variant already inside a set — add before `combineAsVariants`, or to the set after
- **`TextStyle.setBoundVariable()` WORKS and is preferred** — it's the TextNode that can't bind `fontSize`/`fontWeight`/`lineHeight`
- Component property keys have `#uid` suffixes (e.g., `"Label#4:0"`) — never hardcode, always capture
- SLOT properties: `createSlot()` auto-creates them; the manual default is `""`; the reference key is `slotContentId`
- Slot content is set by `appendChild` — `setProperties` on a slot key throws; `GRID` layoutMode is rejected on slots
- Components don't auto-use non-default variable modes — must call `setExplicitVariableModeForCollection`
- `figma.notify()` throws "not implemented" — use `return`
- `getPluginData()`/`setPluginData()` not supported — use `getSharedPluginData()`
- `figma.loadAllPagesAsync()`, `figma.teamLibrary.*`, `figma.getLocalComponents*()` are not implemented
- `figma.createImage*()` is unsupported and being removed — `upload_assets` is the only image path (no network in `use_figma`)
- `figma.createPage()` is Design-files-only — throws in FigJam and Slides
- `counterAxisAlignItems` does not accept `'STRETCH'` — use `'MIN'` + child `FILL`
- Only `SOLID` paint type supports variable binding — gradients/images throw
- Paint `color` takes `{r,g,b}` with no `a`; COLOR **variable values** take `{r,g,b,a}`
- Sections don't auto-resize — call `resizeWithoutConstraints()` after adding content
- Variable scopes default to `ALL_SCOPES` — always set explicitly; there is no `FILL_COLOR` scope
- New variable collections start with "Mode 1" — rename it, don't add a first mode
- Mode limits are plan-dependent (Free 1 / Pro 4 / Org 40+)
- Duplicate variable names do NOT error — check by name before creating
- Cross-file variable aliasing is unsupported — import the library variable first
- Prefer `findAllWithCriteria({types})` over `findAll(predicate)`; **never** `figma.root.findAll()`
- Batch independent awaits with `Promise.all` — especially `import*ByKeyAsync`
- Optional chaining does NOT prevent `"no such property"` — the access throws before `?.` evaluates
- `detachInstance()` may invalidate ancestor node IDs — re-discover by traversal
