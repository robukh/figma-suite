// Read-only slop scan for a Figma frame. Run the whole file through use_figma; it mutates nothing.
// Rule IDs refer to reference/anti-slop.md. Edit only the constants.
const ROOT_IDS = ["0:0"];     // the screen frame and its state frames (all on the same page)
const PLATFORM = "desktop";   // "desktop" | "touch"  (minimum target 24 / 44 px)
const CASING = "sentence";    // "sentence" | "title"  (project decision, DESIGN.md Voice and content)
const SCALE_BASE = 4;         // spacing grid base (4 or 8)
const ALLOW = [];             // check ids waived WITH a written reason in the report, e.g. ["S11"]
const MAX_FINDINGS = 60;      // size budget for the returned JSON
// ---------------------------------------------------------------------------

async function scanRoot(ROOT_ID) {
const root = await figma.getNodeByIdAsync(ROOT_ID);
if (!root) throw new Error(`ROOT_ID ${ROOT_ID} not found`);
const isStateRoot = /\s[\/—–]\s/.test(root.name);

// pages load lazily: switch before traversing or findAll sees a partial tree
let page = root.parent;
while (page && page.type !== "PAGE") page = page.parent;
if (page && figma.currentPage.id !== page.id) await figma.setCurrentPageAsync(page);

const all = "findAll" in root ? [root, ...root.findAll(() => true)] : [root];
const findings = [];
const counts = {};
const add = (id, level, node, message, rule) => {
  if (ALLOW.includes(id)) return;
  counts[id] = counts[id] || { error: 0, advisory: 0 };
  counts[id][level]++;
  findings.push({ id, rule, level, node: node.id, name: node.name, message });
};

// helpers
const num = (v) => (typeof v === "number" ? v : null);
const visible = (n) => n.visible !== false;
const inInstanceCache = new Map();
const insideInstance = (n) => {
  if (inInstanceCache.has(n.id)) return inInstanceCache.get(n.id);
  let p = n.parent, res = false;
  while (p && p.id !== root.id && p.type !== "PAGE") {
    if (p.type === "INSTANCE") { res = true; break; }
    p = p.parent;
  }
  inInstanceCache.set(n.id, res);
  return res;
};
const solidOf = (n) => {
  const f = n.fills;
  if (!Array.isArray(f)) return null;
  const p = f.find((x) => x.visible !== false && x.type === "SOLID");
  return p ? { c: p.color, a: p.opacity ?? 1 } : null;
};
const gradientsOf = (n) => (Array.isArray(n.fills) ? n.fills.filter((x) => x.visible !== false && String(x.type).startsWith("GRADIENT")) : []);
const hue = ({ r, g, b }) => {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (!d) return { h: 0, s: 0, l: (mx + mn) / 2 };
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: d / (1 - Math.abs(mx + mn - 1)), l: (mx + mn) / 2 };
};
const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const words = (s) => (s.toLowerCase().match(/[a-z]{3,}/g) || []).filter((w) => !["the", "and", "for", "your", "you", "with", "this", "that", "from", "are", "has", "have"].includes(w));
const texts = all.filter((n) => n.type === "TEXT" && visible(n));
const BUTTON_RE = /(^|[\s/_-])(button|btn|cta)([\s/_-]|$)/i;
// buttons renamed to their label still count: resolve the main component name
const mainName = new Map();
for (const n of all) {
  if (n.type !== "INSTANCE") continue;
  try {
    const mc = await n.getMainComponentAsync();
    mainName.set(n.id, (mc && mc.parent && mc.parent.type === "COMPONENT_SET" ? mc.parent.name : mc && mc.name) || "");
  } catch (e) { mainName.set(n.id, ""); }
}
const isButton = (n) => ["INSTANCE", "FRAME", "COMPONENT"].includes(n.type) && (BUTTON_RE.test(n.name) || (n.type === "INSTANCE" && BUTTON_RE.test(mainName.get(n.id) || ""))) && !/group|row|bar/i.test(n.name);
const isIconLike = (n) => {
  if (!visible(n)) return false;
  const big = Math.max(n.width || 0, n.height || 0);
  if (big > 40) return false;
  return ["VECTOR", "BOOLEAN_OPERATION", "STAR", "POLYGON", "LINE"].includes(n.type) || /icon|chevron|caret|glyph|arrow|ic[-_/]/i.test(n.name);
};
const hasStroke = (n) => Array.isArray(n.strokes) && n.strokes.some((s) => s.visible !== false) && (num(n.strokeWeight) ?? 1) > 0;
const hasShadow = (n) => Array.isArray(n.effects) && n.effects.some((e) => e.visible !== false && e.type === "DROP_SHADOW");
const isCardLike = (n) =>
  ["FRAME", "INSTANCE", "COMPONENT"].includes(n.type) && visible(n) && n.id !== root.id &&
  (n.width || 0) >= 80 && (n.height || 0) >= 48 && !isButton(n) && !/input|field|select|avatar|image|media|chip|badge|tag|tab|toggle|switch|slider|dialog|modal|menu|popover/i.test(n.name) &&
  (hasStroke(n) || hasShadow(n)) && ((num(n.cornerRadius) ?? 0) > 0 || !!solidOf(n)) && (n.children?.length ?? 0) >= 2;

// S01 icons in buttons
const buttons = all.filter(isButton);
let withIcon = 0;
for (const b of buttons) {
  const icons = [];
  const walk = (n) => { for (const c of n.children || []) { if (isIconLike(c)) icons.push(c); else if ("children" in c) walk(c); } };
  walk(b);
  if (icons.length > 1) add("S01", "error", b, `${icons.length} icons in one button; a button carries at most one meaningful icon`, "K02");
  if (icons.length) withIcon++;
}
if (buttons.length >= 4 && withIcon / buttons.length > 0.6) add("S01", "advisory", root, `${withIcon} of ${buttons.length} buttons carry an icon; icons in buttons are off by default`, "K02");

// S02 icon tiles above headings
const tiles = all.filter((n) => ["FRAME", "INSTANCE"].includes(n.type) && visible(n) && n.id !== root.id &&
  (n.width || 0) >= 32 && (n.width || 0) <= 128 && (n.height || 0) / (n.width || 1) > 0.7 && (n.height || 0) / (n.width || 1) < 1.4 &&
  ((num(n.cornerRadius) ?? 0) > 0 || !!solidOf(n)) && (n.children || []).length === 1 && isIconLike(n.children[0]) &&
  n.parent?.layoutMode === "VERTICAL" && (() => { const sib = n.parent.children, i = sib.indexOf(n); return sib[i + 1]?.type === "TEXT"; })());
if (tiles.length >= 3) add("S02", "advisory", tiles[0], `${tiles.length} icon tiles above headings (the generic feature-tile pattern)`, "K04");

// S03 description under title
const stack = all.filter((n) => "children" in n && n.layoutMode === "VERTICAL" && visible(n));
// a pair is stacked text; table columns sit side by side
const pairKey = (c) => { const t = (c.children || []).filter((x) => x.type === "TEXT" && visible(x)); return t.length >= 2 && t[1].y >= t[0].y + t[0].height - 2 ? t : null; };
let pairs = 0, firstPair = null;
const dataLike = (s) => /[@\d]|https?:/.test(s);
for (const p of stack) {
  const kids = p.children.filter(visible);
  for (let i = 0; i + 1 < kids.length; i++) {
    const a = kids[i], b = kids[i + 1];
    if (a.type !== "TEXT" || b.type !== "TEXT") continue;
    const fa = num(a.fontSize), fb = num(b.fontSize);
    if (fa === null || fb === null || fb > fa || dataLike(b.characters)) continue;
    if (b.characters.length > a.characters.length) { pairs++; firstPair = firstPair || b; }
    const A = words(a.characters), B = words(b.characters);
    if (A.length && B.length) {
      const ov = A.filter((w) => B.includes(w)).length / Math.min(A.length, B.length);
      if (ov >= 0.5) add("S03", "error", b, `description restates its title ("${a.characters.slice(0, 40)}")`, "C02");
    }
  }
  const items = p.children.filter((c) => visible(c) && "children" in c && pairKey(c));
  if (items.length >= 3) {
    const withDesc = items.filter((c) => { const t = pairKey(c); return num(t[0].fontSize) !== null && num(t[1].fontSize) !== null && t[1].fontSize <= t[0].fontSize; });
    if (withDesc.length >= 3 && withDesc.length / p.children.length > 0.6) add("S03", "advisory", p, `${withDesc.length} sibling items each carry a title plus a description; keep descriptions only where content differs`, "C02");
  }
}

// S04 repeats and identical tiles
if (pairs >= 3) add("S03", "advisory", firstPair, `${pairs} title + description pairs on one screen; run each through the redundancy test (keep a description only where it adds a reason, consequence, format, next step or data)`, "C02");

const seen = new Map();
// button labels and names shown in several places are fine: skip buttons, report the rest once
for (const t of texts) { const k = t.characters.trim().toLowerCase(); if (k.length >= 12 && !(t.parent && isButton(t.parent))) seen.set(k, [...(seen.get(k) || []), t]); }
const repeated = [...seen].filter(([, list]) => list.length >= 3);
if (repeated.length) add("S04", "advisory", repeated[0][1][0], `${repeated.length} text string(s) repeat 3+ times: ${repeated.slice(0, 4).map(([k, l]) => `"${k.slice(0, 28)}" x${l.length}`).join(", ")}; fine for names and data shown in several places, delete if it is boilerplate (units, captions)`, "C03");
for (const p of all.filter((n) => "children" in n && visible(n))) {
  const kids = p.children.filter((c) => visible(c) && ["FRAME", "INSTANCE"].includes(c.type));
  if (kids.length < 3) continue;
  const sig = (c) => `${c.type}|${Math.round(c.width / 8)}|${Math.round(c.height / 8)}|${(c.findAll?.((x) => x.type === "TEXT") || []).length}|${(c.findAll?.(isIconLike) || []).length > 0}`;
  const groups = new Map();
  for (const c of kids) groups.set(sig(c), [...(groups.get(sig(c)) || []), c]);
  for (const g of groups.values()) if (g.length >= 3 && (g[0].findAll?.(isIconLike) || []).length && (g[0].findAll?.((x) => x.type === "TEXT") || []).length >= 2) add("S04", "advisory", p, `${g.length} identical icon + heading + text tiles in one row/grid`, "L07");
}

// S05 nested cards, S06 side stripes
const cards = new Set(all.filter(isCardLike).map((n) => n.id));
for (const n of all) {
  if (!cards.has(n.id)) continue;
  let p = n.parent;
  while (p && p.id !== root.id && p.type !== "PAGE") { if (cards.has(p.id)) { add("S05", "error", n, `card inside card ("${p.name}")`, "L06"); break; } p = p.parent; }
}
for (const n of all) {
  if (!visible(n) || n.id === root.id) continue;
  const L = num(n.strokeLeftWeight), R = num(n.strokeRightWeight), T = num(n.strokeTopWeight), B = num(n.strokeBottomWeight);
  if (L !== null && hasStroke(n) && ((L > 1 && !R && !T && !B) || (R > 1 && !L && !T && !B)) && (num(n.parent?.cornerRadius) ?? num(n.cornerRadius) ?? 0) >= 0) add("S06", "error", n, "colored side-stripe border", "K07");
  if (n.type === "RECTANGLE" && n.width >= 2 && n.width <= 6 && n.parent && n.parent.height && n.height >= n.parent.height * 0.5 && (n.x <= 1 || n.x + n.width >= n.parent.width - 1) && cards.has(n.parent.id)) add("S06", "error", n, "accent bar on a card edge", "K07");
}

// S07 gradients, S08 shadows, S09 glass
let glass = 0;
for (const n of all) {
  if (!visible(n)) continue;
  if (n.type === "TEXT" && gradientsOf(n).length) add("S07", "error", n, "gradient text", "K14");
  for (const g of gradientsOf(n)) {
    const hs = (g.gradientStops || []).map((s) => hue(s.color)).filter((x) => x.s > 0.35);
    if (hs.some((x) => x.h >= 250 && x.h <= 290)) { add("S07", "advisory", n, "purple/indigo gradient (default AI palette)", "T02"); break; }
  }
  for (const e of n.effects || []) {
    if (e.visible === false) continue;
    if (e.type === "DROP_SHADOW") {
      const chroma = Math.max(e.color.r, e.color.g, e.color.b) - Math.min(e.color.r, e.color.g, e.color.b);
      if (e.offset.x === 0 && e.offset.y === 0 && e.radius >= 8 && chroma > 0.15) add("S08", "advisory", n, "colored glow shadow", "K14");
      if (e.radius === 0 && (Math.abs(e.offset.x) >= 4 || Math.abs(e.offset.y) >= 4)) add("S08", "advisory", n, "hard offset shadow", "K14");
    }
    if (e.type === "BACKGROUND_BLUR") glass++;
  }
}
if (glass > 1) add("S09", "advisory", root, `${glass} background-blur (glass) elements`, "K14");

// S10 eyebrow / numbering
for (const t of texts) {
  const fs = num(t.fontSize), ch = t.characters.trim();
  if (fs === null || fs > 14 || ch.length < 2 || ch.length > 60) continue;
  const p = t.parent;
  if (!p || !("children" in p)) continue;
  const next = p.children[p.children.indexOf(t) + 1];
  if (!next || next.type !== "TEXT" || !(num(next.fontSize) > fs + 2)) continue;
  const ls = t.letterSpacing && typeof t.letterSpacing === "object" ? t.letterSpacing : null;
  const tracked = ls && ((ls.unit === "PERCENT" && ls.value >= 5) || (ls.unit === "PIXELS" && ls.value >= 1));
  // short codes like "JFK" are data, not kickers
  const caps = t.textCase === "UPPER" ? !/^[A-Z0-9]{2,3}$/.test(ch) : (/[A-Z]/.test(ch) && ch === ch.toUpperCase() && (/[A-Z]{4}/.test(ch) || /[A-Z]{3}\s+[A-Z]{2,}/.test(ch)));
  if (caps || tracked) add("S10", "error", t, `eyebrow/kicker above a heading ("${ch}")`, "C01");
  else if (/^0\d$/.test(ch) || /^\d{2}\s*[/.\-]/.test(ch)) add("S10", "error", t, `numbered label ("${ch}") above a heading; number only real sequences`, "C10");
}

// S11 casing
for (const t of texts) {
  const ch = t.characters.trim(), fs = num(t.fontSize);
  if ((t.textCase === "UPPER" || (ch.length > 3 && ch === ch.toUpperCase() && /[A-Z]/.test(ch))) && ch.length > 24) add("S11", "advisory", t, "long ALL-CAPS text", "C11");
  if (CASING === "sentence" && fs !== null && fs >= 16) {
    const w = ch.split(/\s+/).filter((x) => x.length > 3);
    if (w.length >= 3 && w.filter((x) => /^[A-Z]/.test(x)).length / w.length >= 0.75) add("S11", "advisory", t, `Title Case heading while the project uses sentence case ("${ch.slice(0, 40)}")`, "C11");
  }
}

// S12 pills
const pills = all.filter((n) => ["FRAME", "INSTANCE"].includes(n.type) && visible(n) && n.id !== root.id && n.height <= 32 && n.height >= 14 &&
  (num(n.cornerRadius) ?? 0) >= n.height / 2 - 1 && !isButton(n) && !/avatar|toggle|switch|slider|tab|search|input|field|progress|bar/i.test(n.name) && (n.findAll?.((x) => x.type === "TEXT") || []).length >= 1);
if (pills.length > 5) add("S12", "advisory", root, `${pills.length} pills/badges on one screen`, "K06");
const byParent = new Map();
for (const p of pills) { const k = p.parent?.id; if (k) byParent.set(k, [...(byParent.get(k) || []), p]); }
for (const [k, list] of byParent) if (list.length >= 3 && list[0].parent.layoutMode === "VERTICAL") add("S12", "advisory", list[0].parent, `${list.length} pills stacked in one container`, "K06");

// S13 type census
const sizes = [...new Set(texts.map((t) => num(t.fontSize)).filter((x) => x !== null))].sort((a, b) => a - b);
const fams = [...new Set(texts.map((t) => t.fontName && t.fontName.family).filter(Boolean))];
if (sizes.length > 6) add("S13", "advisory", root, `${sizes.length} text sizes (${sizes.join(", ")}); keep to ≤4 per screen`, "T04");
if (fams.length > 2) add("S13", "advisory", root, `${fams.length} font families (${fams.join(", ")})`, "T04");
const close = sizes.filter((s, i) => i > 0 && s / sizes[i - 1] < 1.1);
if (close.length >= 2) add("S13", "advisory", root, `near-duplicate text sizes (${close.join(", ")}); levels should differ by real steps`, "T04");

// S14 off-scale spacing, S15 radii and shadow
const radii = new Set();
for (const n of all) {
  if (!visible(n) || insideInstance(n)) continue;
  if (n.layoutMode && n.layoutMode !== "NONE") {
    for (const k of ["paddingLeft", "paddingRight", "paddingTop", "paddingBottom", "itemSpacing"]) {
      const v = num(n[k]);
      // ignore 1-2px nudges and OS chrome
      if (v && v > 2 && v % SCALE_BASE !== 0 && !/status ?bar|tab ?bar|home ?indicator|nav ?bar|keyboard/i.test(n.name) && !(n.boundVariables && n.boundVariables[k])) add("S14", "advisory", n, `${k}=${v} is off the ${SCALE_BASE}px scale and not bound to a variable`, "T11");
    }
  }
  const r = num(n.cornerRadius);
  if (r) radii.add(r);
  if (hasStroke(n) && Array.isArray(n.effects) && n.effects.some((e) => e.visible !== false && e.type === "DROP_SHADOW" && e.radius >= 12) && cards.has(n.id)) add("S15", "advisory", n, "hairline border plus wide shadow; pick one elevation signal", "K08");
}
if (radii.size > 4) add("S15", "advisory", root, `${radii.size} distinct corner radii (${[...radii].sort((a, b) => a - b).join(", ")})`, "K12");

// S16 contrast, S17 tiny text, S18 readability
const bgOf = (n) => { let p = n.parent; while (p && p.type !== "PAGE") { const s = solidOf(p); if (s && s.a >= 0.99) return s.c; if (gradientsOf(p).length || (Array.isArray(p.fills) && p.fills.some((f) => f.visible !== false && f.type === "IMAGE"))) return null; p = p.parent; } return null; };
for (const t of texts) {
  const fs = num(t.fontSize), fg = solidOf(t), bg = bgOf(t);
  if (fg && bg && fg.a >= 0.99) {
    const big = fs !== null && (fs >= 24 || (fs >= 18.66 && /bold|semi|black|heavy|700|800/i.test(t.fontName?.style || "")));
    const ratio = contrast(fg.c, bg);
    if (ratio < (big ? 3 : 4.5)) add("S16", "error", t, `contrast ${ratio.toFixed(2)}:1 (needs ${big ? 3 : 4.5}:1)`, "T03");
  }
  if (fs !== null) { if (fs < 10) add("S17", "error", t, `${fs}px text`, "T08"); else if (fs < 12) add("S17", "advisory", t, `${fs}px text`, "T08"); }
  const lh = t.lineHeight && typeof t.lineHeight === "object" ? t.lineHeight : null;
  if (fs !== null && lh && fs <= 18 && t.characters.length > 40 && ((lh.unit === "PIXELS" && lh.value / fs < 1.3) || (lh.unit === "PERCENT" && lh.value < 130))) add("S18", "advisory", t, "line height under 1.3 for running text", "T05");
  if (t.textAlignHorizontal === "JUSTIFIED") add("S18", "advisory", t, "justified text", "T05");
  if (fs !== null && t.characters.length > 85 && t.width / (fs * 0.5) > 85 && t.textTruncation !== "ENDING") add("S18", "advisory", t, "line length over ~85 characters", "T05");
}

// S20 banned strings
const BUZZ = /\b(seamless(ly)?|supercharge[ds]?|unlock(s|ed|ing)?|elevate[sd]?|empower(s|ed|ing)?|leverage[sd]?|cutting-edge|game-?chang\w+|revolution\w+|next-gen\w*|streamline[sd]?|effortless(ly)?)\b/i;
const PLACEHOLDER = /lorem|ipsum|dolor sit|\bjohn doe\b|\bjane doe\b|\bacme\b|\bfoo bar\b|placeholder text/i;
for (const t of texts) {
  const ch = t.characters.trim();
  if (!ch) continue;
  if (/\p{Extended_Pictographic}/u.test(ch.replace(/[©®™]/g, ""))) add("S20", "error", t, `emoji in UI text ("${ch.slice(0, 30)}")`, "C08");
  else if (/^[✕✓✔✖→←▸▾▶›•×]$/.test(ch) || /^[✕✓✔✖→←▸▾▶›•×]\s+\S/.test(ch) || /(^|\s)[→›»]$/.test(ch)) add("S20", "error", t, `glyph used as icon/prefix/suffix ("${ch.slice(0, 14)}")`, "C08");
  if (/\s·\s.+\s·\s/.test(ch)) add("S20", "error", t, "middle-dot meta string", "C08");
  if (/\s[—–]\s/.test(ch) && ch.length < 60) add("S20", "advisory", t, "spaced dash label", "C08");
  if (BUZZ.test(ch)) add("S20", "error", t, `hype/filler word ("${ch.match(BUZZ)[0]}")`, "C07");
  if (/^welcome back\b/i.test(ch) || /\boops\b/i.test(ch) || (/!\s*$/.test(ch) && ch.length < 80)) add("S20", "advisory", t, "greeting/exclamation/apology copy", "C07");
  if (PLACEHOLDER.test(ch)) add("S20", "error", t, `placeholder or fabricated content ("${ch.slice(0, 30)}")`, "C09");
  if (t.parent && isButton(t.parent) && /^(submit|ok|okay|click here|learn more|read more|yes|no)$/i.test(ch)) add("S20", "advisory", t, `generic button label "${ch}"`, "C04");
}

// S21 default palette
for (const n of all) {
  if (!visible(n) || !["FRAME", "RECTANGLE", "INSTANCE"].includes(n.type) || (n.width || 0) < 200 || (n.height || 0) < 100) continue;
  const s = solidOf(n);
  if (!s) continue;
  const { h, s: sat, l } = hue(s.c);
  if (h >= 255 && h <= 285 && sat > 0.5 && l > 0.2 && l < 0.7) add("S21", "advisory", n, "large indigo/violet fill (default AI palette)", "T02");
  if (n.parent && (n.parent.type === "PAGE" || n.parent.id === root.id) && s.c.r >= 0.95 && s.c.g >= 0.92 && s.c.g <= 0.98 && s.c.b >= 0.82 && s.c.b <= 0.93 && s.c.r - s.c.b > 0.06) add("S21", "advisory", n, "cream page fill (reflex 'safe' palette)", "T02");
}

// S22 unbound values
let unbound = 0;
for (const n of all) {
  if (!visible(n) || insideInstance(n) || n.id === root.id && n.type === "PAGE") continue;
  if (n.type === "TEXT") {
    if (!n.textStyleId || n.textStyleId === figma.mixed) {
      // display text beyond the scale is a recorded exception (T12)
      if (num(n.fontSize) !== null && n.fontSize >= 28) add("S22", "advisory", n, `display text (${n.fontSize}px) outside the type scale; record it as an exception`, "T12");
      else { unbound++; if (unbound <= 20) add("S22", "error", n, "text without a Text Style", "T11"); }
    }
  }
  if (!["FRAME", "RECTANGLE", "TEXT", "VECTOR", "ELLIPSE", "POLYGON", "STAR", "LINE", "BOOLEAN_OPERATION", "COMPONENT"].includes(n.type)) continue;
  const raw = (paints, styleId) => Array.isArray(paints) && paints.some((p) => p.visible !== false && p.type === "SOLID" && !(p.boundVariables && p.boundVariables.color)) && !(styleId && styleId !== figma.mixed);
  if (raw(n.fills, n.fillStyleId)) {
    // default fill equal to the parent background is clutter, not a color
    const s = n.type === "FRAME" ? solidOf(n) : null, bg = s ? bgOf(n) : null;
    if (s && bg && s.a >= 0.99 && contrast(s.c, bg) < 1.02) add("S22", "advisory", n, "redundant default fill equal to its parent background; clear fills", "T11");
    else { unbound++; if (unbound <= 20) add("S22", "error", n, "raw fill color (no variable or style)", "T11"); }
  }
  if (raw(n.strokes, n.strokeStyleId)) { unbound++; if (unbound <= 20) add("S22", "error", n, "raw stroke color (no variable or style)", "T11"); }
}
if (unbound > 20) add("S22", "error", root, `${unbound - 20} more unbound values not listed`, "T11");

// S23 targets
const MIN = PLATFORM === "touch" ? 44 : 24;
for (const n of all) {
  if (!visible(n) || !["INSTANCE", "FRAME", "COMPONENT"].includes(n.type) || n.id === root.id) continue;
  if (/(^|[\s/_-])(button|btn|checkbox|radio|toggle|switch|tab|link)([\s/_-]|$)/i.test(n.name) && Math.min(n.width, n.height) < MIN) add("S23", "advisory", n, `target ${Math.round(n.width)}×${Math.round(n.height)} is under ${MIN}px`, "T10");
}

// S24 states
if (page) {
  const stem = root.name.toLowerCase();
  const isStateFrame = (c) => c.id !== root.id && (/empty|loading|error|skeleton|offline|disabled|success|confirm|open|selected|expanded/i.test(c.name) || (c.name.toLowerCase().startsWith(stem) && /[\/—–-]/.test(c.name.slice(stem.length))));
  if (!isStateRoot &&!page.children.some(isStateFrame)) add("S24", "advisory", root, "no empty/loading/error state frames found next to this screen", "K13");
}
for (const s of root.type === "COMPONENT_SET" ? [root] : all.filter((n) => n.type === "COMPONENT_SET")) {
  const defs = s.componentPropertyDefinitions || {};
  if (!Object.entries(defs).some(([k, d]) => d.type === "VARIANT" && /state|status/i.test(k))) add("S24", "advisory", s, "component set has no State variant property", "K13");
}

// S27 platform chrome and density (advisory; see L13, L14)
if (PLATFORM === "touch" && root.width <= 480 && !isStateRoot) {
  const hasStatus = all.some((n) => /status ?bar/i.test(n.name)) || texts.some((t) => /^\d{1,2}:\d{2}$/.test(t.characters.trim()));
  if (!hasStatus) add("S27", "advisory", root, "no status bar found; mobile screens include one (ignore for modals and overlays)", "L13");
  const rb = root.absoluteBoundingBox;
  const bottomBar = (c) => rb && c.absoluteBoundingBox && c.absoluteBoundingBox.y + c.absoluteBoundingBox.height >= rb.y + rb.height - 6 && c.height >= 48 && c.height <= 120 && (c.children || []).length >= 3;
  const hasBottomBar = all.some((n) => /tab ?bar|bottom ?(nav|bar)|navigation ?bar/i.test(n.name)) || (root.children || []).some(bottomBar);
  if (!hasBottomBar) add("S27", "advisory", root, "no tab or bottom bar found; fine for detail or modal screens, expected when the app has several top-level destinations", "L13");
}
if (PLATFORM === "touch" && root.height >= 700 && !isStateRoot) {
  const rb = root.absoluteBoundingBox;
  const bottoms = texts.map((t) => (t.absoluteBoundingBox ? t.absoluteBoundingBox.y + t.absoluteBoundingBox.height : 0));
  if (rb && bottoms.length) {
    const low = Math.max(...bottoms) - rb.y;
    if (low < root.height * 0.66) add("S27", "advisory", root, `content ends at ${Math.round((low / root.height) * 100)}% of the screen height; the bottom third is empty`, "L14");
  }
}

// S25 multiple primary buttons
const primaries = new Map();
for (const b of buttons.filter((x) => x.type === "INSTANCE")) {
  let isPrimary = false;
  try { isPrimary = Object.values(b.componentProperties || {}).some((p) => p.type === "VARIANT" && /^primary$/i.test(String(p.value))); } catch { /* not readable */ }
  if (isPrimary || /primary/i.test(b.name)) { const k = b.parent?.id; if (k) primaries.set(k, [...(primaries.get(k) || []), b]); }
}
for (const list of primaries.values()) if (list.length >= 2) add("S25", "error", list[0].parent, `${list.length} primary buttons in one container; one primary action per section`, "L01");

// result
const order = { error: 0, advisory: 1 };
findings.sort((a, b) => order[a.level] - order[b.level] || a.id.localeCompare(b.id));
const truncated = findings.length > MAX_FINDINGS;
return {
  rootId: ROOT_ID,
  scanned: all.length,
  errors: findings.filter((f) => f.level === "error").length,
  advisories: findings.filter((f) => f.level === "advisory").length,
  counts,
  findings: findings.slice(0, MAX_FINDINGS),
  truncated,
  waived: ALLOW,
  judgedByCritic: ["S19 heading rhythm", "S26 heading levels", "overall restraint, hierarchy and copy quality"],
};
}

const results = [];
for (const id of ROOT_IDS) results.push(await scanRoot(id));
return results.length === 1 ? results[0] : { results };
