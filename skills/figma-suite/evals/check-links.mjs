// Checks that every relative markdown link and #anchor in the skill folder resolves.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const skillDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readme = join(skillDir, "../../README.md");

const files = [];
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (f === "node_modules" || f === "fixtures") continue;
    statSync(p).isDirectory() ? walk(p) : p.endsWith(".md") && files.push(p);
  }
};
walk(skillDir);
if (existsSync(readme)) files.push(readme);

const slug = (h) => h.trim().toLowerCase().replace(/[`*~]/g, "").replace(/<[^>]+>/g, "").replace(/[^\p{L}\p{N}\s_-]/gu, "").replace(/\s/g, "-");
const anchors = new Map();
const anchorsOf = (p) => {
  if (!anchors.has(p)) {
    const set = new Set();
    let fence = false;
    for (const l of readFileSync(p, "utf8").split(/\r?\n/)) {
      if (/^```/.test(l)) fence = !fence;
      const m = !fence && /^#{1,6}\s+(.*)$/.exec(l);
      if (m) set.add(slug(m[1]));
    }
    anchors.set(p, set);
  }
  return anchors.get(p);
};

let bad = 0;
for (const f of files) {
  const text = readFileSync(f, "utf8").replace(/```[\s\S]*?```/g, "");
  for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) {
    const href = m[1];
    if (/^(https?:|mailto:|skill:)/.test(href)) continue;
    const [pathPart, frag] = href.split("#");
    const target = pathPart ? resolve(dirname(f), pathPart) : f;
    if (pathPart && !existsSync(target)) { console.log(`MISSING FILE  ${f.replace(skillDir, "")}: ${href}`); bad++; continue; }
    if (frag && target.endsWith(".md") && !anchorsOf(target).has(frag)) { console.log(`MISSING ANCHOR ${f.replace(skillDir, "")}: ${href}`); bad++; }
  }
}
console.log(bad ? `\n${bad} broken link(s)` : `\nAll links resolve (${files.length} files)`);
process.exit(bad ? 1 : 0);
