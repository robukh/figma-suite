# Component Mapping Schema

The single source of truth for `component-mapping.json` — the machine-readable file that tracks the relationship between code components and Figma components, including **property-level** and **value-level** mapping.

This file lives in the workspace folder alongside `config.json` (see [config-schema.md](config-schema.md)). It replaces the old prose `component-mapping.generated.md` table. Drift reports are rendered on the fly during `sync`; the JSON is the durable artifact.

> **Why JSON, not prose:** the loop (`/figma-suite sync`) diffs the live Figma component properties and the live code props against this file. That diff is only reliable if the mapping is structured — including which code prop corresponds to which Figma property, and how their *values* translate (e.g. code `style="primary"` ↔ Figma `Type=Primary`).

---

## Zod schema (canonical)

This is the authoritative structure. The agent MUST validate any `component-mapping.json` it writes against this schema (by inspection at minimum — see [Validation](#validation)). The committed `schema/mapping.schema.json` is generated from this and is what editors use via `$schema`.

```ts
import { z } from "zod";

// One value-level mapping: a Figma-side value string -> the code-side value.
// Direction is figmaValue -> codeValue because reads from Figma are the common
// case (a designer renames "Primary"; code still says "primary").
const ValueMap = z.record(
  z.string(),
  z.union([z.string(), z.boolean(), z.number()])
);

// One property bridge: links one code prop to one figma property.
// Either side may be absent (a code-only prop, or a figma property with no code
// counterpart) but at least one must be present.
const PropertyMapEntry = z
  .object({
    codeProp: z.string().optional(),    // e.g. "style"
    figmaProp: z.string().optional(),   // e.g. "Type"  (BASE name, NO #uid suffix)
    kind: z.enum(["enum", "boolean", "text", "instanceSwap", "slot"]),
    // Only meaningful for "enum" (and optionally "boolean"): figmaValue -> codeValue.
    values: ValueMap.optional(),
    // For "boolean" when the code side is not a literal boolean.
    booleanMap: z.object({ true: z.string(), false: z.string() }).optional(),
    required: z.boolean().default(false),
    notes: z.string().optional(),
  })
  .refine((p) => p.codeProp != null || p.figmaProp != null, {
    message: "propertyMap entry must have codeProp, figmaProp, or both",
  });

const CodeSide = z.object({
  path: z.string(),                     // relative to projectPath, e.g. "src/components/ui/Button.tsx"
  exportName: z.string(),               // e.g. "Button"
  props: z.array(z.string()).default([]), // flat prop-name list for quick reference
});

const FigmaSide = z.object({
  fileKey: z.string(),
  nodeId: z.string(),                   // component / component-set node id
  componentName: z.string(),           // e.g. "Button"
  // BASE property names as they appear in Figma (no #uid suffix — that is
  // volatile and discovered at runtime; persisting it would break across rebuilds).
  properties: z.array(z.string()).default([]),
  published: z.boolean().default(false), // gates Code Connect eligibility (see below)
});

const Status = z.enum([
  "matched",    // both sides exist — keep in sync
  "code-only",  // exists in code, no Figma counterpart (hooks, wrappers, logic-only)
  "figma-only", // exists in Figma, no code counterpart (illustrations, decorative)
  "split",      // one code component -> multiple Figma components (figma is an array)
  "merged",     // multiple code components -> one Figma component
  "diverged",   // both exist but intentionally differ (document in notes)
]);

const ComponentEntry = z
  .object({
    id: z.string(),                     // stable slug key, e.g. "button"
    status: Status,
    code: CodeSide.optional(),          // omit for figma-only
    figma: z.union([FigmaSide, z.array(FigmaSide)]).optional(), // array models "split"
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

export const ComponentMapping = z.object({
  $schema: z.string().optional(),       // points at schema/mapping.schema.json
  version: z.literal(1),
  generatedAt: z.string(),              // ISO 8601
  components: z.array(ComponentEntry),
});

export type ComponentMapping = z.infer<typeof ComponentMapping>;
```

### Field notes

- **`code` and `figma` are independently optional.** This is what makes the mapping flexible: `code-only` and `figma-only` components are first-class, not awkward special cases.
- **`propertyMap` decouples names.** `codeProp: "style"` ↔ `figmaProp: "Type"` is the canonical example. Either side may be omitted for a one-sided property.
- **`values` is `figmaValue → codeValue`.** Covers renames (`"Primary" → "primary"`) and many-to-one collapses.
- **`figma` may be an array** to model `split` (one code component → several Figma components). `merged` is modeled by two code entries pointing at the same `figma.nodeId`, with a note.
- **Never persist the `#uid` suffix.** Figma TEXT/BOOLEAN/INSTANCE_SWAP/SLOT property keys carry a volatile `#uid` suffix (e.g. `Label#4:0`) — see [component-contracts.md](component-contracts.md#component-property-keys). Store only the base name (`Label`); rediscover the suffix at runtime via `componentPropertyDefinitions`.

---

## Example `component-mapping.json`

```json
{
  "$schema": "../../skills/figma-suite/schema/mapping.schema.json",
  "version": 1,
  "generatedAt": "2026-06-20T10:00:00Z",
  "components": [
    {
      "id": "button",
      "status": "matched",
      "code": {
        "path": "src/components/ui/Button.tsx",
        "exportName": "Button",
        "props": ["style", "size", "disabled", "label", "icon"]
      },
      "figma": {
        "fileKey": "abc123",
        "nodeId": "12:345",
        "componentName": "Button",
        "properties": ["Type", "Size", "Disabled", "Label", "Icon"],
        "published": true
      },
      "propertyMap": [
        {
          "codeProp": "style", "figmaProp": "Type", "kind": "enum",
          "values": { "Primary": "primary", "Secondary": "secondary", "Ghost": "ghost" },
          "required": true
        },
        {
          "codeProp": "size", "figmaProp": "Size", "kind": "enum",
          "values": { "Sm": "sm", "Md": "md", "Lg": "lg" }
        },
        { "codeProp": "disabled", "figmaProp": "Disabled", "kind": "boolean" },
        { "codeProp": "label", "figmaProp": "Label", "kind": "text" },
        { "codeProp": "icon", "figmaProp": "Icon", "kind": "instanceSwap" }
      ]
    },
    {
      "id": "card",
      "status": "matched",
      "code": {
        "path": "src/components/ui/Card.tsx",
        "exportName": "Card",
        "props": ["children"]
      },
      "figma": {
        "fileKey": "abc123",
        "nodeId": "12:400",
        "componentName": "Card",
        "properties": ["Content"],
        "published": true
      },
      "propertyMap": [
        { "codeProp": "children", "figmaProp": "Content", "kind": "slot" }
      ]
    },
    {
      "id": "use-toast",
      "status": "code-only",
      "code": { "path": "src/hooks/useToast.ts", "exportName": "useToast", "props": [] },
      "propertyMap": [],
      "notes": "Logic-only hook; no Figma representation."
    },
    {
      "id": "hero-illustration",
      "status": "figma-only",
      "figma": {
        "fileKey": "abc123", "nodeId": "88:12",
        "componentName": "Hero Illustration", "properties": ["Theme"], "published": true
      },
      "propertyMap": [],
      "notes": "Decorative; no code equivalent."
    }
  ]
}
```

---

## Validation

The mapping is validated two ways. The default path needs **no runtime**.

1. **By inspection (default, runtime-free).** Whenever the agent writes or edits `component-mapping.json`, it MUST check the result against the Zod schema above — status invariants (`matched` needs both sides; `code-only` forbids a figma side; `figma-only` forbids a code side), every `propertyMap` entry has `codeProp`, `figmaProp`, or both, and every `kind` is one of the five allowed values. This is the same structural reasoning the skill already applies to config.

2. **Hard check (optional, on demand).** If `node` is available and the user wants a guaranteed machine validation, run:
   ```
   node skills/figma-suite/schema/validate.mjs <workspace>/component-mapping.json
   ```
   The first run installs `zod` into `schema/` only (`cd skills/figma-suite/schema && npm install`). It prints `OK` or a list of validation errors. This is the **only** time the skill touches a runtime dependency — the skill root stays zero-dependency.

Editors that honor `$schema` will also surface errors live against `schema/mapping.schema.json` while the user hand-edits the file.

---

## Code Connect bridge (optional, auto-detected)

`propertyMap` is a deliberate superset of [Figma Code Connect](https://developers.figma.com/docs/code-connect) property mappers, so the same mapping compiles **into** Code Connect when the user is eligible, and works fully standalone when not.

| `kind` | Code Connect emission |
|--------|----------------------|
| `enum` | `figma.enum("<figmaProp>", { <figmaValue>: <codeValue>, ... })` — straight from `values` |
| `boolean` | `figma.boolean("<figmaProp>")`, or `figma.boolean("<figmaProp>", { true, false })` from `booleanMap` |
| `text` | `figma.string("<figmaProp>")` |
| `instanceSwap` | `figma.instance("<figmaProp>")` |
| `slot` | `figma.children("<figmaProp>")` |

**Eligibility gate (the graceful part).** Code Connect requires an **Organization/Enterprise** plan and **published** components.

- **Eligible** (`figma.published === true` on the entry, and the MCP Code Connect tools — `get_code_connect_suggestions` / `get_context_for_code_connect` — return usable data): `sync` may offer to compile each eligible `matched` entry's `propertyMap` into a `.figma.ts` template and push it via `add_code_connect_map` / `send_code_connect_mappings`. On pull, reconcile `get_code_connect_map` results back into the JSON so the two never silently diverge.
- **Not eligible** (Free/Professional plan, or unpublished): skip the Code Connect step silently. `propertyMap` is still fully functional — it drives value translation when designing screens, drives component drift detection in the loop, and documents the bridge for humans.

**`component-mapping.json` is always the source of truth.** A `.figma.ts` file is a derived publish target, never the canonical record. Nothing in the core loop depends on Code Connect being available.

For how to author `.figma.ts` templates, defer to the official `figma-code-connect` skill served by the Figma MCP (`skill://figma/figma-code-connect/SKILL.md`).
