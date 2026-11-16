#!/usr/bin/env node
// Prints a project/workspace snapshot for the router. Never throws.  node discover.mjs [--project DIR]

import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { findWorkspace, loadMappings, loadState, parseDesignMd, projectRootOf, readText, resolveDesignMd, setupChecklist, suiteVersion, tokenSourceFiles } from "./lib.mjs";

const args = process.argv.slice(2);
const i = args.indexOf("--project");
const cwd = resolve(i >= 0 ? args[i + 1] : process.cwd());
const out = [];
const line = (s = "") => out.push(s);

try {
  const ws = findWorkspace(cwd);
  if (!ws) {
    line("figma-suite workspace: NONE found");
    line("NEXT: setup");
    const hints = [];
    for (const p of ["design-tokens", "tokens", "tailwind.config.ts", "tailwind.config.js", "src/global.css", "src/styles/globals.css", "app/globals.css", "theme.ts", "theme.js", "DESIGN.md"]) {
      if (existsSync(join(cwd, p))) hints.push(p);
    }
    line(`token/design hints in ${cwd}: ${hints.length ? hints.join(", ") : "none"}`);
  } else {
    const c = ws.config ?? {};
    const projectRoot = projectRootOf(ws, cwd);
    line(`workspace: ${ws.workspace}${ws.configError ? `  (config.json unreadable: ${ws.configError})` : ""}`);
    line(`project: ${c.name ?? "?"} | mode: ${c.mode ?? "?"} | platform: ${c.platform ?? "?"} | naming: ${c.namingPreset ?? "?"}`);
    line(`libraries: ${(c.libraries ?? []).map((l) => `${l.name || "?"} (${l.fileKey})`).join(", ") || "none"}`);
    line(`design files: ${(c.designFiles ?? []).map((l) => `${l.name || "?"} (${l.fileKey})`).join(", ") || "none"}`);

    const m = loadMappings(join(ws.workspace, "component-mappings"));
    const statusCount = {};
    for (const e of m.entries) statusCount[e.entry?.status ?? "invalid"] = (statusCount[e.entry?.status ?? "invalid"] ?? 0) + 1;
    line(`mappings: ${m.entries.length} file(s) ${JSON.stringify(statusCount)}${m.entries.some((e) => e.errors.length) ? "  !! some invalid — run check-contract" : ""}`);

    const dp = resolveDesignMd(ws, projectRoot);
    if (existsSync(dp)) {
      const d = parseDesignMd(readText(dp));
      line(`DESIGN.md: ${dp} | mode: ${d.data.mode ?? "?"} | components: ${Object.keys(d.data.components ?? {}).length} | sections: ${d.sections.length}`);
    } else line(`DESIGN.md: MISSING (${dp})`);

    const state = loadState(ws.workspace);
    const stale = [];
    if (!state) stale.push("no sync state yet");
    else if (state.corrupt) stale.push("state.json corrupt");
    else {
      const tf = tokenSourceFiles(c, projectRoot);
      const ch = Object.entries(tf).filter(([f, h]) => state.tokens?.files?.[f] !== h).map(([f]) => f);
      if (ch.length) stale.push(`token sources changed: ${ch.join(", ")}`);
      const ids = new Set([...Object.keys(state.mappings ?? {}), ...m.entries.map((e) => e.id)]);
      const mc = [...ids].filter((id) => state.mappings?.[id] !== m.entries.find((e) => e.id === id)?.hash);
      if (mc.length) stale.push(`mapping changed: ${mc.join(", ")}`);
      if (existsSync(dp)) {
        const d = parseDesignMd(readText(dp));
        for (const [n, h] of Object.entries(d.blocks)) if (state.designMd?.blocks?.[n] && state.designMd.blocks[n] !== h) stale.push(`DESIGN.md generated block "${n}" hand-edited`);
      }
    }
    line(`contract: ${stale.length ? `STALE -> ${stale.join("; ")}` : "fresh"}`);
    line(`last sync: ${state?.syncedAt ?? "never"}`);

    const missing = setupChecklist(ws, projectRoot).filter((it) => !it.ok).map((it) => it.id);
    const was = c.skill?.version ?? c.generatedAt?.slice(0, 10) ?? "unknown";
    line(`figma-suite: ${suiteVersion() ?? "manual copy"} | workspace last set up with: ${was}`);
    line(missing.length ? `NEXT: setup (upgrade; incomplete: ${missing.join(", ")})` : stale.length ? "NEXT: sync" : "NEXT: none (fresh)");
  }
} catch (e) {
  line(`discover.mjs: ${e.message}`);
}
console.log(out.join("\n"));
