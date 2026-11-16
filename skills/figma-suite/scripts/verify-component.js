// Read-only component check. Paste as the use_figma script body; returns a JSON report:
//   reports[].results[] = { rule, status: "pass" | "fail" | "n/a", actual, failures[] }, reports[].slots[] = per-slot detail.
// Present it as a rule / status / actual table (component-contracts.md#verification).

const NODE_IDS = ["COMPONENT_OR_SET_ID"];       // COMPONENT_SET ids, or standalone COMPONENT ids
const REQUIRED_STYLE_FIELDS = ["fontSize", "lineHeight"];   // must be bound on every Text Style used
const MAX_FAILURES_PER_RULE = 8;                // caps report size

const RULES = [
  "Fill bound to variable",
  "Stroke bound to variable",
  "Corner radius bound",
  "Padding bound",
  "Gap bound",
  "Typography via Text Style",
  "Text Style typography bound",
  "Text fill bound",
  "TEXT layer linked to TEXT property",
  "INSTANCE linked to INSTANCE_SWAP",
  "Slot linked via slotContentId",
  "Slot has auto-layout",
  "Slot is not GRID",
  "Declared SLOT property resolves to a live SlotNode (every variant)",
  "Declared property drives a layer",
];
const CORNERS = ["topLeftRadius", "topRightRadius", "bottomRightRadius", "bottomLeftRadius"];
const SIDES = ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"];

const refsOf = (n) => (("componentPropertyReferences" in n && n.componentPropertyReferences) || {});
const boundOf = (n) => (("boundVariables" in n && n.boundVariables) || {});
const isAutoLayout = (n) => "layoutMode" in n && n.layoutMode && n.layoutMode !== "NONE";
const solidPaints = (paints) =>
  Array.isArray(paints) ? paints.filter((p) => p.type === "SOLID" && p.visible !== false) : [];
const boundCount = (arr) => (Array.isArray(arr) ? arr.filter(Boolean).length : 0);

const reports = [];
let loadedPageId = null;

for (const id of NODE_IDS) {
  const root = await figma.getNodeByIdAsync(id);
  if (!root) { reports.push({ nodeId: id, error: "Node not found" }); continue; }
  // pages load lazily
  let pg = root.parent;
  while (pg && pg.type !== "PAGE") pg = pg.parent;
  if (pg) {
    if (loadedPageId && loadedPageId !== pg.id) { reports.push({ nodeId: id, name: root.name, error: "Node is on a different page than the first ID; run it in a separate call" }); continue; }
    if (!loadedPageId) { await figma.setCurrentPageAsync(pg); loadedPageId = pg.id; }
  }
  if (root.type !== "COMPONENT" && root.type !== "COMPONENT_SET") {
    reports.push({ nodeId: id, name: root.name, error: `Expected COMPONENT or COMPONENT_SET, got ${root.type}` });
    continue;
  }

  // componentPropertyDefinitions throws on a variant: read it only from `owner` (the set, or a standalone component)
  const owner = root.type === "COMPONENT" && root.parent && root.parent.type === "COMPONENT_SET" ? root.parent : root;
  const variants = root.type === "COMPONENT_SET" ? root.children.filter((c) => c.type === "COMPONENT") : [root];
  const allVariants = owner.type === "COMPONENT_SET" ? owner.children.filter((c) => c.type === "COMPONENT") : [owner];

  const rules = {};
  for (const r of RULES) rules[r] = { rule: r, total: 0, ok: 0, failures: [] };
  const check = (rule, pass, where) => {
    const r = rules[rule];
    r.total++;
    if (pass) r.ok++; else r.failures.push(where);
  };

  const slots = [];
  const textStyleIds = new Set();

  // nested instances are not entered: they inherit from their main component
  const walk = (node, variant, inSlot) => {
    const where = `${variant.name} / ${node.name}`;
    const bv = boundOf(node);
    const refs = refsOf(node);

    if (node.type === "TEXT") {
      const styleId = node.textStyleId;
      const styled = typeof styleId === "string" && styleId.startsWith("S:");
      check("Typography via Text Style", styled, where);
      if (styled) textStyleIds.add(styleId);
      check("Text fill bound", boundCount(bv.fills) > 0, where);
      if (!inSlot) check("TEXT layer linked to TEXT property", !!refs.characters, where);
    } else if (node.type === "INSTANCE") {
      if (!inSlot) check("INSTANCE linked to INSTANCE_SWAP", !!refs.mainComponent, where);
      return;
    } else {
      if ("fills" in node) {
        const solid = solidPaints(node.fills).length;
        if (solid > 0) check("Fill bound to variable", boundCount(bv.fills) >= solid, where);
      }
      if ("strokes" in node) {
        const solid = solidPaints(node.strokes).length;
        if (solid > 0) check("Stroke bound to variable", boundCount(bv.strokes) >= solid, where);
      }
      if ("topLeftRadius" in node) {
        for (const c of CORNERS) {
          if (typeof node[c] === "number" && node[c] > 0) check("Corner radius bound", !!bv[c], `${where} (${c})`);
        }
      }
      if (isAutoLayout(node)) {
        for (const s of SIDES) {
          if (typeof node[s] === "number" && node[s] > 0) check("Padding bound", !!bv[s], `${where} (${s})`);
        }
        if (typeof node.itemSpacing === "number" && node.itemSpacing > 0) {
          check("Gap bound", !!bv.itemSpacing, where);
        }
      }
    }

    if (node.type === "SLOT") {
      const wired = !!refs.slotContentId;
      slots.push({ variant: variant.name, slot: node.name, wired, layoutMode: node.layoutMode });
      check("Slot linked via slotContentId", wired, where);
      check("Slot has auto-layout", node.layoutMode === "HORIZONTAL" || node.layoutMode === "VERTICAL", where);
      check("Slot is not GRID", node.layoutMode !== "GRID", where);
    }

    if ("children" in node) {
      for (const child of node.children) walk(child, variant, inSlot || node.type === "SLOT");
    }
  };

  for (const v of variants) walk(v, v, false);

  // typography is bound on the Text Style, not on TextNodes
  for (const sid of textStyleIds) {
    let style = null;
    try { style = await figma.getStyleByIdAsync(sid); } catch (e) { }
    const bound = style && style.boundVariables ? Object.keys(style.boundVariables) : [];
    const missing = REQUIRED_STYLE_FIELDS.filter((f) => !bound.includes(f));
    check("Text Style typography bound", !!style && missing.length === 0,
      style ? `${style.name}: unbound ${missing.join(", ")}` : `${sid}: style not readable`);
  }

  // declared properties must drive a layer
  const defs = owner.componentPropertyDefinitions;
  const referenced = new Set();
  const slotKeysByVariant = new Map();
  for (const v of allVariants) {
    for (const n of v.findAll((x) => "componentPropertyReferences" in x)) {
      for (const key of Object.values(refsOf(n))) referenced.add(key);
    }
    slotKeysByVariant.set(v.name, new Set(
      v.findAllWithCriteria({ types: ["SLOT"] }).map((s) => refsOf(s).slotContentId).filter(Boolean)));
  }
  for (const [key, def] of Object.entries(defs)) {
    if (def.type === "VARIANT") continue;
    if (def.type === "SLOT") {
      for (const [variantName, keys] of slotKeysByVariant) {
        check("Declared SLOT property resolves to a live SlotNode (every variant)", keys.has(key), `${variantName}: "${key}"`);
      }
    } else {
      check("Declared property drives a layer", referenced.has(key), `"${key}" (${def.type}) is not referenced by any layer`);
    }
  }

  const results = RULES.map((r) => {
    const x = rules[r];
    const status = x.total === 0 ? "n/a" : x.failures.length === 0 ? "pass" : "fail";
    return {
      rule: r,
      status,
      actual: x.total === 0 ? "nothing to check" : `${x.ok}/${x.total} ok`,
      failures: x.failures.slice(0, MAX_FAILURES_PER_RULE),
      moreFailures: Math.max(0, x.failures.length - MAX_FAILURES_PER_RULE),
    };
  });

  reports.push({
    nodeId: root.id,
    name: root.name,
    type: root.type,
    propertyOwnerId: owner.id,
    variantsChecked: variants.length,
    failedRules: results.filter((r) => r.status === "fail").map((r) => r.rule),
    results,
    slots,
  });
}

return { reports };
