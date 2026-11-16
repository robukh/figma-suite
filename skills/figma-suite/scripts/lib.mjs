// Shared helpers for check-contract.mjs and discover.mjs (no dependencies).

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const sha = (text) =>
  "sha256:" + createHash("sha256").update(text).digest("hex").slice(0, 16);

export const readText = (p) => readFileSync(p, "utf8").replace(/^\uFEFF/, "");

// Minimal YAML subset for DESIGN.md front matter: nested maps, "- " lists, flow [a, b] / { a: b }, # comments.
// Not supported: anchors, block scalars (| >), tags.

function stripComment(line) {
  let quote = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === quote && line[i - 1] !== "\\") quote = null;
    } else if (c === '"' || (c === "'" && (i === 0 || /[\s:\[{,]/.test(line[i - 1])))) {
      quote = c;
    } else if (c === "#" && (i === 0 || /\s/.test(line[i - 1]))) {
      return line.slice(0, i);
    }
  }
  return line;
}

function parseFlow(src) {
  let i = 0;
  const ws = () => {
    while (i < src.length && /\s/.test(src[i])) i++;
  };
  const fail = (m) => {
    throw new Error(`flow value: ${m} in "${src}"`);
  };
  const quoted = () => {
    const q = src[i++];
    let out = "";
    while (i < src.length && src[i] !== q) {
      if (src[i] === "\\" && q === '"') i++;
      out += src[i++];
    }
    if (src[i] !== q) fail("unterminated string");
    i++;
    return out;
  };
  const bare = (stops) => {
    const s = i;
    while (i < src.length && !stops.includes(src[i])) i++;
    return src.slice(s, i).trim();
  };
  const value = () => {
    ws();
    if (src[i] === "[") {
      i++;
      const arr = [];
      ws();
      while (src[i] !== "]") {
        if (i >= src.length) fail("unterminated [");
        arr.push(value());
        ws();
        if (src[i] === ",") i++;
        ws();
      }
      i++;
      return arr;
    }
    if (src[i] === "{") {
      i++;
      const obj = {};
      ws();
      while (src[i] !== "}") {
        if (i >= src.length) fail("unterminated {");
        ws();
        const k = src[i] === '"' || src[i] === "'" ? quoted() : bare([":", ",", "}"]);
        ws();
        if (src[i] !== ":") fail(`expected ':' after key "${k}"`);
        i++;
        obj[k] = value();
        ws();
        if (src[i] === ",") i++;
        ws();
      }
      i++;
      return obj;
    }
    if (src[i] === '"' || src[i] === "'") return quoted();
    return scalar(bare([",", "]", "}"]));
  };
  const out = value();
  ws();
  if (i < src.length) fail("trailing characters");
  return out;
}

function scalar(raw) {
  const s = raw.trim();
  if (s === "") return null;
  if (s[0] === '"') {
    try {
      return JSON.parse(s);
    } catch {
      return s.slice(1, -1);
    }
  }
  if (s[0] === "'") return s.slice(1, -1).replace(/''/g, "'");
  if (s[0] === "[" || s[0] === "{") return parseFlow(s);
  if (s === "true") return true;
  if (s === "false") return false;
  if (s === "null" || s === "~") return null;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  if (s === "|" || s === ">" || /^[|>][+-]?$/.test(s)) {
    throw new Error("block scalars (| >) are not supported in DESIGN.md front matter");
  }
  return s;
}

const KEY_RE = /^("(?:[^"\\]|\\.)*"|'[^']*'|[^\s"'\[{\-#][^:]*?|-[^\s:][^:]*?)\s*:(?:\s+(.*)|)$/;

function splitKey(text) {
  const m = KEY_RE.exec(text);
  if (!m) return null;
  let key = m[1];
  if (key[0] === '"') key = JSON.parse(key);
  else if (key[0] === "'") key = key.slice(1, -1);
  return { key, rest: (m[2] ?? "").trim() };
}

export function parseYaml(text) {
  const lines = [];
  text.split(/\r?\n/).forEach((l, n) => {
    const t = stripComment(l).replace(/\s+$/, "");
    if (!t.trim()) return;
    const indent = t.match(/^ */)[0].length;
    if (/^\s*\t/.test(t)) throw new Error(`line ${n + 1}: tabs are not allowed for indentation`);
    lines.push({ indent, text: t.trim(), n: n + 1 });
  });
  let pos = 0;
  const isItem = (l) => l && (l.text === "-" || l.text.startsWith("- "));

  function node(indent) {
    const l = lines[pos];
    if (!l || l.indent < indent) return null;
    return isItem(l) ? list(l.indent) : map(l.indent);
  }
  function list(indent) {
    const out = [];
    while (pos < lines.length && lines[pos].indent === indent && isItem(lines[pos])) {
      const l = lines[pos];
      const rest = l.text === "-" ? "" : l.text.slice(2).trim();
      if (rest === "") {
        pos++;
        out.push(lines[pos] && lines[pos].indent > indent ? node(lines[pos].indent) : null);
      } else if (splitKey(rest)) {
        lines[pos] = { indent: indent + 2, text: rest, n: l.n };
        out.push(map(indent + 2));
      } else {
        pos++;
        out.push(scalar(rest));
      }
    }
    return out;
  }
  function map(indent) {
    const out = {};
    while (pos < lines.length && lines[pos].indent === indent && !isItem(lines[pos])) {
      const l = lines[pos];
      const kv = splitKey(l.text);
      if (!kv) throw new Error(`line ${l.n}: expected "key: value", got "${l.text}"`);
      if (kv.rest === "") {
        pos++;
        const next = lines[pos];
        if (next && next.indent > indent) out[kv.key] = node(next.indent);
        else if (next && next.indent === indent && isItem(next)) out[kv.key] = list(indent);
        else out[kv.key] = null;
      } else {
        pos++;
        try {
          out[kv.key] = scalar(kv.rest);
        } catch (e) {
          throw new Error(`line ${l.n}: ${e.message}`);
        }
      }
    }
    if (pos < lines.length && lines[pos].indent > indent) {
      throw new Error(`line ${lines[pos].n}: unexpected indentation`);
    }
    return out;
  }

  if (!lines.length) return {};
  const result = node(lines[0].indent);
  if (pos < lines.length) throw new Error(`line ${lines[pos].n}: could not parse "${lines[pos].text}"`);
  return result ?? {};
}

// DESIGN.md parsing

export function splitFrontMatter(md) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(md);
  if (!m) return { front: null, body: md };
  return { front: m[1], body: md.slice(m[0].length) };
}

export const normHeading = (s) =>
  s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

export function parseDesignMd(md) {
  const { front, body } = splitFrontMatter(md);
  let data = {};
  let parseError = null;
  if (front !== null) {
    try {
      data = parseYaml(front);
    } catch (e) {
      parseError = e.message;
    }
  }
  const sections = [];
  for (const m of body.matchAll(/^##\s+(.+?)\s*$/gm)) {
    sections.push({ title: m[1], key: normHeading(m[1]), index: m.index });
  }
  const blocks = {};
  const fm = front ?? "";
  for (const m of fm.matchAll(/#\s*figma-suite:generated\s+([\w-]+)[^\n]*\n([\s\S]*?)#\s*\/figma-suite:generated/g)) {
    blocks[m[1]] = sha(m[2].trim());
  }
  for (const m of body.matchAll(/<!--\s*figma-suite:generated\s+([\w-]+)\s*-->([\s\S]*?)<!--\s*\/figma-suite:generated\s*-->/g)) {
    blocks[m[1]] = sha(m[2].trim());
  }
  return { hasFront: front !== null, data, parseError, sections, blocks, body };
}

// token paths: colors.x, typography.x, rounded.x, spacing.x (and deeper)
export const TOKEN_ROOTS = ["colors", "typography", "rounded", "spacing"];

export function resolveRef(data, path) {
  let cur = data;
  for (const part of path.split(".")) {
    if (cur == null || typeof cur !== "object" || !(part in cur)) return undefined;
    cur = cur[part];
  }
  return cur;
}

export function collectRefs(value, out = []) {
  if (typeof value === "string") {
    for (const m of value.matchAll(/\{([A-Za-z0-9_.\-]+)\}/g)) out.push(m[1]);
  } else if (Array.isArray(value)) value.forEach((v) => collectRefs(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => collectRefs(v, out));
  return out;
}

// WCAG contrast
export function parseHex(h) {
  if (typeof h !== "string") return null;
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(h.trim());
  if (!m) return null;
  let x = m[1];
  if (x.length === 3) x = [...x].map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16) / 255);
}
const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
export function contrast(a, b) {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

// Mapping validation (see reference/mapping-schema.md)

const STATUSES = ["matched", "code-only", "figma-only", "split", "merged", "diverged"];
const KINDS = ["enum", "boolean", "text", "instanceSwap", "slot"];
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;
const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);

export function validateEntry(e) {
  const errs = [];
  if (!isObj(e)) return ["root: must be an object"];
  if (typeof e.id !== "string" || !SLUG.test(e.id)) errs.push("id: must be a filename-safe slug (letters, digits, hyphens)");
  if (!STATUSES.includes(e.status)) errs.push(`status: must be one of ${STATUSES.join(", ")}`);
  const checkCode = (c, p) => {
    if (!isObj(c)) return errs.push(`${p}: must be an object`);
    if (typeof c.path !== "string") errs.push(`${p}.path: required string`);
    if (typeof c.exportName !== "string") errs.push(`${p}.exportName: required string`);
    if (c.props !== undefined && !Array.isArray(c.props)) errs.push(`${p}.props: must be an array`);
  };
  const checkFigma = (f, p) => {
    if (!isObj(f)) return errs.push(`${p}: must be an object`);
    for (const k of ["fileKey", "nodeId", "componentName"]) if (typeof f[k] !== "string") errs.push(`${p}.${k}: required string`);
    if (f.properties !== undefined && !Array.isArray(f.properties)) errs.push(`${p}.properties: must be an array`);
    if (f.published !== undefined && typeof f.published !== "boolean") errs.push(`${p}.published: must be boolean`);
    for (const prop of f.properties ?? []) if (typeof prop === "string" && prop.includes("#")) errs.push(`${p}.properties: "${prop}" has a #uid suffix — store base names only`);
  };
  if (e.code !== undefined) checkCode(e.code, "code");
  if (e.figma !== undefined) (Array.isArray(e.figma) ? e.figma : [e.figma]).forEach((f, i) => checkFigma(f, Array.isArray(e.figma) ? `figma[${i}]` : "figma"));
  const hasCode = e.code != null;
  const hasFigma = e.figma != null;
  if (e.status === "code-only" && hasFigma) errs.push("code-only entry must not have a figma side");
  if (e.status === "figma-only" && hasCode) errs.push("figma-only entry must not have a code side");
  if (e.status === "matched" && (!hasCode || !hasFigma)) errs.push("matched entry must have both code and figma sides");
  if (e.propertyMap !== undefined && !Array.isArray(e.propertyMap)) errs.push("propertyMap: must be an array");
  (e.propertyMap ?? []).forEach((p, i) => {
    const at = `propertyMap[${i}]`;
    if (!isObj(p)) return errs.push(`${at}: must be an object`);
    if (p.codeProp == null && p.figmaProp == null) errs.push(`${at}: needs codeProp, figmaProp, or both`);
    if (!KINDS.includes(p.kind)) errs.push(`${at}.kind: must be one of ${KINDS.join(", ")}`);
    if (typeof p.figmaProp === "string" && p.figmaProp.includes("#")) errs.push(`${at}.figmaProp: "${p.figmaProp}" has a #uid suffix — store the base name only`);
    if (p.values !== undefined) {
      if (!isObj(p.values)) errs.push(`${at}.values: must be an object (figmaValue -> codeValue)`);
      else for (const [k, v] of Object.entries(p.values)) if (!["string", "boolean", "number"].includes(typeof v)) errs.push(`${at}.values.${k}: must be string, boolean or number`);
    }
    if (p.booleanMap !== undefined && !(isObj(p.booleanMap) && typeof p.booleanMap.true === "string" && typeof p.booleanMap.false === "string")) errs.push(`${at}.booleanMap: needs string "true" and "false"`);
  });
  return errs;
}

export function loadMappings(dir) {
  const entries = [];
  if (!existsSync(dir)) return { entries, meta: null, metaError: null, missingDir: true };
  const files = readdirSync(dir).filter((f) => f.endsWith(".json") && !f.startsWith("_")).sort();
  const seen = new Map();
  for (const f of files) {
    const full = join(dir, f);
    const errors = [];
    let entry = null;
    try {
      entry = JSON.parse(readText(full));
    } catch (e) {
      errors.push(`could not parse: ${e.message}`);
    }
    if (entry) {
      errors.push(...validateEntry(entry));
      if (entry.id !== basename(f, ".json")) errors.push(`filename "${f}" does not match id "${entry.id}"`);
      if (typeof entry.id === "string") {
        if (seen.has(entry.id)) errors.push(`duplicate id "${entry.id}" (also in ${seen.get(entry.id)})`);
        else seen.set(entry.id, f);
      }
    }
    entries.push({ file: f, full, id: entry?.id ?? basename(f, ".json"), entry, errors, hash: sha(readText(full)) });
  }
  let meta = null;
  let metaError = null;
  const mp = join(dir, "_meta.json");
  if (existsSync(mp)) {
    try {
      meta = JSON.parse(readText(mp));
      if (meta.version !== 1) metaError = "_meta.json: version must be 1";
      else if (typeof meta.generatedAt !== "string") metaError = "_meta.json: generatedAt must be a string";
    } catch (e) {
      metaError = `_meta.json: could not parse: ${e.message}`;
    }
  }
  return { entries, meta, metaError, missingDir: false };
}

// Workspace discovery

const home = () => process.env.USERPROFILE || process.env.HOME || "";

/** Returns { workspace, config, projectPath } or null. cwd = project root to search from. */
export function findWorkspace(cwd, explicit) {
  const tryDir = (d) => {
    const cfg = join(d, "config.json");
    if (!existsSync(cfg)) return null;
    try {
      return { workspace: d, config: JSON.parse(readText(cfg)) };
    } catch (e) {
      return { workspace: d, config: null, configError: e.message };
    }
  };
  if (explicit) return tryDir(resolve(explicit));
  const proj = tryDir(join(cwd, ".figma-suite"));
  if (proj) return proj;
  const g = join(home(), ".claude", "figma-suite");
  if (existsSync(g)) {
    for (const name of readdirSync(g)) {
      const d = join(g, name);
      if (!statSync(d).isDirectory()) continue;
      const w = tryDir(d);
      if (w?.config?.projectPath && resolve(w.config.projectPath) === resolve(cwd)) return w;
    }
  }
  return null;
}

/** Project root: absolute config.projectPath, or relative to the folder that contains .figma-suite/. */
export function projectRootOf(ws, cwd) {
  const c = ws.config ?? {};
  if (c.mode === "standalone" && !c.projectPath) return null;
  if (!c.projectPath) return cwd;
  if (isAbsolute(c.projectPath)) return c.projectPath;
  const base = basename(ws.workspace) === ".figma-suite" ? resolve(ws.workspace, "..") : ws.workspace;
  return resolve(base, c.projectPath);
}

/** DESIGN.md lives at the project root (codebase mode) or in the workspace (standalone). */
export function resolveDesignMd(ws, projectRoot) {
  const rel = ws.config?.designMdPath;
  const base = projectRoot ?? ws.workspace;
  if (rel) return isAbsolute(rel) ? rel : resolve(base, rel);
  return join(base, "DESIGN.md");
}

/** Hash every token source file listed in config (relative to projectPath). */
export function tokenSourceFiles(config, projectRoot) {
  const list = new Set();
  const add = (p) => p && list.add(p);
  const tp = config?.tokenPaths ?? {};
  Object.values(tp).forEach((arr) => (arr ?? []).forEach(add));
  add(config?.cssVarsPath);
  add(config?.tailwindConfigPath);
  const out = {};
  for (const rel of list) {
    const full = isAbsolute(rel) ? rel : resolve(projectRoot ?? ".", rel);
    out[rel] = existsSync(full) ? sha(readText(full)) : "missing";
  }
  return out;
}

export function loadState(workspace) {
  const p = join(workspace, "state.json");
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readText(p));
  } catch {
    return { version: 1, corrupt: true };
  }
}

/** Version of the installed figma-suite plugin, or null for manual copies. */
export function suiteVersion() {
  try {
    const p = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", ".claude-plugin", "plugin.json");
    return JSON.parse(readText(p)).version ?? null;
  } catch {
    return null;
  }
}

/**
 * The definition of "setup is complete". Returns [{ id, ok, detail }]; check-contract --setup fails on any
 * not-ok item and discover.mjs derives its NEXT line from the same list.
 */
export function setupChecklist(ws, projectRoot) {
  const w = ws.workspace;
  const c = ws.config ?? {};
  const item = (id, ok, detail) => ({ id, ok, detail });
  const mappings = loadMappings(join(w, "component-mappings"));
  const state = loadState(w);
  const designPath = resolveDesignMd(ws, projectRoot);
  const rulesPath = isAbsolute(c.codeRulesPath ?? "") ? c.codeRulesPath : join(w, c.codeRulesPath ?? "code-rules.md");
  const invalid = mappings.entries.filter((m) => m.errors.length).length;
  return [
    item("config", !ws.configError && (c.libraries?.length > 0 || c.designFiles?.length > 0), ws.configError ? `config.json unreadable: ${ws.configError}` : "config.json has no libraries or design files"),
    item("mappings", !mappings.missingDir && mappings.entries.length > 0 && invalid === 0 && !mappings.metaError, mappings.missingDir ? "component-mappings/ missing" : invalid ? `${invalid} mapping file(s) invalid` : "no mapping files"),
    item("generated-docs", ["token-map.generated.md", "component-contracts.generated.md"].every((f) => existsSync(join(w, f))), "token-map.generated.md or component-contracts.generated.md missing"),
    item("code-rules", existsSync(rulesPath), "code-rules.md missing"),
    item("design-md", existsSync(designPath), `DESIGN.md missing (${designPath})`),
    item("legacy-design-rules", !existsSync(join(w, "design-rules.md")), "design-rules.md still present: fold it into DESIGN.md, then rename it to design-rules.md.bak"),
    item("state", !!state && !state.corrupt, state?.corrupt ? "state.json is corrupt" : "state.json missing (written by check-contract --write-state)"),
  ];
}
