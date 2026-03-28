# Figma Plugin API Implementation Rules

These rules encode correct Plugin API usage patterns for `use_figma` MCP calls. Violating them produces components that look right in screenshots but are broken for consumers — or causes silent failures that are hard to debug.

Based on the [official Figma MCP server guide](https://github.com/figma/mcp-server-guide/tree/main/skills/figma-use).

---

## Pre-Flight Checklist

Verify **before every** `use_figma` call:

- [ ] Code uses `return` to send data back (NOT `console.log()` or `figma.closePlugin()`)
- [ ] Code is NOT wrapped in an async IIFE (auto-wrapped for you)
- [ ] `return` value includes ALL created/mutated node IDs
- [ ] No usage of `figma.notify()` (throws "not implemented")
- [ ] No usage of `getPluginData()`/`setPluginData()` (not supported — use `getSharedPluginData()`)
- [ ] All colors use 0–1 range (not 0–255)
- [ ] Fills/strokes are reassigned as new arrays (not mutated in place)
- [ ] Page switches use `await figma.setCurrentPageAsync(page)` (sync setter throws)
- [ ] `layoutSizingVertical/Horizontal = 'FILL'` is set AFTER `parent.appendChild(child)`
- [ ] `loadFontAsync()` called BEFORE any text property changes
- [ ] `lineHeight`/`letterSpacing` use `{value, unit}` format (not bare numbers)
- [ ] `resize()` is called BEFORE setting sizing modes (resize resets them to FIXED)
- [ ] New top-level nodes are positioned away from (0,0)
- [ ] ALL created/mutated node IDs are collected and returned
- [ ] Every async call is `await`ed — no fire-and-forget Promises
- [ ] Variable `scopes` are set explicitly (not left as `ALL_SCOPES`)

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

**To iterate all pages:**
```javascript
for (const page of figma.root.children) {
  await figma.setCurrentPageAsync(page);
  // page.children is now loaded — read or modify them here
}
```

---

## Unsupported APIs

These throw errors in `use_figma` headless runtime:

| API | Error | Alternative |
|-----|-------|-------------|
| `figma.notify()` | "not implemented" | Use `return` for output |
| `figma.currentPage = page` (sync setter) | "not supported" | `await figma.setCurrentPageAsync(page)` |
| `getPluginData()` / `setPluginData()` | Not supported | `getSharedPluginData()` / `setSharedPluginData()` with namespace |
| `TextStyle.setBoundVariable()` | "not a function" in headless | Set raw values on the style; bind variables interactively in Figma UI later |

### TextStyle.setBoundVariable Limitation

**`setBoundVariable` on TextStyle objects does NOT work in headless `use_figma`.** When creating text styles, set raw values instead:

```javascript
// This works — raw values
const style = figma.createTextStyle();
style.name = "Body / Bold";
await figma.loadFontAsync({ family: "Inter", style: "Bold" });
style.fontName = { family: "Inter", style: "Bold" };
style.fontSize = 17;
style.lineHeight = { unit: "PIXELS", value: 26 };
style.letterSpacing = { value: 0, unit: "PERCENT" };

// This FAILS in headless — throws "not a function"
// style.setBoundVariable("fontSize", fontSizeVar);

// Apply the style to text nodes — this DOES work
await textNode.setTextStyleIdAsync(style.id);
```

Variable binding on text styles must be done interactively in the Figma UI after the automated build, or the text style values will simply use their raw values (which is fine for most use cases).

---

## Incremental Workflow

The most common cause of bugs is trying to do too much in a single `use_figma` call. **Work in small steps and validate after each one.**

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
| `"not a function"` on TextStyle | `setBoundVariable` unsupported in headless | Set raw values instead |

---

## Sizing: Hug Contents vs Fixed

**`resize()` resets BOTH sizing modes to FIXED.** Always call `resize()` BEFORE setting sizing modes, not after.

```javascript
// WRONG — resize overwrites the HUG you just set
comp.layoutSizingVertical = "HUG";
comp.resize(320, 100); // resets vertical to FIXED!

// CORRECT — resize first, then set modes
comp.resize(320, 1); // width matters, height is throwaway
comp.layoutSizingHorizontal = "FIXED";
comp.layoutSizingVertical = "HUG";
```

**Rule:** `layoutSizingHorizontal/Vertical = 'FILL'` MUST be set AFTER `parent.appendChild(child)` — setting before append throws.

**Rule:** A `HUG` parent cannot give `FILL` children meaningful space. Parent must be `FIXED` or `FILL` for children to expand.

**Rule:** `counterAxisAlignItems` does NOT accept `'STRETCH'`. Use `'MIN'` and set children to `layoutSizingX = 'FILL'` on the cross axis instead.

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

### Font Style Probing

Font style names vary by provider and file ("SemiBold" vs "Semi Bold"). **Probe available styles** before hardcoding:

```javascript
const candidates = ["Bold", "SemiBold", "Semi Bold", "700"];
let loadedStyle = null;
for (const style of candidates) {
  try {
    await figma.loadFontAsync({ family: "Inter", style });
    loadedStyle = style;
    break;
  } catch {}
}
if (!loadedStyle) throw new Error("No bold variant found for Inter");
```

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

**Fills/strokes are read-only arrays** — clone, modify, reassign:
```javascript
// WRONG — mutation has no effect
node.fills[0].color = { r: 1, g: 0, b: 0 };

// CORRECT — reassign entire array
node.fills = [{ type: "SOLID", color: { r: 1, g: 0, b: 0 } }];
```

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

### Variable Collection Default Mode

New collections start with one default mode named **"Mode 1"**. Rename it — don't try to add a first mode:

```javascript
const collection = figma.variables.createVariableCollection("Semantic");
// Collection already has modes[0] = "Mode 1"
collection.renameMode(collection.modes[0].modeId, "Light");
// Now add additional modes
collection.addMode("Dark");
```

### Variable Modes on Components

Components do NOT automatically use non-default variable modes. All nodes default to the collection's first mode. To render a component in a specific mode (e.g., Dark), you MUST set it explicitly:

```javascript
comp.setExplicitVariableModeForCollection(collectionId, darkModeId);
```

Without this call, dark mode variants and alternative themes will render using the default (Light) mode values, even if the variable has Dark mode values defined.

---

## Font Property Binding Limitation

**`fontSize`, `fontWeight`, and `lineHeight` are NOT bindable via `setBoundVariable()` on text nodes.** Attempting this silently fails — the binding appears to succeed but has no effect.

Typography MUST be applied through **Text Styles** (`setTextStyleIdAsync`). Text Styles carry font family, size, weight, and line height as a single unit. See the Text Style Application section above.

Additionally, **`TextStyle.setBoundVariable()` does NOT work in headless `use_figma`** (throws "not a function"). Create Text Styles with raw values; variable binding on styles must be done interactively in the Figma UI.

---

## Node Positioning

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

**Add component properties BEFORE `combineAsVariants`.** After combining, the component set inherits all properties from its children.

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

`editComponentProperty` may fail in some cases. Renaming children directly is the reliable approach.

---

## Instance Swap Slots (NOT Empty Frames)

**Content slots must be real INSTANCE_SWAP component properties, not empty frames.**

```javascript
// Create placeholder component for default slot value
const placeholder = figma.createComponent();
placeholder.name = "_Slot Placeholder";
placeholder.resize(100, 40);
placeholder.fills = [];

// Instance it inside the parent
const slot = placeholder.createInstance();
parent.appendChild(slot);
slot.layoutSizingHorizontal = "FILL";

// Register as INSTANCE_SWAP property
const slotKey = parent.addComponentProperty("Content", "INSTANCE_SWAP", placeholder.id);
slot.componentPropertyReferences = { mainComponent: slotKey };
```

---

## Component Composition via Instances

**Composite components MUST nest instances of already-built components.** Never rebuild a component from scratch when it already exists.

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

## Slots vs INSTANCE_SWAP (API Limitation)

Figma's native **Slots** feature cannot be created via the Plugin API (no `createSlot()` method, SLOT type rejected by `componentPropertyReferences`). Use INSTANCE_SWAP as the workaround. After the automated build, users can convert to native Slots in the Figma UI.

*(Last verified: 2026-03-25 against Figma Plugin API)*

---

## Safe Property Access in Audits

When reading `boundVariables`, `fills`, `strokes`, or other mixed-type properties, some values may be Symbols or unexpected types:

```javascript
// WRONG — may throw "cannot convert symbol to number"
if (variant.cornerRadius > 0) { ... }

// CORRECT — check type first
if (typeof variant.topLeftRadius === "number" && variant.topLeftRadius > 0) { ... }
```

---

## Known API Constraints

- `letter-spacing` cannot be bound to variables — apply as raw value
- `combineAsVariants` needs manual grid layout — variants stack at (0,0)
- `combineAsVariants` requires `ComponentNode` inputs — not frames
- Keep `use_figma` scripts under ~200 lines — split larger operations
- Sequential `use_figma` calls only — never parallelize
- `resize()` resets both sizing modes to FIXED — call it before setting modes
- `layoutSizingHorizontal = "FILL"` can only be set AFTER `appendChild`
- Font loading (`loadFontAsync`) must happen BEFORE setting `fontName` or `characters`
- `editComponentProperty` for variant properties may fail — rename children directly
- `setBoundVariable` on fills/strokes must use `setBoundVariableForPaint`
- `setBoundVariable` on TextStyle objects does NOT work in headless `use_figma`
- `fontSize`, `fontWeight`, `lineHeight` are NOT bindable via `setBoundVariable` on text nodes — use Text Styles
- Component property keys have `#uid` suffixes (e.g., `"Label#4:0"`) — never hardcode, always capture from `addComponentProperty`
- Components don't auto-use non-default variable modes — must call `setExplicitVariableModeForCollection`
- `figma.notify()` throws "not implemented" — use `return`
- `getPluginData()`/`setPluginData()` not supported — use `getSharedPluginData()`
- `counterAxisAlignItems` does not accept `'STRETCH'` — use `'MIN'` + child `FILL`
- Only `SOLID` paint type supports variable binding — gradients/images throw
- Sections don't auto-resize — call `resizeWithoutConstraints()` after adding content
- Variable scopes default to `ALL_SCOPES` — always set explicitly
- New variable collections start with "Mode 1" — rename it, don't add a first mode
- `detachInstance()` may invalidate ancestor node IDs — re-discover by traversal
