# Component Mapping Schema

The machine-readable record of how each code component corresponds to a Figma component, including **property-level** and **value-level** mapping. It is the only place that knows code `style="primary"` ↔ Figma `Type=Primary`. `sync` diffs against it, `design` translates through it, `build-library` and `audit` respect its statuses.

**Contents:** [Layout](#layout-and-rules) · [Shape](#entry-shape) · [Statuses](#statuses) · [Example](#example) · [Validation](#validation) · [Code Connect bridge](#code-connect-bridge)

## Layout and rules

One file per component: `{workspace}/component-mappings/{id}.json`, a standalone entry named after its `id` slug (`button.json`, `use-toast.json`). An optional `_meta.json` holds `{ "version": 1, "generatedAt": "<ISO 8601>" }`. Machine-readable JSON schemas for editors: `schema/mapping.schema.json`, `schema/meta.schema.json` (via `$schema`; omitting it is fine).

- **Filename equals `id`**, `id` is a kebab-case slug, and no two files share an `id`. Rename the file when the `id` changes.
- **Why a file per component:** `setup` and `sync` add or update only the components that changed, so hand-tuned value maps are never clobbered and diffs stay small.
- **Never persist `#uid` suffixes.** Figma TEXT / BOOLEAN / INSTANCE_SWAP / SLOT property keys end in a volatile suffix (`Label#4:0`). Store base names (`Label`) and rediscover keys at runtime from `componentPropertyDefinitions` (slots: `componentPropertyReferences.slotContentId`).

## Entry shape

```jsonc
{
  "$schema": "…/schema/mapping.schema.json",   // optional
  "id": "button",
  "status": "matched",                          // see Statuses
  "code":  { "path": "src/components/ui/Button.tsx", "exportName": "Button", "props": ["style", "size"] },
  "figma": { "fileKey": "", "nodeId": "12:345", "componentName": "Button",
             "properties": ["Type", "Size"],    // base names
             "published": true },               // array of these for "split"
  "propertyMap": [
    { "codeProp": "style", "figmaProp": "Type", "kind": "enum",
      "values": { "Primary": "primary", "Secondary": "secondary" },   // figmaValue -> codeValue
      "required": true, "notes": "" }
  ],
  "notes": ""
}
```

`kind` is one of `enum` (VARIANT), `boolean`, `text`, `instanceSwap`, `slot`. A `propertyMap` entry needs `codeProp`, `figmaProp`, or both (one-sided properties are allowed). `values` maps **Figma value → code value** because reads from Figma are the common case. A non-literal boolean uses `booleanMap: { "true": "…", "false": "…" }`.

## Statuses

| Status | Meaning | Sides |
|---|---|---|
| `matched` | both exist; keep in sync | `code` and `figma` required |
| `code-only` | no Figma counterpart (hooks, wrappers) | no `figma` |
| `figma-only` | no code counterpart (illustrations, decoration) | no `code` |
| `split` | one code component → several Figma components | `figma` is an array |
| `merged` | several code components → one Figma component | one file per code component, each `merged`, same `figma.nodeId`, cross-referenced in `notes` |
| `diverged` | both exist but intentionally differ | document why in `notes`; not treated as drift |

## Example

`button.json` is the entry above filled in. The others in the directory:

- `card.json` — `matched`, one slot property: `{ "codeProp": "children", "figmaProp": "Content", "kind": "slot" }`
- `use-toast.json` — `code-only`, `notes: "Logic-only hook; no Figma representation."`
- `hero-illustration.json` — `figma-only`, `notes: "Decorative; no code equivalent."`

A complete working set lives in `evals/fixtures/acme/.figma-suite/component-mappings/`.

## Validation

Run the contract check ([SKILL.md → Commands](../SKILL.md#commands-defined-once-workflows-say-run-the-contract-check)). For mappings it enforces: valid JSON; status invariants (table above); `kind` values; filename equals `id`; no duplicate ids; no `#uid` in stored names; `_meta.json` shape; and warns when `code.path` no longer exists. It also cross-checks DESIGN.md `components:` ids and allowed variants against these files. Exit code 1 means errors. Run it after any mapping edit and at the end of every sync; there is no runtime dependency to install.

## Code Connect bridge

`propertyMap` is a superset of Code Connect property mappers, so an eligible mapping compiles into Code Connect and works standalone when not.

| `kind` | Template emission |
|---|---|
| `enum` | `figma.enum("<figmaProp>", { <figmaValue>: <codeValue> })` |
| `boolean` | `figma.boolean("<figmaProp>")` (with `booleanMap` when set) |
| `text` | `figma.string("<figmaProp>")` |
| `instanceSwap` | `figma.instance("<figmaProp>")` |
| `slot` | `getSlot("<figmaProp>")` / `figma.children("<figmaProp>")` per the official skill |

- **Eligible** = Organization/Enterprise plan, `figma.published === true`, and the Code Connect tools return usable data. Then `sync` may offer to emit a `.figma.ts` template (never `.figma.tsx` or `figma.connect()`) and publish it. On pull, reconcile `get_code_connect_map` results back into the JSON.
- **Not eligible** — skip silently. The mapping still drives value translation, drift detection and documentation.
- The mapping files are always the source of truth; a `.figma.ts` file is a derived publish target. Authoring syntax: official `figma-code-connect` skill.
