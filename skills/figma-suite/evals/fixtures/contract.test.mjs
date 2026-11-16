// check-contract.mjs against the Acme fixture: clean passes, seeded breaks are reported, freshness detects changes.

import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, "../../scripts/check-contract.mjs");
const fixture = join(here, "acme");

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
