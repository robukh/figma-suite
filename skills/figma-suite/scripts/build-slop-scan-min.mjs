#!/usr/bin/env node
// Builds scripts/slop-scan.min.js from slop-scan.js (needs bun). Rebuild after editing slop-scan.js.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "slop-scan.js"), "utf8").replace(/\r\n/g, "\n");

const sep = src.indexOf("\n// ----");
if (sep < 0) throw new Error("could not find the end of the constants header");
const header = src.slice(0, sep).trimEnd();
const body = src.slice(src.indexOf("async function scanRoot"));
const consts = ["ROOT_IDS", "PLATFORM", "CASING", "SCALE_BASE", "ALLOW", "MAX_FINDINGS"];
if (!consts.every((c) => new RegExp(`const ${c} =`).test(header))) throw new Error("constants header changed; update the build script");

const fnEnd = body.lastIndexOf("\n}\n");
const fn = body.slice(0, fnEnd + 2);

const tmp = mkdtempSync(join(tmpdir(), "slopmin-"));
try {
  writeFileSync(join(tmp, "in.js"), `const __scan = async function (${consts.join(", ")}) {\n${fn.replace(/^async function scanRoot\(ROOT_ID\) \{/, "const scanRoot = async (ROOT_ID) => {").replace(/\n\}\s*$/, "\n};\nconst results = [];\nfor (const id of ROOT_IDS) results.push(await scanRoot(id));\nreturn results.length === 1 ? results[0] : { results };")}\n};\nexport { __scan };\n`);
  execFileSync("bun", ["build", join(tmp, "in.js"), "--minify", "--outfile", join(tmp, "out.js")], { stdio: "pipe" });
  let out = readFileSync(join(tmp, "out.js"), "utf8").trim();
  const m = /export\s*\{\s*(\w+)\s+as\s+__scan\s*\}\s*;?$/.exec(out);
  if (!m) throw new Error("unexpected bundle shape");
  out = out.slice(0, m.index).trim();
  const result = `${header}\n// Minified build of slop-scan.js. Paste the whole file; edit only the constants above.\n${out}\nreturn await ${m[1]}(${consts.join(", ")});\n`;
  writeFileSync(join(here, "slop-scan.min.js"), result);
  console.log(`slop-scan.js ${src.length} bytes -> slop-scan.min.js ${result.length} bytes`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
