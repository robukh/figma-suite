#!/usr/bin/env node
// Optional, on-demand validator for component-mapping.json.
//
// Usage:   node validate.mjs <path-to-component-mapping.json>
// First run, install the lone dependency (scoped to this folder only):
//          cd skills/figma-suite/schema && npm install
//
// The Zod schema below is the runnable copy of the canonical schema documented
// in ../reference/mapping-schema.md. Keep the two in sync (and mapping.schema.json).
// This is the ONLY part of the skill that uses a runtime dependency.

import { readFileSync } from "node:fs";
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

const ComponentEntry = z
  .object({
    id: z.string(),
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

const ComponentMapping = z.object({
  $schema: z.string().optional(),
  version: z.literal(1),
  generatedAt: z.string(),
  components: z.array(ComponentEntry),
});

const path = process.argv[2];
if (!path) {
  console.error("usage: node validate.mjs <path-to-component-mapping.json>");
  process.exit(2);
}

let data;
try {
  data = JSON.parse(readFileSync(path, "utf8"));
} catch (err) {
  console.error(`Could not read/parse ${path}: ${err.message}`);
  process.exit(2);
}

const result = ComponentMapping.safeParse(data);
if (result.success) {
  console.log(`OK — ${result.data.components.length} component(s) valid.`);
  process.exit(0);
}

console.error("Validation FAILED:");
for (const issue of result.error.issues) {
  const where = issue.path.length ? issue.path.join(".") : "(root)";
  console.error(`  - ${where}: ${issue.message}`);
}
process.exit(1);
