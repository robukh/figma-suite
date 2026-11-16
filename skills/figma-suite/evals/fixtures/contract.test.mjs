// check-contract.mjs against the Acme fixture: clean passes, seeded breaks are reported, freshness detects changes.

import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, "../../scripts/check-contract.mjs");
const fixture = join(here, "acme");
const discover = join(here, "../../scripts/discover.mjs");
const next = (dir) => (spawnSync(process.execPath, [discover, "--project", dir], { encoding: "utf8" }).stdout.match(/^NEXT: (.*)$/m) ?? [])[1];

function fresh() {
  const dir = mkdtempSync(join(tmpdir(), "figma-suite-contract-"));
  cpSync(fixture, dir, { recursive: true });
  return dir;
}
function check(dir, ...extra) {
  const r = spawnSync(process.execPath, [script, "--project", dir, "--json", ...extra], { encoding: "utf8" });
  let out = null;
  try { out = JSON.parse(r.stdout); } catch { }
  return { code: r.status, out, ids: new Set((out?.findings ?? []).map((f) => f.id)), stderr: r.stderr };
}
const edit = (file, fn) => writeFileSync(file, fn(readFileSync(file, "utf8").replace(/\r\n/g, "\n")));

let failed = 0;
const expect = (label, cond) => { console.log(`${cond ? "PASS" : "FAIL"}  ${label}`); if (!cond) failed++; };
const dirs = [];

{
  const d = fresh(); dirs.push(d);
  const r = check(d);
  expect("clean fixture passes", r.code === 0 && r.out.errors === 0);
}

{
  const d = fresh(); dirs.push(d);
  const md = join(d, "DESIGN.md");
  edit(md, (t) => t
    .replace("variants: [primary, secondary, ghost]", "variants: [primary, secondary, tertiary]")
    .replace("icon: none", "icon: sideways")
    .replace('textColor: "{colors.on-action}"', 'textColor: "{colors.nope}"')
    .replace("components:\n", 'components:\n  ghost-thing:\n    use: x\n    backgroundColor: "{colors.surface}"\n    textColor: "#cccccc"\n')
    .replace("## Voice and content", "## Tone"));
  writeFileSync(join(d, ".figma-suite/component-mappings/bad.json"), JSON.stringify({ id: "other", status: "matched", code: { path: "src/x.tsx", exportName: "X" } }));
  writeFileSync(join(d, ".figma-suite/component-mappings/uid.json"), JSON.stringify({ id: "uid", status: "figma-only", figma: { fileKey: "a", nodeId: "1:2", componentName: "U", properties: ["Label#4:0"] } }));
  const r = check(d);
  expect("seeded breaks exit 1", r.code === 1);
  for (const id of ["mapping-invalid", "missing-section", "broken-ref", "component-no-mapping", "icon-policy-invalid", "variant-not-in-mapping"]) expect(`reports ${id}`, r.ids.has(id));
  for (const id of ["contrast-ratio", "mapping-dangling-code-path", "mapping-not-in-design"]) expect(`warns ${id}`, r.ids.has(id));
}

{
  const d = fresh(); dirs.push(d);
  const w = check(d, "--write-state");
  expect("--write-state on clean fixture", w.code === 0 && w.ids.has("state-written"));
  expect("fresh right after sync", !check(d).out.findings.some((f) => f.id.startsWith("stale") || f.id === "generated-block-edited"));
  edit(join(d, "src/tokens.css"), (t) => t.replace("#1a56db", "#1d4ed8"));
  edit(join(d, "DESIGN.md"), (t) => t.replace('action-primary: "#1a56db"', 'action-primary: "#000000"'));
  edit(join(d, ".figma-suite/component-mappings/button.json"), (t) => t.replace('"Sm": "sm"', '"Sm": "sm", "Lg": "lg"'));
  const r = check(d);
  for (const id of ["stale-tokens", "generated-block-edited", "stale-mapping"]) expect(`detects ${id}`, r.ids.has(id));
  expect("--strict turns warnings into failure", check(d, "--strict").code === 1);
  const blocked = (() => { edit(join(d, "DESIGN.md"), (t) => t.replace("## Overview", "## Intro")); return check(d, "--write-state"); })();
  expect("state is not written when errors exist", blocked.code === 1 && !blocked.ids.has("state-written"));
}

// setup: the done-test and the NEXT line
{
  const d = fresh(); dirs.push(d);
  const ws = join(d, ".figma-suite");
  expect("complete workspace without state.json fails only on state", (() => { const r = check(d, "--setup"); const bad = (r.out?.findings ?? []).filter((f) => f.id.startsWith("setup-")).map((f) => f.id); return r.code === 1 && bad.join() === "setup-state"; })());
  const done = check(d, "--setup", "--write-state");
  expect("--setup --write-state passes on a complete workspace", done.code === 0 && done.ids.has("state-written"));
  expect("NEXT is none when fresh", next(d) === "none (fresh)");

  // a 1.x workspace: no DESIGN.md, legacy design-rules.md, no state.json
  const v1 = fresh(); dirs.push(v1);
  const v1ws = join(v1, ".figma-suite");
  rmSync(join(v1, "DESIGN.md"));
  writeFileSync(join(v1ws, "design-rules.md"), "# Design rules\n\nSpacing 8px. No shadows.\n");
  edit(join(v1ws, "config.json"), (t) => t.replace(/ *"designMdPath": "DESIGN.md",\n/, "").replace('"generatedAt"', '"skill": { "version": "1.4.0" },\n  "generatedAt"'));
  expect("v1 workspace: NEXT is setup with the missing items", next(v1) === "setup (upgrade; incomplete: design-md, legacy-design-rules, state)");
  const bad = check(v1, "--setup");
  expect("v1 workspace fails --setup", bad.code === 1 && ["setup-design-md", "setup-legacy-design-rules", "setup-state"].every((id) => bad.ids.has(id)));
  // what a finished upgrade looks like
  cpSync(join(fixture, "DESIGN.md"), join(v1, "DESIGN.md"));
  renameSync(join(v1ws, "design-rules.md"), join(v1ws, "design-rules.md.bak"));
  const ok = check(v1, "--setup", "--write-state");
  expect("upgraded v1 workspace passes --setup", ok.code === 0 && existsSync(join(v1ws, "state.json")));
  expect("upgraded v1 workspace: NEXT is none", next(v1) === "none (fresh)");
  expect("no workspace: NEXT is setup", next(mkdtempSync(join(tmpdir(), "figma-suite-empty-"))) === "setup");
}

// standalone lint of a lone DESIGN.md (no workspace)
{
  const d = mkdtempSync(join(tmpdir(), "figma-suite-lone-")); dirs.push(d);
  cpSync(join(fixture, "DESIGN.md"), join(d, "DESIGN.md"));
  const r = spawnSync(process.execPath, [script, "--design-md", join(d, "DESIGN.md"), "--project", d, "--json"], { encoding: "utf8" });
  const out = JSON.parse(r.stdout);
  expect("--design-md lints a lone file (exit 0, mappings only warn)", r.status === 0 && out.errors === 0 && out.findings.some((f) => f.id === "component-no-mapping" && f.level === "warn"));
}

for (const d of dirs) rmSync(d, { recursive: true, force: true });
console.log(failed ? `\n${failed} check(s) failed` : "\nAll contract checks passed");
process.exit(failed ? 1 : 0);
