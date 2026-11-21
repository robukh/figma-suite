#!/usr/bin/env node
// Checks token sources <-> DESIGN.md <-> component-mappings/*.json.
//   node check-contract.mjs [--workspace DIR] [--project DIR] [--design-md FILE] [--json] [--strict]
//                           [--write-state] [--force] [--no-freshness] [--setup]
// Exit: 0 ok, 1 errors (or warnings with --strict), 2 usage. --write-state records hashes after a clean sync.
// --setup also requires the whole workspace to exist (the "done" test for setup).

import { existsSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  TOKEN_ROOTS,
  collectRefs,
  contrast,
  findWorkspace,
  loadMappings,
  loadState,
  parseDesignMd,
  parseHex,
  projectRootOf,
  readText,
  resolveDesignMd,
  resolveRef,
  setupChecklist,
  suiteVersion,
  tokenSourceFiles,
} from "./lib.mjs";

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};

if (flag("--help") || flag("-h")) {
  console.log("usage: node check-contract.mjs [--workspace DIR] [--project DIR] [--json] [--strict] [--write-state] [--force] [--no-freshness] [--setup]");
  process.exit(0);
}

const projectArg = opt("--project");
const cwd = resolve(projectArg ?? process.cwd());
let ws = findWorkspace(cwd, opt("--workspace"));
const designArg = opt("--design-md");
if (designArg) {
  // lone-file lint: mapping checks degrade to warnings
  const abs = resolve(designArg);
  ws = ws ? { ...ws, config: { ...(ws.config ?? {}), designMdPath: abs } } : { workspace: dirname(abs), config: { mode: "standalone", designMdPath: abs } };
}
if (!ws) {
  console.error("No figma-suite workspace found (looked for .figma-suite/config.json, ~/.figma-suite/* and legacy ~/.claude/figma-suite/*). Run /figma-suite setup (or ask your agent to use the figma-suite skill for setup), or lint one file with --design-md PATH.");
  process.exit(2);
}

const findings = [];
const add = (level, id, where, message) => findings.push({ level, id, where, message });

if (ws.configError) add("error", "config-invalid", "config.json", `could not parse: ${ws.configError}`);
const config = ws.config ?? {};
const projectRoot = projectRootOf(ws, cwd);

// mapping
const mappingDir = join(ws.workspace, "component-mappings");
const mapping = loadMappings(mappingDir);
if (mapping.missingDir) add("warn", "mapping-missing", "component-mappings/", "directory not found — run setup");
for (const m of mapping.entries) for (const e of m.errors) add("error", "mapping-invalid", `component-mappings/${m.file}`, e);
if (mapping.metaError) add("error", "mapping-meta", "component-mappings/_meta.json", mapping.metaError);
if (projectRoot) {
  for (const m of mapping.entries) {
    const p = m.entry?.code?.path;
    if (p && !existsSync(resolve(projectRoot, p))) add("warn", "mapping-dangling-code-path", `component-mappings/${m.file}`, `code.path "${p}" does not exist`);
  }
}
const byId = new Map(mapping.entries.filter((m) => m.entry && typeof m.entry.id === "string").map((m) => [m.entry.id, m]));

// DESIGN.md
const REQUIRED = ["overview", "colors", "typography", "layout", "components", "voice and content", "project decisions", "dos and donts"];
const ORDER = ["overview", "colors", "typography", "layout", "elevation", "shapes", "components"];
const ICON_VALUES = ["none", "leading", "trailing", "icon-only"];

const designPath = resolveDesignMd(ws, projectRoot);
let design = null;
if (!existsSync(designPath)) {
  add("warn", "design-missing", designPath, "DESIGN.md not found — run /figma-suite design-md (or setup)");
} else {
  design = parseDesignMd(readText(designPath));
  const where = "DESIGN.md";
  if (!design.hasFront) add("error", "design-front-matter", where, "missing YAML front matter (--- ... ---)");
  if (design.parseError) add("error", "design-parse", where, `front matter: ${design.parseError}`);

  const have = new Set(design.sections.map((s) => s.key));
  for (const r of REQUIRED) if (!have.has(r)) add("error", "missing-section", where, `required section "## ${r}" not found`);
  const idx = ORDER.filter((k) => have.has(k)).map((k) => design.sections.findIndex((s) => s.key === k));
  if (idx.some((v, i) => i > 0 && v < idx[i - 1])) add("warn", "section-order", where, `sections should follow: ${ORDER.join(" > ")}`);

  const d = design.data;
  if (!d.name) add("warn", "missing-name", where, "front matter has no `name`");
  if (d.mode && !["operate", "consumer", "persuade", "read"].includes(d.mode)) add("error", "invalid-mode", where, `mode must be operate | consumer | persuade | read (got "${d.mode}")`);
  if (!d.mode) add("warn", "missing-mode", where, "front matter has no `mode` (operate | consumer | persuade | read)");
  if (!d.colors || !Object.keys(d.colors).length) add("warn", "missing-colors", where, "no `colors` tokens");

  for (const root of ["components", ...TOKEN_ROOTS]) {
    for (const ref of collectRefs(d[root])) {
      if (!TOKEN_ROOTS.includes(ref.split(".")[0]) || resolveRef(d, ref) === undefined) {
        add("error", "broken-ref", where, `{${ref}} does not resolve to a token`);
      }
    }
  }
  const hexOf = (v) => {
    const m = typeof v === "string" ? /^\{(.+)\}$/.exec(v) : null;
    const r = m ? resolveRef(d, m[1]) : v;
    return parseHex(typeof r === "string" ? r : null);
  };

  const comps = d.components && typeof d.components === "object" ? d.components : {};
  for (const [id, c] of Object.entries(comps)) {
    if (!c || typeof c !== "object") continue;
    const m = byId.get(id);
    if (!m) {
      add(mapping.missingDir ? "warn" : "error", "component-no-mapping", where, `components.${id} has no component-mappings/${id}.json`);
    }
    if (c.icon !== undefined && !ICON_VALUES.includes(c.icon)) add("error", "icon-policy-invalid", where, `components.${id}.icon must be one of ${ICON_VALUES.join(" | ")}`);
    const bg = hexOf(c.backgroundColor);
    const fg = hexOf(c.textColor);
    if (bg && fg) {
      const ratio = contrast(bg, fg);
      if (ratio < 4.5) add("warn", "contrast-ratio", where, `components.${id}: text/background contrast ${ratio.toFixed(2)}:1 is below 4.5:1`);
    }
    if (m?.entry && Array.isArray(c.variants)) {
      const known = new Set();
      for (const p of m.entry.propertyMap ?? []) {
        if (p.kind !== "enum" || !p.values) continue;
        for (const [fv, cv] of Object.entries(p.values)) {
          known.add(String(fv).toLowerCase());
          known.add(String(cv).toLowerCase());
        }
      }
      if (!known.size) add("warn", "variant-unverifiable", where, `components.${id}.variants set, but its mapping has no enum values to check against`);
      else for (const v of c.variants) if (!known.has(String(v).toLowerCase())) add("error", "variant-not-in-mapping", where, `components.${id}.variants "${v}" is not a value in component-mappings/${id}.json`);
    }
  }
  for (const [id, m] of byId) {
    if (comps[id]) continue;
    if (["matched", "split", "merged", "diverged"].includes(m.entry.status)) add("warn", "mapping-not-in-design", where, `mapping "${id}" (${m.entry.status}) has no entry under components: — add usage policy`);
  }

  const sectionBody = (key) => {
    const i = design.sections.findIndex((s) => s.key === key);
    if (i < 0) return null;
    const start = design.sections[i].index;
    const end = design.sections[i + 1]?.index ?? design.body.length;
    return design.body.slice(start, end).split("\n").slice(1).join("\n").trim();
  };
  for (const key of ["project decisions", "voice and content"]) {
    const body = sectionBody(key);
    if (body !== null && body.length < 20) add("warn", "empty-section", where, `"## ${key}" is empty — record the decisions that override anti-slop defaults`);
  }
}

// freshness
const tokenFiles = tokenSourceFiles(config, projectRoot);
const currentState = {
  version: 1,
  suiteVersion: suiteVersion(),
  syncedAt: new Date().toISOString(),
  tokens: { files: tokenFiles },
  designMd: { blocks: design?.blocks ?? {} },
  mappings: Object.fromEntries(mapping.entries.map((m) => [m.id, m.hash])),
};
if (!flag("--no-freshness")) {
  const prev = loadState(ws.workspace);
  if (!prev) add("info", "no-state", "state.json", "no sync state recorded yet (written after the first successful sync)");
  else if (prev.corrupt) add("warn", "state-corrupt", "state.json", "could not parse — re-run sync to rewrite it");
  else {
    const changedTokens = Object.entries(tokenFiles).filter(([f, h]) => prev.tokens?.files?.[f] !== h).map(([f]) => f);
    const removed = Object.keys(prev.tokens?.files ?? {}).filter((f) => !(f in tokenFiles));
    if (changedTokens.length || removed.length) add("warn", "stale-tokens", "token sources", `changed since last sync: ${[...changedTokens, ...removed.map((f) => `${f} (removed)`)].join(", ")} — run sync`);
    for (const [name, h] of Object.entries(design?.blocks ?? {})) {
      const was = prev.designMd?.blocks?.[name];
      if (was && was !== h) add("warn", "generated-block-edited", "DESIGN.md", `generated block "${name}" was edited since last sync; sync will overwrite it — move hand edits to an authored section`);
    }
    const ids = new Set([...Object.keys(prev.mappings ?? {}), ...Object.keys(currentState.mappings)]);
    const changed = [...ids].filter((id) => prev.mappings?.[id] !== currentState.mappings[id]);
    if (changed.length) add("warn", "stale-mapping", "component-mappings/", `changed since last sync: ${changed.join(", ")} — DESIGN.md components may need review`);
  }
}

// state.json is written first (only after a clean lint), so the setup checklist below can count it
if (flag("--write-state")) {
  if (findings.some((f) => f.level === "error") && !flag("--force")) {
    console.error("Not writing state.json: fix the errors first (or pass --force).");
  } else {
    writeFileSync(join(ws.workspace, "state.json"), JSON.stringify(currentState, null, 2) + "\n");
    findings.push({ level: "info", id: "state-written", where: "state.json", message: "recorded token, DESIGN.md and mapping hashes" });
  }
}

let checklist = null;
if (flag("--setup")) {
  checklist = setupChecklist(ws, projectRoot);
  for (const it of checklist) if (!it.ok) add("error", `setup-${it.id}`, "workspace", it.detail);
}

const errors = findings.filter((f) => f.level === "error");
const warns = findings.filter((f) => f.level === "warn");
const failed = errors.length > 0 || (flag("--strict") && warns.length > 0);

if (flag("--json")) {
  console.log(JSON.stringify({ workspace: ws.workspace, designMd: design ? designPath : null, ok: !failed, setup: checklist, errors: errors.length, warnings: warns.length, findings }, null, 2));
} else {
  for (const it of checklist ?? []) console.log(`${it.ok ? "PASS" : "FAIL"}  setup: ${it.id}`);
  for (const f of findings) console.log(`[${f.level}] ${f.id}  ${f.where}: ${f.message}`);
  const n = mapping.entries.length;
  console.log(failed ? `\nContract check FAILED — ${errors.length} error(s), ${warns.length} warning(s), ${n} mapping file(s).` : `\nContract OK — ${n} mapping file(s), ${warns.length} warning(s).`);
}
process.exit(failed ? 1 : 0);
