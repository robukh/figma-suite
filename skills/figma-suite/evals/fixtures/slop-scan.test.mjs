// slop-scan against a mock Figma node tree. SCAN_FILE=slop-scan.min.js tests the minified build.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const scanFile = process.env.SCAN_FILE || "slop-scan.js";
const source = readFileSync(join(here, "../../scripts", scanFile), "utf8");
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

let seq = 0;
const registry = new Map();
function node(type, props = {}, children) {
  const n = { type, id: `9:${++seq}`, name: type, visible: true, width: 100, height: 40, x: 0, y: 0, fills: [], strokes: [], effects: [], ...props };
  if (type === "INSTANCE") n.getMainComponentAsync = async () => n.mainComponent ?? null;
  n.absoluteBoundingBox = props.absoluteBoundingBox ?? { x: n.x, y: n.y, width: n.width, height: n.height };
  if (type !== "TEXT") {
    n.children = children || [];
    n.children.forEach((c) => (c.parent = n));
    n.findAll = (cb) => {
      const out = [];
      const walk = (x) => { for (const c of x.children || []) { if (cb(c)) out.push(c); if (c.children) walk(c); } };
      walk(n);
      return out;
    };
  }
  registry.set(n.id, n);
  return n;
}
const white = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 }, boundVariables: { color: { id: "v" } } }];
const ink = [{ type: "SOLID", color: { r: 0.07, g: 0.09, b: 0.15 }, boundVariables: { color: { id: "v" } } }];
const gray = [{ type: "SOLID", color: { r: 0.8, g: 0.8, b: 0.8 }, boundVariables: { color: { id: "v" } } }];
const text = (characters, fontSize, extra = {}) =>
  node("TEXT", { characters, fontSize, fontName: { family: "Inter", style: "Regular" }, textStyleId: "S:1", fills: ink, lineHeight: { unit: "PERCENT", value: 150 }, ...extra });
const page = (children) => node("PAGE", { name: "Page" }, children);
const stack = (children, extra = {}) => node("FRAME", { layoutMode: "VERTICAL", fills: white, itemSpacing: 16, paddingLeft: 16, paddingRight: 16, paddingTop: 16, paddingBottom: 16, width: 800, height: 600, ...extra }, children);
const button = (label, primary, icons = 0) =>
  node("INSTANCE", { name: "Button", width: 120, height: 40, fills: white, componentProperties: { Type: { type: "VARIANT", value: primary ? "Primary" : "Secondary" } } },
    [...Array.from({ length: icons }, (_, i) => node("VECTOR", { name: `icon/${i}`, width: 16, height: 16 })), text(label, 14)]);

async function run(rootNode, opts = {}) {
  const figma = {
    mixed: Symbol("mixed"),
    currentPage: { id: "0:0" },
    getNodeByIdAsync: async (id) => registry.get(id) ?? null,
    setCurrentPageAsync: async (p) => { figma.currentPage = p; },
  };
  const ids = JSON.stringify(opts.ids ?? [rootNode.id]);
  let code = source.replace(/const ROOT_IDS = \[[^\]]*\]/, `const ROOT_IDS = ${ids}`);
  if (opts.platform) code = code.replace(/const PLATFORM = "[^"]*"/, `const PLATFORM = "${opts.platform}"`);
  return new AsyncFunction("figma", code)(figma);
}

let failed = 0;
const expect = (label, cond) => { console.log(`${cond ? "PASS" : "FAIL"}  ${label}`); if (!cond) failed++; };

// clean screen
{
  const root = stack([text("Team members", 20), text("Invite", 14), button("Add member", true, 1), button("Cancel", false, 0)], {});
  const empty = node("FRAME", { name: "Empty state", fills: white });
  page([root, empty]);
  const r = await run(root);
  console.log("clean:", JSON.stringify({ errors: r.errors, advisories: r.advisories, ids: r.findings.map((f) => f.id) }));
  expect("clean screen has 0 errors", r.errors === 0);
}

// data under a name is not a description; many title+description pairs are an advisory
{
  const row = (n, e) => stack([text(n, 14), text(e, 12)], { width: 300, height: 60 });
  const section = (t, d) => stack([text(t, 20), text(d, 14)], { width: 300, height: 60 });
  const root = stack([row("Amara Okafor", "amara@northwind.design"), row("Jonas Lindqvist", "jonas@northwind.design"),
    section("Invite", "They receive an email with a link to join."), section("Members", "People with access can edit every project."), section("Danger zone", "Deleting the team removes all projects permanently.")]);
  page([root, node("FRAME", { name: "Empty state", fills: white })]);
  const r = await run(root);
  expect("name + email is not flagged as restating", !r.findings.some((f) => f.id === "S03" && f.level === "error"));
  // table rows
  const trow = (a, b, c) => node("FRAME", { layoutMode: "HORIZONTAL", width: 600, height: 24 }, [text(a, 14, { x: 0, y: 0, height: 20 }), text(b, 14, { x: 200, y: 0, height: 20 }), text(c, 12, { x: 400, y: 0, height: 20 })]);
  const table = stack([trow("Platform lead", "Owner", "Active now"), trow("Backend engineer", "Admin", "Yesterday"), trow("Designer", "Member", "Last week"), trow("Analyst", "Viewer", "Today")]);
  page([table]);
  const tr = await run(table);
  expect("table rows are not title + description pairs", !tr.findings.some((f) => f.id === "S03"));
  // state frame naming
  const scr = stack([text("Settings", 20)], { name: "Team settings" });
  page([scr, node("FRAME", { name: "Team settings / Invite open" })]);
  const sr = await run(scr);
  expect("state frame named after the screen satisfies S24", !sr.findings.some((f) => f.id === "S24"));
  expect("3 title+description pairs raise an advisory", r.findings.some((f) => f.id === "S03" && f.level === "advisory"));
}

// sloppy screen
{
  const eyebrow = text("NEW FEATURE", 12, { textCase: "UPPER" });
  const title = text("Team members", 32);
  const desc = text("Manage your team members", 14);
  const gradientText = text("Powered by AI", 20, { fills: [{ type: "GRADIENT_LINEAR", gradientStops: [{ color: { r: 0.5, g: 0.2, b: 0.9 } }, { color: { r: 0.3, g: 0.2, b: 0.8 } }] }] });
  const lowContrast = text("Secondary hint", 14, { fills: gray });
  const lorem = text("Lorem ipsum dolor sit amet", 14);
  const emoji = text("🚀 Launch", 14);
  const buzz = text("Unlock seamless collaboration", 14);
  const prefixGlyph = text("✕ Remove", 14);
  const wrapper = node("FRAME", { name: "Wrapper", fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }] }, [text("in wrapper", 14)]);
  const rawText = node("TEXT", { characters: "Raw", fontSize: 14, fontName: { family: "Inter", style: "Regular" }, fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }] });
  const inner = node("FRAME", { name: "Inner card", width: 200, height: 100, cornerRadius: 8, fills: white, strokes: [{ type: "SOLID", visible: true, color: { r: 0.8, g: 0.8, b: 0.8 } }], strokeWeight: 1 }, [text("a", 14), text("b", 14)]);
  const outer = node("FRAME", { name: "Outer card", width: 400, height: 300, cornerRadius: 8, fills: white, strokes: [{ type: "SOLID", visible: true, color: { r: 0.8, g: 0.8, b: 0.8 } }], strokeWeight: 1 }, [inner, text("c", 14)]);
  const root = stack([eyebrow, title, desc, gradientText, lowContrast, lorem, emoji, buzz, prefixGlyph, wrapper, rawText, outer, button("Save", true, 2), button("Create", true, 0)]);
  page([root]);
  const r = await run(root);
  const ids = new Set(r.findings.filter((f) => f.level === "error").map((f) => f.id));
  expect("glyph prefix is caught", r.findings.some((f) => f.id === "S20" && /prefix/.test(f.message)));
  expect("default white wrapper fill is advisory, not error", r.findings.some((f) => f.node === wrapper.id && f.id === "S22" && f.level === "advisory") && !r.findings.some((f) => f.node === wrapper.id && f.level === "error"));
  console.log("sloppy:", JSON.stringify({ errors: r.errors, advisories: r.advisories, errorIds: [...ids] }));
  for (const id of ["S01", "S03", "S05", "S07", "S10", "S16", "S20", "S22", "S25"]) expect(`sloppy screen trips ${id}`, ids.has(id));
  expect("S24 advisory (no state frames)", r.findings.some((f) => f.id === "S24"));
  expect("result has counts and findings", typeof r.counts === "object" && Array.isArray(r.findings));
}

// relaxed v2: renamed buttons, multi-root, mobile chrome, display text
{
  const btnMain = { name: "Type=Primary", parent: { type: "COMPONENT_SET", name: "Button" } };
  const renamed = (label) => node("INSTANCE", { name: label, width: 120, height: 40, fills: white, mainComponent: btnMain, componentProperties: { Type: { type: "VARIANT", value: "Primary" } } }, [text(label, 14)]);
  const row = stack([renamed("Send money"), renamed("Request money")]);
  const empty = node("FRAME", { name: "Empty state", fills: white });
  page([row, empty]);
  const r = await run(row);
  expect("instances renamed to their label still count as buttons (S25)", r.findings.some((f) => f.id === "S25" && f.level === "error"));

  // multi-root
  const a = stack([text("Main", 20)], { name: "Settings" });
  const b = stack([text("State", 20)], { name: "Settings / loading" });
  page([a, b]);
  const m = await run(a, { ids: [a.id, b.id] });
  expect("ROOT_IDS scans several frames in one call", Array.isArray(m.results) && m.results.length === 2);
  expect("a state frame does not get S24", !m.results[1].findings.some((f) => f.id === "S24"));

  // mobile chrome
  const mobile = stack([text("Hello", 20), text("A short list", 14)], { name: "Home", width: 393, height: 852 });
  page([mobile, node("FRAME", { name: "Home / empty" })]);
  const mr = await run(mobile, { platform: "touch" });
  const chrome = mr.findings.filter((f) => f.id === "S27").map((f) => f.rule);
  expect("mobile without status bar, tab bar is flagged (L13)", chrome.filter((x) => x === "L13").length === 2);
  expect("sparse mobile screen is flagged (L14)", chrome.includes("L14"));

  // display text
  const landing = stack([node("TEXT", { characters: "Invoice faster", fontSize: 56, fontName: { family: "Inter", style: "Semi Bold" }, fills: ink })]);
  page([landing]);
  const lr = await run(landing);
  expect("display text without a style is advisory (T12)", lr.findings.some((f) => f.id === "S22" && f.level === "advisory") && !lr.findings.some((f) => f.id === "S22" && f.level === "error"));

  // repeated strings
  const rep = stack([text("per seat each month", 12), text("per seat each month", 12), text("per seat each month", 12), button("Download invoice", false, 0), button("Download invoice", false, 0), button("Download invoice", false, 0)]);
  page([rep, node("FRAME", { name: "Empty state", fills: white })]);
  const rr = (await run(rep)).findings.filter((f) => f.id === "S04");
  expect("repeated boilerplate gives one S04 advisory", rr.length === 1 && rr[0].level === "advisory" && /per seat/.test(rr[0].message) && !/download/.test(rr[0].message));

  // spacing
  const nudge = stack([text("Row", 14)], { name: "Row", paddingTop: 2, paddingBottom: 2, paddingLeft: 16, paddingRight: 16 });
  const statusBar = stack([text("9:41", 14)], { name: "Status bar", paddingLeft: 7, paddingRight: 7, paddingTop: 16, paddingBottom: 16 });
  const sloppyPad = stack([text("Card", 14)], { name: "Card body", paddingLeft: 13, paddingRight: 16, paddingTop: 16, paddingBottom: 16 });
  const spaced = stack([nudge, statusBar, sloppyPad], { name: "Spacing check" });
  page([spaced, node("FRAME", { name: "Spacing check / empty", fills: white })]);
  const sp = (await run(spaced)).findings.filter((f) => f.id === "S14");
  expect("2px nudges and status-bar padding are not off-scale (S14)", !sp.some((f) => f.node === nudge.id || f.node === statusBar.id));
  expect("real off-scale padding still flagged (S14)", sp.some((f) => f.node === sloppyPad.id));

  // codes and the copyright sign
  const flight = stack([text("JFK", 12, { textCase: "UPPER" }), text("New York", 20), text("© 2026 Tallyfox", 12)]);
  page([flight, node("FRAME", { name: "Empty state", fills: white })]);
  const fr = await run(flight);
  expect("airport code above a heading is not an eyebrow (S10)", !fr.findings.some((f) => f.id === "S10"));
  expect("© is not an emoji (S20)", !fr.findings.some((f) => f.id === "S20"));
  const kicker = stack([text("NEW FEATURE", 12, { textCase: "UPPER" }), text("Team members", 20)]);
  page([kicker]);
  expect("a real kicker is still caught (S10)", (await run(kicker)).findings.some((f) => f.id === "S10" && f.level === "error"));
}

console.log(failed ? `\n${failed} check(s) failed` : "\nAll slop-scan checks passed");
process.exit(failed ? 1 : 0);
