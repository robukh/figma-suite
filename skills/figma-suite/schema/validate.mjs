#!/usr/bin/env node
// Optional, on-demand validator for the per-component mapping files.
//
// Usage:   node validate.mjs <component-mappings-dir | single-entry.json>
//          - directory form: validates every {id}.json in the dir as a
//            ComponentEntry, skips _*.json (e.g. _meta.json — validated separately),
//            and runs cross-file checks (filename == id, no duplicate ids).
//          - single-file form: validates one {id}.json as a ComponentEntry.
// First run, install the lone dependency (scoped to this folder only):
//          cd skills/figma-suite/schema && npm install
//
// The Zod schema below is the runnable copy of the canonical schema documented
// in ../reference/mapping-schema.md. Keep the two in sync (and mapping.schema.json
// + meta.schema.json). This is the ONLY part of the skill that uses a runtime dependency.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { z } from "zod";

const ValueMap = z.record(
  z.string(),
  z.union([z.string(), z.boolean(), z.number()])
);

const PropertyMapEntry = z
  .object({
    codeProp: z.string().optional(),
    figmaProp: z.string().optional(),
    kind: z.enum(["enum", "boolean", "text", "instanceSwap", "slot"]),
    values: ValueMap.optional(),
    booleanMap: z.object({ true: z.string(), false: z.string() }).optional(),
    required: z.boolean().default(false),
    notes: z.string().optional(),
  })
  .refine((p) => p.codeProp != null || p.figmaProp != null, {
    message: "propertyMap entry must have codeProp, figmaProp, or both",
  });

const CodeSide = z.object({
  path: z.string(),
  exportName: z.string(),
  props: z.array(z.string()).default([]),
});

const FigmaSide = z.object({
  fileKey: z.string(),
  nodeId: z.string(),
  componentName: z.string(),
  properties: z.array(z.string()).default([]),
  published: z.boolean().default(false),
});

const Status = z.enum([
  "matched",
  "code-only",
  "figma-only",
  "split",
  "merged",
  "diverged",
]);

// A single per-component file is a standalone ComponentEntry (no array wrapper).
// `id` must be a filesystem-safe kebab-case slug so it can be the filename.
const ComponentEntry = z
  .object({
    $schema: z.string().optional(),
    id: z
      .string()
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/i,
        "id must be a filename-safe slug (letters, digits, hyphens)"
      ),
    status: Status,
    code: CodeSide.optional(),
    figma: z.union([FigmaSide, z.array(FigmaSide)]).optional(),
    propertyMap: z.array(PropertyMapEntry).default([]),
    notes: z.string().optional(),
  })
  .superRefine((entry, ctx) => {
    const hasCode = entry.code != null;
    const hasFigma = entry.figma != null;
    if (entry.status === "code-only" && hasFigma)
      ctx.addIssue({ code: "custom", message: "code-only entry must not have a figma side" });
    if (entry.status === "figma-only" && hasCode)
      ctx.addIssue({ code: "custom", message: "figma-only entry must not have a code side" });
    if (entry.status === "matched" && (!hasCode || !hasFigma))
      ctx.addIssue({ code: "custom", message: "matched entry must have both code and figma sides" });
  });

// Optional component-mappings/_meta.json: schema-version + last-generation timestamp.
const Meta = z.object({
  $schema: z.string().optional(),
  version: z.literal(1),
  generatedAt: z.string(),
});

const fmt = (issue) =>
  `${issue.path.length ? issue.path.join(".") : "(root)"}: ${issue.message}`;

const arg = process.argv[2];
if (!arg) {
  console.error("usage: node validate.mjs <component-mappings-dir | single-entry.json>");
  process.exit(2);
}

let st;
try {
  st = statSync(arg);
} catch (err) {
  console.error(`Cannot access ${arg}: ${err.message}`);
  process.exit(2);
}

const failures = []; // { file, issues: string[] }
let validCount = 0;

// Validate one file as a ComponentEntry. When expectId is given (dir mode),
// also assert filename == id. Returns the parsed id, or undefined on failure.
function validateEntryFile(fullPath, displayName, expectId) {
  let data;
  try {
    data = JSON.parse(readFileSync(fullPath, "utf8"));
  } catch (err) {
    failures.push({ file: displayName, issues: [`could not parse: ${err.message}`] });
    return undefined;
  }

  const result = ComponentEntry.safeParse(data);
  if (!result.success) {
    failures.push({ file: displayName, issues: result.error.issues.map(fmt) });
    return undefined;
  }

  if (expectId !== undefined && result.data.id !== expectId) {
    failures.push({
      file: displayName,
      issues: [`filename "${displayName}" does not match id "${result.data.id}"`],
    });
    return undefined;
  }

  validCount++;
  return result.data.id;
}

if (st.isDirectory()) {
  const entryFiles = readdirSync(arg).filter(
    (f) => f.endsWith(".json") && !f.startsWith("_")
  );

  const seenIds = new Map(); // id -> filename (duplicate detection)
  for (const f of entryFiles) {
    const id = validateEntryFile(join(arg, f), f, basename(f, ".json"));
    if (id !== undefined) {
      if (seenIds.has(id)) {
        failures.push({
          file: f,
          issues: [`duplicate id "${id}" (also in ${seenIds.get(id)})`],
        });
      } else {
        seenIds.set(id, f);
      }
    }
  }

  // Optional _meta.json
  try {
    const metaRaw = readFileSync(join(arg, "_meta.json"), "utf8");
    const metaResult = Meta.safeParse(JSON.parse(metaRaw));
    if (!metaResult.success) {
      failures.push({ file: "_meta.json", issues: metaResult.error.issues.map(fmt) });
    }
  } catch {
    // _meta.json absent (or unreadable) — it is optional, so this is fine.
  }

  if (failures.length === 0) {
    const note = entryFiles.length === 0 ? " (no component files found)" : "";
    console.log(`OK — ${validCount} component(s) valid in ${arg}${note}`);
    process.exit(0);
  }
} else {
  // Single-file form: validate one entry; filename==id still applies.
  validateEntryFile(arg, basename(arg), basename(arg, ".json"));
  if (failures.length === 0) {
    console.log(`OK — 1 component valid.`);
    process.exit(0);
  }
}

console.error("Validation FAILED:");
for (const { file, issues } of failures) {
  console.error(file);
  for (const msg of issues) console.error(`  - ${msg}`);
}
process.exit(1);
